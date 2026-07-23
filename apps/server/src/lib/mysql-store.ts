import { createHash } from 'node:crypto'
import { createPool } from 'mysql2/promise'
import { env } from '../env'
import type { AppData } from './data-store'

const STATE_KEY = 'primary'
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS siteforge_app_state (
  state_key VARCHAR(64) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  schema_version INT UNSIGNED NOT NULL,
  payload LONGTEXT NOT NULL,
  checksum CHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (state_key),
  CONSTRAINT siteforge_app_state_payload_json CHECK (JSON_VALID(payload))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
`

export interface MysqlSnapshotEnvelope {
  data: AppData
  revision: number
  checksum: string
  updatedAt?: string
}

export interface MysqlStoreHealth {
  status: 'operational' | 'degraded' | 'not_configured'
  latencyMs?: number
  revision?: number
  schemaVersion?: number
  updatedAt?: string
  message: string
}

interface MysqlConnectionLike {
  execute(sql: string, values?: unknown[]): Promise<[unknown, unknown]>
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}

interface MysqlPoolLike {
  execute(sql: string, values?: unknown[]): Promise<[unknown, unknown]>
  getConnection(): Promise<MysqlConnectionLike>
  end(): Promise<void>
}

interface SnapshotRow {
  revision: number | string | bigint
  schema_version: number | string
  payload: string
  checksum: string
  updated_at?: string | Date
}

function firstRows(result: [unknown, unknown]): Record<string, unknown>[] {
  return Array.isArray(result[0]) ? result[0] as Record<string, unknown>[] : []
}

function parseDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : undefined
}

export function serializeSnapshot(data: AppData): string {
  return JSON.stringify(data)
}

export function snapshotChecksum(input: AppData | string): string {
  const serialized = typeof input === 'string' ? input : serializeSnapshot(input)
  return createHash('sha256').update(serialized).digest('hex')
}

function parseSnapshotRow(row: SnapshotRow): MysqlSnapshotEnvelope {
  const calculated = snapshotChecksum(row.payload)
  if (calculated !== row.checksum) {
    throw new Error('MYSQL_SNAPSHOT_CHECKSUM_MISMATCH')
  }
  const data = JSON.parse(row.payload) as AppData
  return {
    data,
    revision: Number(row.revision),
    checksum: row.checksum,
    updatedAt: parseDate(row.updated_at),
  }
}

function mysqlPoolOptions() {
  if (!env.MYSQL_URL) throw new Error('MYSQL_URL_REQUIRED')
  const url = new URL(env.MYSQL_URL)
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!database) throw new Error('MYSQL_DATABASE_REQUIRED')

  const ssl = env.MYSQL_SSL_MODE === 'disabled'
    ? undefined
    : { rejectUnauthorized: env.MYSQL_SSL_MODE === 'required' }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    waitForConnections: true,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
    queueLimit: 0,
    connectTimeout: env.MYSQL_CONNECT_TIMEOUT_MS,
    timezone: 'Z',
    charset: 'utf8mb4',
    dateStrings: true,
    ...(ssl ? { ssl } : {}),
  }
}

export class MysqlSnapshotStore {
  constructor(private readonly pool: MysqlPoolLike) {}

  async initialize(): Promise<void> {
    await this.pool.execute(CREATE_TABLE_SQL)
  }

  private async readWith(
    executor: Pick<MysqlConnectionLike, 'execute'> | MysqlPoolLike,
    lock = false,
  ): Promise<MysqlSnapshotEnvelope | null> {
    const result = await executor.execute(
      `SELECT revision, schema_version, payload, checksum, updated_at
       FROM siteforge_app_state
       WHERE state_key = ?${lock ? ' FOR UPDATE' : ''}`,
      [STATE_KEY],
    )
    const row = firstRows(result)[0] as unknown as SnapshotRow | undefined
    return row ? parseSnapshotRow(row) : null
  }

  async read(): Promise<MysqlSnapshotEnvelope | null> {
    await this.initialize()
    return this.readWith(this.pool)
  }

  async mutate<T>(fallback: AppData, mutator: (draft: AppData) => T | Promise<T>): Promise<T> {
    await this.initialize()
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const current = await this.readWith(connection, true)
      const draft = structuredClone(current?.data ?? fallback)
      const result = await mutator(draft)
      const payload = serializeSnapshot(draft)
      const checksum = snapshotChecksum(payload)
      const revision = (current?.revision ?? 0) + 1

      if (current) {
        await connection.execute(
          `UPDATE siteforge_app_state
           SET revision = ?, schema_version = ?, payload = ?, checksum = ?
           WHERE state_key = ?`,
          [revision, draft.schemaVersion, payload, checksum, STATE_KEY],
        )
      } else {
        await connection.execute(
          `INSERT INTO siteforge_app_state
             (state_key, revision, schema_version, payload, checksum)
           VALUES (?, ?, ?, ?, ?)`,
          [STATE_KEY, revision, draft.schemaVersion, payload, checksum],
        )
      }
      await connection.commit()
      return result
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async importSnapshot(data: AppData, options: { force?: boolean } = {}): Promise<MysqlSnapshotEnvelope> {
    await this.initialize()
    const connection = await this.pool.getConnection()
    try {
      await connection.beginTransaction()
      const current = await this.readWith(connection, true)
      if (current && !options.force) throw new Error('MYSQL_SNAPSHOT_ALREADY_EXISTS')

      const payload = serializeSnapshot(data)
      const checksum = snapshotChecksum(payload)
      const revision = (current?.revision ?? 0) + 1
      await connection.execute(
        `INSERT INTO siteforge_app_state
           (state_key, revision, schema_version, payload, checksum)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           revision = VALUES(revision),
           schema_version = VALUES(schema_version),
           payload = VALUES(payload),
           checksum = VALUES(checksum)`,
        [STATE_KEY, revision, data.schemaVersion, payload, checksum],
      )
      await connection.commit()
      return { data: structuredClone(data), revision, checksum }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  async health(): Promise<MysqlStoreHealth> {
    const startedAt = Date.now()
    try {
      await this.initialize()
      await this.pool.execute('SELECT 1 AS ok')
      const snapshot = await this.readWith(this.pool)
      return {
        status: 'operational',
        latencyMs: Date.now() - startedAt,
        revision: snapshot?.revision ?? 0,
        schemaVersion: snapshot?.data.schemaVersion,
        updatedAt: snapshot?.updatedAt,
        message: snapshot ? 'MySQL 事务快照可读写' : 'MySQL 已连接，等待首次数据写入',
      }
    } catch (error) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'MySQL 健康检查失败',
      }
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

let store: MysqlSnapshotStore | null = null

export function getMysqlSnapshotStore(): MysqlSnapshotStore {
  if (!store) {
    const pool = createPool(mysqlPoolOptions()) as unknown as MysqlPoolLike
    store = new MysqlSnapshotStore(pool)
  }
  return store
}

export function setMysqlSnapshotStoreForTest(next: MysqlSnapshotStore | null): void {
  store = next
}

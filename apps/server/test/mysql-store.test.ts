import { describe, expect, it } from 'vitest'
import { createEmptyData } from '../src/lib/data-store'
import { MysqlSnapshotStore, snapshotChecksum } from '../src/lib/mysql-store'

interface StoredRow {
  revision: number
  schema_version: number
  payload: string
  checksum: string
  updated_at: string
}

class FakeMysqlPool {
  row: StoredRow | null = null
  commits = 0
  rollbacks = 0

  async execute(sql: string): Promise<[unknown, unknown]> {
    if (sql.includes('SELECT 1 AS ok')) return [[{ ok: 1 }], []]
    if (sql.includes('FROM siteforge_app_state')) return [[...(this.row ? [structuredClone(this.row)] : [])], []]
    return [[], []]
  }

  async getConnection() {
    const pool = this
    let working: StoredRow | null = null
    let active = false
    return {
      async beginTransaction() {
        active = true
        working = pool.row ? structuredClone(pool.row) : null
      },
      async execute(sql: string, values: unknown[] = []): Promise<[unknown, unknown]> {
        if (sql.includes('FROM siteforge_app_state')) {
          return [[...(working ? [structuredClone(working)] : [])], []]
        }
        if (sql.trimStart().startsWith('UPDATE siteforge_app_state')) {
          const [revision, schemaVersion, payload, checksum] = values
          working = {
            revision: Number(revision),
            schema_version: Number(schemaVersion),
            payload: String(payload),
            checksum: String(checksum),
            updated_at: new Date().toISOString(),
          }
          return [{ affectedRows: 1 }, []]
        }
        if (sql.trimStart().startsWith('INSERT INTO siteforge_app_state')) {
          const [, revision, schemaVersion, payload, checksum] = values
          working = {
            revision: Number(revision),
            schema_version: Number(schemaVersion),
            payload: String(payload),
            checksum: String(checksum),
            updated_at: new Date().toISOString(),
          }
          return [{ affectedRows: 1 }, []]
        }
        return [[], []]
      },
      async commit() {
        if (!active) throw new Error('NO_TRANSACTION')
        pool.row = working ? structuredClone(working) : null
        pool.commits += 1
        active = false
      },
      async rollback() {
        pool.rollbacks += 1
        active = false
      },
      release() {},
    }
  }

  async end() {}
}

function storeWith(pool: FakeMysqlPool) {
  return new MysqlSnapshotStore(pool as never)
}

describe('MysqlSnapshotStore', () => {
  it('为相同快照生成稳定校验和', () => {
    const data = createEmptyData()
    expect(snapshotChecksum(data)).toBe(snapshotChecksum(structuredClone(data)))
    data.projects.push({
      id: 'p1', userId: 'u1', title: '项目', siteType: 'saas', requirement: '',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(snapshotChecksum(data)).not.toBe(snapshotChecksum(createEmptyData()))
  })

  it('事务提交后递增修订号并保留修改', async () => {
    const pool = new FakeMysqlPool()
    const store = storeWith(pool)
    const first = await store.mutate(createEmptyData(), (draft) => {
      draft.users.push({
        id: 'u1', email: 'owner@example.com', role: 'admin', status: 'active',
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      })
      return 'created'
    })
    expect(first).toBe('created')
    expect((await store.read())?.revision).toBe(1)

    await store.mutate(createEmptyData(), (draft) => {
      draft.users[0]!.updatedAt = '2026-01-02T00:00:00.000Z'
    })
    const snapshot = await store.read()
    expect(snapshot?.revision).toBe(2)
    expect(snapshot?.data.users[0]?.updatedAt).toBe('2026-01-02T00:00:00.000Z')
    expect(pool.commits).toBe(2)
  })

  it('业务回调抛错时回滚且不污染已提交快照', async () => {
    const pool = new FakeMysqlPool()
    const store = storeWith(pool)
    await store.importSnapshot(createEmptyData())
    const before = await store.read()

    await expect(store.mutate(createEmptyData(), (draft) => {
      draft.projects.push({
        id: 'p1', userId: 'u1', title: '不应保存', siteType: 'saas', requirement: '',
        createdAt: '', updatedAt: '',
      })
      throw new Error('EXPECTED_FAILURE')
    })).rejects.toThrow('EXPECTED_FAILURE')

    const after = await store.read()
    expect(after?.checksum).toBe(before?.checksum)
    expect(after?.data.projects).toHaveLength(0)
    expect(pool.rollbacks).toBe(1)
  })

  it('默认拒绝覆盖已有快照,force 时才允许', async () => {
    const pool = new FakeMysqlPool()
    const store = storeWith(pool)
    await store.importSnapshot(createEmptyData())
    await expect(store.importSnapshot(createEmptyData())).rejects.toThrow('MYSQL_SNAPSHOT_ALREADY_EXISTS')

    const replacement = createEmptyData()
    replacement.users.push({
      id: 'u1', email: 'new@example.com', createdAt: '', updatedAt: '',
    })
    const imported = await store.importSnapshot(replacement, { force: true })
    expect(imported.revision).toBe(2)
    expect((await store.read())?.data.users[0]?.email).toBe('new@example.com')
  })

  it('快照校验和不匹配时拒绝读取', async () => {
    const pool = new FakeMysqlPool()
    const store = storeWith(pool)
    await store.importSnapshot(createEmptyData())
    pool.row!.checksum = '0'.repeat(64)
    await expect(store.read()).rejects.toThrow('MYSQL_SNAPSHOT_CHECKSUM_MISMATCH')
  })
})

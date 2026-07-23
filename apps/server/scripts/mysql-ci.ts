import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createConnection } from 'mysql2/promise'
import { createEmptyData } from '../src/lib/data-store'
import { getMysqlSnapshotStore } from '../src/lib/mysql-store'

function connectionOptions(urlValue: string) {
  const url = new URL(urlValue)
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, '')),
    multipleStatements: true,
  }
}

async function waitForMysql(url: string): Promise<void> {
  let latest: unknown
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const connection = await createConnection(connectionOptions(url))
      await connection.query('SELECT 1')
      await connection.end()
      return
    } catch (error) {
      latest = error
      await new Promise((resolve) => setTimeout(resolve, 1_000))
    }
  }
  throw latest instanceof Error ? latest : new Error('MYSQL_NOT_READY')
}

async function applyMigrations(url: string): Promise<string[]> {
  const directory = path.resolve('db')
  const names = (await readdir(directory))
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort()
  const connection = await createConnection(connectionOptions(url))
  try {
    for (const name of names) {
      const sql = await readFile(path.join(directory, name), 'utf8')
      await connection.query(sql)
      console.log(`[mysql-ci] applied ${name}`)
    }
  } finally {
    await connection.end()
  }
  return names
}

async function main() {
  const url = process.env.MYSQL_URL
  if (!url) throw new Error('MYSQL_URL_REQUIRED')
  await waitForMysql(url)
  const migrations = await applyMigrations(url)
  if (!migrations.includes('004_transactional_state.sql')) {
    throw new Error('TRANSACTIONAL_STATE_MIGRATION_MISSING')
  }
  if (!migrations.includes('005_operations_rbac.sql')) {
    throw new Error('OPERATIONS_MIGRATION_MISSING')
  }

  const store = getMysqlSnapshotStore()
  try {
    const seed = createEmptyData()
    const imported = await store.importSnapshot(seed, { force: true })
    if (imported.revision < 1) throw new Error('INITIAL_REVISION_INVALID')

    const writes = 16
    await Promise.all(Array.from({ length: writes }, async (_, index) => {
      await store.mutate(createEmptyData(), (draft) => {
        draft.usage.push({
          id: randomUUID(),
          userId: '00000000-0000-4000-8000-000000000001',
          action: 'generate',
          units: 1,
          siteType: `mysql-ci-${index}`,
          createdAt: new Date().toISOString(),
        })
      })
    }))

    const afterWrites = await store.read()
    if (!afterWrites) throw new Error('SNAPSHOT_NOT_FOUND')
    if (afterWrites.data.usage.length !== writes) {
      throw new Error(`CONCURRENT_WRITE_LOSS expected=${writes} actual=${afterWrites.data.usage.length}`)
    }
    if (afterWrites.revision !== imported.revision + writes) {
      throw new Error(`REVISION_MISMATCH expected=${imported.revision + writes} actual=${afterWrites.revision}`)
    }

    const beforeFailure = afterWrites.revision
    try {
      await store.mutate(createEmptyData(), (draft) => {
        draft.projects.push({
          id: randomUUID(),
          userId: '00000000-0000-4000-8000-000000000001',
          title: 'should rollback',
          siteType: 'test',
          requirement: 'rollback',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        throw new Error('EXPECTED_ROLLBACK')
      })
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'EXPECTED_ROLLBACK') throw error
    }

    const afterFailure = await store.read()
    if (!afterFailure || afterFailure.revision !== beforeFailure || afterFailure.data.projects.length !== 0) {
      throw new Error('TRANSACTION_ROLLBACK_FAILED')
    }

    const health = await store.health()
    if (health.status !== 'operational' || health.schemaVersion !== 5) {
      throw new Error(`MYSQL_HEALTH_FAILED ${JSON.stringify(health)}`)
    }
    console.log(JSON.stringify({
      ok: true,
      migrations: migrations.length,
      concurrentWrites: writes,
      revision: afterFailure.revision,
      schemaVersion: health.schemaVersion,
      latencyMs: health.latencyMs,
    }, null, 2))
  } finally {
    await store.close()
  }
}

main().catch((error) => {
  console.error('[mysql-ci] failed:', error)
  process.exitCode = 1
})

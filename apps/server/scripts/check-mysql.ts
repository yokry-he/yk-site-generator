import { env } from '../src/env'
import { getMysqlSnapshotStore } from '../src/lib/mysql-store'

async function main() {
  if (!env.MYSQL_URL) throw new Error('请先配置 MYSQL_URL')
  const store = getMysqlSnapshotStore()
  try {
    const health = await store.health()
    console.log(JSON.stringify(health, null, 2))
    if (health.status !== 'operational') process.exitCode = 1
  } finally {
    await store.close()
  }
}

main().catch((error) => {
  console.error('[mysql:check] 失败:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

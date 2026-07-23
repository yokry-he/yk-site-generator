import path from 'node:path'
import { env } from '../src/env'
import { writeDataFile } from '../src/lib/data-store'
import { getMysqlSnapshotStore } from '../src/lib/mysql-store'

function outputFrom(argv: string[]): string {
  const explicit = argv.find((item) => item.startsWith('--output='))?.slice('--output='.length)
  if (explicit) return explicit
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join('.data', `mysql-export-${stamp}.json`)
}

async function main() {
  if (!env.MYSQL_URL) throw new Error('请先配置 MYSQL_URL')
  const output = outputFrom(process.argv.slice(2))
  const store = getMysqlSnapshotStore()
  try {
    const snapshot = await store.read()
    if (!snapshot) throw new Error('MySQL 中尚无 SiteForge 数据快照')
    await writeDataFile(snapshot.data, output)
    console.log(JSON.stringify({
      output: path.resolve(output),
      revision: snapshot.revision,
      schemaVersion: snapshot.data.schemaVersion,
      checksum: snapshot.checksum,
    }, null, 2))
  } finally {
    await store.close()
  }
}

main().catch((error) => {
  console.error('[mysql:export] 失败:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

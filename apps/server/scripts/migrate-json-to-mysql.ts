import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../src/env'
import { normalizeAppData, writeDataFile } from '../src/lib/data-store'
import { getMysqlSnapshotStore, snapshotChecksum } from '../src/lib/mysql-store'

interface Options {
  file: string
  force: boolean
  dryRun: boolean
  backup?: string
}

function optionsFrom(argv: string[]): Options {
  const value = (name: string) => argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1)
  return {
    file: value('--file') ?? env.DATA_STORAGE_FILE,
    force: argv.includes('--force'),
    dryRun: argv.includes('--dry-run'),
    backup: value('--backup'),
  }
}

function counts(data: ReturnType<typeof normalizeAppData>) {
  return {
    users: data.users.length,
    sessions: data.sessions.length,
    projects: data.projects.length,
    versions: data.projectVersions.length,
    publications: data.publications.length,
    brandKits: data.brandKits.length,
    feedback: data.feedback.length,
    auditLogs: data.auditLogs.length,
    systemEvents: data.systemEvents.length,
  }
}

function backupPath(explicit?: string): string {
  if (explicit) return explicit
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return path.join('.data', `mysql-rollback-${stamp}.json`)
}

async function main() {
  const options = optionsFrom(process.argv.slice(2))
  if (!env.MYSQL_URL) throw new Error('请先配置 MYSQL_URL')

  const sourceRaw = await readFile(options.file, 'utf8')
  const source = normalizeAppData(JSON.parse(sourceRaw))
  const sourceChecksum = snapshotChecksum(source)
  const store = getMysqlSnapshotStore()

  try {
    await store.initialize()
    const existing = await store.read()
    const preview = {
      source: path.resolve(options.file),
      schemaVersion: source.schemaVersion,
      checksum: sourceChecksum,
      counts: counts(source),
      destination: existing
        ? { revision: existing.revision, checksum: existing.checksum, schemaVersion: existing.data.schemaVersion }
        : null,
      force: options.force,
      dryRun: options.dryRun,
    }
    console.log(JSON.stringify(preview, null, 2))

    if (options.dryRun) return
    if (existing && !options.force) {
      throw new Error('MySQL 已有快照；请先导出备份，并在确认后使用 --force')
    }

    if (existing && options.force) {
      const target = backupPath(options.backup)
      await writeDataFile(existing.data, target)
      console.log(`[mysql:migrate] 已保存覆盖前回滚快照: ${path.resolve(target)}`)
    }

    const imported = await store.importSnapshot(source, { force: options.force })
    const verified = await store.read()
    if (!verified || verified.checksum !== sourceChecksum) {
      throw new Error('MYSQL_IMPORT_VERIFICATION_FAILED')
    }
    console.log(
      `[mysql:migrate] 导入完成 revision=${imported.revision} checksum=${imported.checksum} projects=${source.projects.length}`,
    )
  } finally {
    await store.close()
  }
}

main().catch((error) => {
  console.error('[mysql:migrate] 失败:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})

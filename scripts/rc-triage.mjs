import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rcTriageShouldFail, renderRcTriageMarkdown, triageRcDiagnostics } from './lib/rc-triage.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const valuesOf = (name) => args.filter((item) => item.startsWith(`--${name}=`)).map((item) => item.slice(name.length + 3))
const valueOf = (name, fallback = '') => valuesOf(name).at(-1) ?? fallback
const booleanOf = (name, fallback = false) => {
  if (args.includes(`--${name}`)) return true
  return ['1', 'true', 'yes', 'on'].includes(valueOf(name, String(fallback)).toLowerCase())
}

const sourceRoot = resolve(root, valueOf('source-root', 'artifacts'))
const reportRoot = resolve(root, valueOf('report-dir', 'artifacts/rc-triage'))
const allowMissing = booleanOf('allow-missing', false)
const failOn = valueOf('fail-on', 'blocking')
const scope = valueOf('scope', 'repository')
const planOnly = args.includes('--plan')
const excludedRoots = valuesOf('exclude').map((item) => resolve(sourceRoot, item.replace(/^\/+/, '')))
const externalStatuses = valuesOf('external-status').map((entry) => {
  const separator = entry.lastIndexOf(':')
  return separator === -1 ? { scope: entry, status: 'unknown' } : { scope: entry.slice(0, separator), status: entry.slice(separator + 1) }
})

function relativePath(path) {
  return relative(root, path).replace(/\\/g, '/')
}
function excluded(path) {
  return excludedRoots.some((item) => path === item || path.startsWith(`${item}/`))
}
async function walk(directory, output = []) {
  if (!existsSync(directory) || excluded(directory)) return output
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name)
    if (target === reportRoot || target.startsWith(`${reportRoot}/`) || excluded(target)) continue
    if (entry.isDirectory()) await walk(target, output)
    else if (entry.isFile() && entry.name.endsWith('.json')) output.push(target)
  }
  return output
}
function diagnosticCandidate(path) {
  return /(?:latest|summary|report|result|security-audit)\.json$/.test(path.toLowerCase())
}
async function discoverReports() {
  const paths = (await walk(sourceRoot)).filter(diagnosticCandidate).sort()
  const reports = []
  for (const path of paths) {
    try {
      reports.push({ path: relativePath(path), data: JSON.parse(await readFile(path, 'utf8')) })
    } catch (error) {
      reports.push({ path: relativePath(path), data: { ok: false, status: 'failed', message: error instanceof Error ? error.message : String(error) } })
    }
  }
  return reports
}
async function writeReport(report, reports, startedAt) {
  const finishedAt = new Date().toISOString()
  const metadata = {
    schemaVersion: 1,
    scope,
    commit: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '',
    workflowRunId: process.env.GITHUB_RUN_ID || '',
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    sourceRoot: relativePath(sourceRoot),
    excludedRoots: excludedRoots.map(relativePath),
    reportCount: reports.length,
    externalStatuses,
  }
  const output = { ...metadata, ...report }
  const markdown = renderRcTriageMarkdown(report, metadata)
  const timestamp = finishedAt.replace(/[:.]/g, '-')
  const runDirectory = resolve(reportRoot, timestamp)
  await mkdir(runDirectory, { recursive: true })
  await Promise.all([
    writeFile(resolve(runDirectory, 'summary.json'), `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 }),
    writeFile(resolve(runDirectory, 'summary.md'), markdown, { mode: 0o600 }),
    writeFile(resolve(reportRoot, 'latest.json'), `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 }),
    writeFile(resolve(reportRoot, 'latest.md'), markdown, { mode: 0o600 }),
  ])
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8')
}

console.log(`RC diagnostic triage · scope=${scope}`)
console.log(`- source: ${relativePath(sourceRoot)}`)
console.log(`- report: ${relativePath(reportRoot)}`)
console.log(`- allow missing: ${allowMissing}`)
console.log(`- fail on: ${failOn}`)
for (const item of excludedRoots) console.log(`- exclude: ${relativePath(item)}`)
for (const item of externalStatuses) console.log(`- external: ${item.scope}=${item.status}`)
if (planOnly) process.exit(0)

const startedAt = new Date().toISOString()
const reports = await discoverReports()
const triage = triageRcDiagnostics({ reports, externalStatuses, allowMissing })
await writeReport(triage, reports, startedAt)
console.log(`RC triage status: ${triage.status}; P0=${triage.counts.P0}, P1=${triage.counts.P1}, P2=${triage.counts.P2}, P3=${triage.counts.P3}`)
console.log(`RC triage report: ${relativePath(resolve(reportRoot, 'latest.md'))}`)
if (rcTriageShouldFail(triage, failOn)) process.exitCode = 1

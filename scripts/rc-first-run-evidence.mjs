import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyFirstRunEvidence } from './lib/rc-first-run-evidence.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => args.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
let runId = valueOf('run', 'latest')
if (runId === 'latest') {
  const latestPath = resolve(root, 'artifacts/rc-first-run/latest.json')
  if (!existsSync(latestPath)) throw new Error('FIRST_RUN_EVIDENCE_LATEST_MISSING')
  const latest = JSON.parse(await readFile(latestPath, 'utf8'))
  runId = latest.runId
}
if (!/^[A-Za-z0-9._-]+$/.test(runId)) throw new Error(`FIRST_RUN_EVIDENCE_RUN_ID_INVALID:${runId}`)
const result = await verifyFirstRunEvidence({ root, runId })
for (const issue of result.issues) console.error(`${issue.code}${issue.path ? `: ${issue.path}` : ''}${issue.message ? `: ${issue.message}` : ''}`)
console.log(`RC first-run evidence ${result.ok ? 'verified' : 'failed'} for ${runId}`)
if (!result.ok) process.exitCode = 1

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditWorkflowBootstrap } from './lib/rc-workflow-bootstrap.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name, fallback = '') => args.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const reportRoot = resolve(repositoryRoot, option('report-dir', 'artifacts/rc-workflow-bootstrap'))
const report = auditWorkflowBootstrap(repositoryRoot)
const markdown = [
  '# RC Workflow Bootstrap Audit',
  '',
  `- Status: **${report.ok ? 'passed' : 'failed'}**`,
  `- Shared action: \`${report.action}\``,
  `- Workflows inspected: ${report.workflows.length}`,
  `- Issues: ${report.issues.length}`,
  '',
  '| Workflow | Needs bootstrap | Issues |',
  '| --- | --- | ---: |',
  ...report.workflows.map((item) => `| \`${item.path}\` | ${item.requiresBootstrap ? 'yes' : 'no'} | ${item.issues} |`),
  '',
  ...(report.issues.length
    ? ['## Issues', '', ...report.issues.map((issue) => `- **${issue.code}** \`${issue.path}\`: ${issue.message}`), '']
    : []),
].join('\n')

await mkdir(reportRoot, { recursive: true })
await Promise.all([
  writeFile(resolve(reportRoot, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }),
  writeFile(resolve(reportRoot, 'latest.md'), markdown, { mode: 0o600 }),
])

console.log(`RC workflow bootstrap audit: ${report.ok ? 'passed' : 'failed'} · ${report.issues.length} issue(s)`)
for (const issue of report.issues) console.error(`- ${issue.code} (${issue.path}): ${issue.message}`)
if (!report.ok) process.exitCode = 1

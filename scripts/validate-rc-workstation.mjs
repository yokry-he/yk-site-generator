import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateWorkstation } from './lib/rc-workstation.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const reportRoot = resolve(root, 'artifacts/rc-workstation')
const report = validateWorkstation(root)
const markdown = [
  '# RC Workstation Validation',
  '',
  `- Status: **${report.ok ? 'passed' : 'failed'}**`,
  `- Issues: ${report.issues.length}`,
  '',
  ...report.issues.map((issue) => `- **${issue.code}** · \`${issue.path}\` · ${issue.message}`),
  '',
].join('\n')
await mkdir(reportRoot, { recursive: true })
await Promise.all([
  writeFile(resolve(reportRoot, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }),
  writeFile(resolve(reportRoot, 'latest.md'), markdown, { mode: 0o600 }),
])
console.log(markdown)
if (!report.ok) process.exitCode = 1

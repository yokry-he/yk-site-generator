import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runPreflight } from './lib/rc-preflight.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const valueOf = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const profile = valueOf('profile') || 'core'
const reportDirectory = resolve(root, valueOf('report-dir') || 'artifacts/rc-preflight')
const strictWarnings = args.includes('--strict-warnings')
const report = runPreflight({ root, profile, strictWarnings })
const generatedAt = new Date().toISOString()
const payload = { ...report, generatedAt }
const markdown = [
  '# RC Environment Preflight',
  '',
  `- Profile: \`${profile}\``,
  `- Status: **${report.ok ? 'passed' : 'failed'}**`,
  `- Errors: ${report.counts?.errors ?? 0}`,
  `- Warnings: ${report.counts?.warnings ?? 0}`,
  `- Generated: ${generatedAt}`,
  '',
  '## Issues',
  '',
  ...(report.issues.length ? report.issues.map((issue) => `- **${issue.severity.toUpperCase()} ${issue.code}**${issue.path ? ` (\`${issue.path}\`)` : ''}: ${issue.message}`) : ['- None']),
  '',
  '## Tools',
  '',
  ...Object.entries(report.tools).map(([name, value]) => `- \`${name}\`: ${value.available ? value.detail : `unavailable (${value.detail})`}`),
  '',
].join('\n')

await mkdir(reportDirectory, { recursive: true })
await Promise.all([
  writeFile(resolve(reportDirectory, 'latest.json'), `${JSON.stringify(payload, null, 2)}\n`),
  writeFile(resolve(reportDirectory, 'latest.md'), markdown),
])

for (const issue of report.issues) {
  const line = `${issue.severity.toUpperCase()} ${issue.code}${issue.path ? ` (${issue.path})` : ''}: ${issue.message}`
  ;(issue.severity === 'error' ? console.error : console.warn)(line)
}
console.log(`RC preflight ${report.ok ? 'passed' : 'failed'} · ${report.counts?.errors ?? 0} error(s) · ${report.counts?.warnings ?? 0} warning(s)`)
console.log(`Report: ${relative(root, resolve(reportDirectory, 'latest.md')).replace(/\\/g, '/')}`)
if (!report.ok) process.exitCode = 1

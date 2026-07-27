import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'
import {
  redactRcGateOutput,
  safeRcGateCommand,
  secretValuesFromEnvironment,
  selectRcGates,
  type RcGateDefinition,
  type RcGateProfile,
} from './lib/rc-gates'

type GateStatus = 'passed' | 'failed' | 'timed-out' | 'cancelled'
interface GateResult {
  id: string
  label: string
  command: string
  status: GateStatus
  exitCode: number | null
  signal: NodeJS.Signals | null
  startedAt: string
  finishedAt: string
  durationMs: number
  logPath: string
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const valueOf = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3)
const listOf = (name: string) => (valueOf(name) ?? '').split(',').map((item) => item.trim()).filter(Boolean)
const profile = (valueOf('profile') ?? 'core') as RcGateProfile
if (!['core', 'full'].includes(profile)) throw new Error(`UNKNOWN_RC_GATE_PROFILE:${profile}`)
const failFast = args.includes('--fail-fast')
const planOnly = args.includes('--plan')
const only = listOf('only')
const skip = listOf('skip')
const gates = selectRcGates(profile, only, skip)
if (!gates.length) throw new Error('RC_GATE_SELECTION_EMPTY')

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const reportRoot = resolve(root, valueOf('report-dir') ?? 'artifacts/rc-gates')
const runDirectory = resolve(reportRoot, timestamp)
const secrets = secretValuesFromEnvironment(process.env)
const children = new Set<ChildProcessWithoutNullStreams>()
let interrupted = false

function relativePath(path: string): string {
  return relative(root, path).replace(/\\/g, '/')
}

async function writeSummary(results: GateResult[], startedAt: string): Promise<void> {
  const finishedAt = new Date().toISOString()
  const failed = results.filter((result) => result.status !== 'passed')
  const report = {
    schemaVersion: 1,
    profile,
    commit: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '',
    workflowRunId: process.env.GITHUB_RUN_ID || '',
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      ci: Boolean(process.env.CI),
    },
    passed: failed.length === 0,
    results,
  }
  const markdown = [
    '# SiteForge RC Gate Report',
    '',
    `- Profile: \`${profile}\``,
    `- Commit: \`${report.commit || 'local'}\``,
    `- Started: ${startedAt}`,
    `- Finished: ${finishedAt}`,
    `- Result: **${report.passed ? 'PASSED' : 'FAILED'}**`,
    '',
    '| Gate | Status | Duration | Log |',
    '| --- | --- | ---: | --- |',
    ...results.map((result) => `| ${result.label} | ${result.status} | ${(result.durationMs / 1000).toFixed(1)}s | \`${result.logPath}\` |`),
    '',
  ].join('\n')
  await mkdir(reportRoot, { recursive: true })
  await writeFile(resolve(runDirectory, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(resolve(runDirectory, 'summary.md'), markdown)
  await writeFile(resolve(reportRoot, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(resolve(reportRoot, 'latest.md'), markdown)
}

function printPlan(): void {
  console.log(`RC gate profile: ${profile}`)
  for (const gate of gates) console.log(`- ${gate.id}: ${safeRcGateCommand(gate)}`)
}

function terminateChildren(signal: NodeJS.Signals): void {
  interrupted = true
  for (const child of children) child.kill(signal)
}

process.once('SIGINT', () => terminateChildren('SIGINT'))
process.once('SIGTERM', () => terminateChildren('SIGTERM'))

async function runGate(gate: RcGateDefinition): Promise<GateResult> {
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const logFile = resolve(runDirectory, `${gate.id}.log`)
  const lines: string[] = [
    `# ${gate.label}`,
    `command=${safeRcGateCommand(gate)}`,
    `startedAt=${startedAt}`,
    '',
  ]
  console.log(`\n▶ ${gate.label}`)
  console.log(`  ${safeRcGateCommand(gate)}`)
  const child = spawn(gate.command, gate.args, {
    cwd: root,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  const consume = (stream: NodeJS.ReadableStream, name: 'stdout' | 'stderr') => {
    const reader = createInterface({ input: stream })
    reader.on('line', (line) => {
      const redacted = redactRcGateOutput(line, secrets)
      lines.push(`[${name}] ${redacted}`)
      const target = name === 'stderr' ? process.stderr : process.stdout
      target.write(`[${gate.id}] ${redacted}\n`)
    })
  }
  consume(child.stdout, 'stdout')
  consume(child.stderr, 'stderr')
  const timeoutMinutes = gate.timeoutMinutes ?? Number(process.env.RC_GATE_TIMEOUT_MINUTES || 20)
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 5_000).unref()
  }, Math.max(1, timeoutMinutes) * 60_000)
  timer.unref()
  const outcome = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolveOutcome) => {
    child.once('error', (error) => {
      lines.push(`[runner] ${redactRcGateOutput(error.stack || error.message, secrets)}`)
    })
    child.once('close', (exitCode, signal) => resolveOutcome({ exitCode, signal }))
  })
  clearTimeout(timer)
  children.delete(child)
  const finishedAt = new Date().toISOString()
  const status: GateStatus = interrupted ? 'cancelled' : timedOut ? 'timed-out' : outcome.exitCode === 0 ? 'passed' : 'failed'
  lines.push('', `finishedAt=${finishedAt}`, `status=${status}`, `exitCode=${outcome.exitCode ?? ''}`, `signal=${outcome.signal ?? ''}`)
  await writeFile(logFile, `${lines.join('\n')}\n`)
  const result: GateResult = {
    id: gate.id,
    label: gate.label,
    command: safeRcGateCommand(gate),
    status,
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    logPath: relativePath(logFile),
  }
  console.log(`${status === 'passed' ? '✓' : '✗'} ${gate.label} · ${(result.durationMs / 1000).toFixed(1)}s`)
  return result
}

async function main(): Promise<void> {
  printPlan()
  if (planOnly) return
  const startedAt = new Date().toISOString()
  await mkdir(runDirectory, { recursive: true })
  const results: GateResult[] = []
  for (const gate of gates) {
    const result = await runGate(gate)
    results.push(result)
    if (interrupted || (failFast && result.status !== 'passed')) break
  }
  await writeSummary(results, startedAt)
  const failed = results.filter((result) => result.status !== 'passed')
  console.log(`\nRC gate report: ${relativePath(resolve(reportRoot, 'latest.md'))}`)
  if (failed.length) {
    console.error(`RC gates failed: ${failed.map((result) => result.id).join(', ')}`)
    process.exitCode = interrupted ? 130 : 1
  } else {
    console.log(`RC gates passed for profile ${profile}.`)
  }
}

await main()

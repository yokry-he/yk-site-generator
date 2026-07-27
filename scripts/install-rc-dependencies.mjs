import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyDependencyFailure,
  dependencyCommand,
  dependencyFailureIsRetryable,
  redactDependencyOutput,
  retryDelayMs,
  safeDependencyCommand,
  secretValuesFromEnvironment,
} from './lib/rc-dependencies.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = (name, fallback = '') => args.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const mode = option('mode', 'all')
if (!['fetch', 'install', 'all'].includes(mode)) throw new Error(`UNKNOWN_DEPENDENCY_MODE:${mode}`)
const planOnly = args.includes('--plan')
const maximumAttempts = Math.min(4, Math.max(1, Number.parseInt(option('attempts', '2'), 10) || 2))
const baseDelayMs = Math.min(30_000, Math.max(0, Number.parseInt(option('base-delay-ms', '5000'), 10) || 5_000))
const reportRoot = resolve(root, option('report-dir', 'artifacts/rc-dependencies'))
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const runDirectory = resolve(reportRoot, timestamp)
const phases = mode === 'all' ? ['fetch', 'install'] : [mode]
const secrets = secretValuesFromEnvironment(process.env)
let activeChild
let interrupted = false

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    interrupted = true
    activeChild?.kill(signal)
  })
}

function pathFromRoot(value) {
  return relative(root, value).replace(/\\/g, '/')
}

function versionOf(command) {
  const result = spawnSync(command, ['--version'], { cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true })
  return result.status === 0 ? (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] : ''
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds))
}

function lineSink(path) {
  const stream = createWriteStream(path, { flags: 'a', mode: 0o600 })
  let buffer = ''
  return {
    write(chunk) {
      buffer += String(chunk)
      const lines = buffer.split(/(?<=\n)/)
      buffer = lines.pop() ?? ''
      for (const line of lines) stream.write(redactDependencyOutput(line, secrets))
    },
    end() {
      if (buffer) stream.write(redactDependencyOutput(buffer, secrets))
      stream.end()
    },
  }
}

async function executeAttempt(phase, attempt) {
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const logFile = resolve(runDirectory, `${phase}-attempt-${attempt}.log`)
  const sink = lineSink(logFile)
  const { command, args: commandArgs } = dependencyCommand(phase)
  let tail = ''
  const append = (chunk) => {
    const text = String(chunk)
    sink.write(text)
    tail = (tail + text).slice(-250_000)
  }
  const outcome = await new Promise((resolvePromise) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: { ...process.env, CI: process.env.CI || 'true', NO_COLOR: '1' },
      shell: false,
      windowsHide: true,
    })
    activeChild = child
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.on('error', (error) => resolvePromise({ exitCode: null, signal: null, error: error.message }))
    child.on('close', (exitCode, signal) => resolvePromise({ exitCode, signal, error: undefined }))
  })
  activeChild = undefined
  sink.end()
  const combined = `${tail}\n${outcome.error ?? ''}`
  const category = outcome.exitCode === 0 ? undefined : classifyDependencyFailure(combined)
  return {
    phase,
    attempt,
    command: safeDependencyCommand(phase),
    status: outcome.exitCode === 0 ? 'passed' : interrupted ? 'interrupted' : 'failed',
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    category,
    retryable: category ? dependencyFailureIsRetryable(category) : false,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    logPath: pathFromRoot(logFile),
  }
}

async function executePhase(phase) {
  const attempts = []
  const allowedAttempts = phase === 'fetch' ? maximumAttempts : 1
  for (let attempt = 1; attempt <= allowedAttempts; attempt += 1) {
    const result = await executeAttempt(phase, attempt)
    attempts.push(result)
    console.log(`${result.status === 'passed' ? '✓' : '✗'} ${phase} attempt ${attempt} · ${(result.durationMs / 1000).toFixed(1)}s${result.category ? ` · ${result.category}` : ''}`)
    if (result.status === 'passed' || interrupted || !result.retryable || attempt === allowedAttempts) break
    const delay = retryDelayMs(attempt, baseDelayMs)
    console.log(`Retrying ${phase} after ${delay}ms`)
    await sleep(delay)
  }
  return attempts
}

async function writeReport(results, startedAt) {
  const finishedAt = new Date().toISOString()
  const finalResults = phases.map((phase) => [...results].reverse().find((item) => item.phase === phase)).filter(Boolean)
  const ok = finalResults.length === phases.length && finalResults.every((item) => item.status === 'passed')
  const report = {
    schemaVersion: 1,
    mode,
    ok,
    commit: process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '',
    workflowRunId: process.env.GITHUB_RUN_ID || '',
    nodeVersion: process.version,
    pnpmVersion: versionOf('pnpm'),
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    attempts: results,
  }
  const markdown = [
    '# RC Dependency Bootstrap',
    '',
    `- Status: **${ok ? 'passed' : 'failed'}**`,
    `- Mode: \`${mode}\``,
    `- Node: \`${report.nodeVersion}\``,
    `- pnpm: \`${report.pnpmVersion || 'unavailable'}\``,
    `- Duration: ${(report.durationMs / 1000).toFixed(1)}s`,
    '',
    '| Phase | Attempt | Status | Category | Duration | Log |',
    '| --- | ---: | --- | --- | ---: | --- |',
    ...results.map((item) => `| ${item.phase} | ${item.attempt} | ${item.status} | ${item.category ?? '-'} | ${(item.durationMs / 1000).toFixed(1)}s | \`${item.logPath}\` |`),
    '',
  ].join('\n')
  await mkdir(reportRoot, { recursive: true })
  await Promise.all([
    writeFile(resolve(runDirectory, 'summary.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }),
    writeFile(resolve(runDirectory, 'summary.md'), markdown, { mode: 0o600 }),
    writeFile(resolve(reportRoot, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 }),
    writeFile(resolve(reportRoot, 'latest.md'), markdown, { mode: 0o600 }),
  ])
  return report
}

console.log(`RC dependency bootstrap · mode=${mode} · attempts=${maximumAttempts}`)
for (const phase of phases) console.log(`- ${safeDependencyCommand(phase)}`)
if (planOnly) process.exit(0)

const startedAt = new Date().toISOString()
await mkdir(runDirectory, { recursive: true })
const results = []
for (const phase of phases) {
  const attempts = await executePhase(phase)
  results.push(...attempts)
  if (attempts.at(-1)?.status !== 'passed') break
}
const report = await writeReport(results, startedAt)
console.log(`Dependency report: ${pathFromRoot(resolve(reportRoot, 'latest.md'))}`)
if (!report.ok) process.exitCode = interrupted ? 130 : 1

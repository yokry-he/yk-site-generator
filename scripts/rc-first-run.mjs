import { spawn } from 'node:child_process'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { redactDependencyOutput, secretValuesFromEnvironment } from './lib/rc-dependencies.mjs'
import { sealFirstRunEvidence } from './lib/rc-first-run-evidence.mjs'
import {
  applyFirstRunStageResult,
  createFirstRunState,
  firstRunStageCommand,
  firstRunStageIds,
  gitContext,
  hostContext,
  prepareFirstRunResume,
  validateFirstRunRepository,
  validateGitContext,
  workstationIdentityEnvironment,
} from './lib/rc-first-run.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => args.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const booleanOf = (name) => args.includes(`--${name}`) || ['1', 'true', 'yes', 'on'].includes(valueOf(name).toLowerCase())
const profile = valueOf('profile', 'release')
const planOnly = args.includes('--plan')
const allowDirty = booleanOf('allow-dirty')
const allowDetached = booleanOf('allow-detached') || process.env.GITHUB_ACTIONS === 'true'
const expectedCommit = valueOf('expected-commit', process.env.GITHUB_SHA || '')
const resume = valueOf('resume')
const allowStaleResume = booleanOf('allow-stale-resume')
const forceUnlock = booleanOf('force-unlock')
const reportRoot = resolve(root, valueOf('report-dir', 'artifacts/rc-first-run'))
const workstationEnvironment = workstationIdentityEnvironment(process.env)
process.env.RC_WORKSTATION_UID = workstationEnvironment.RC_WORKSTATION_UID
process.env.RC_WORKSTATION_GID = workstationEnvironment.RC_WORKSTATION_GID
const secrets = secretValuesFromEnvironment(workstationEnvironment)
let interrupted = false
let activeChild

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    interrupted = true
    activeChild?.kill(signal)
  })
}

function relativePath(path) {
  return relative(root, path).replace(/\\/g, '/')
}

function render(state) {
  const lines = [
    '# RC First Real Run',
    '',
    `- Run: \`${state.runId}\``,
    `- Candidate: \`${state.candidateVersion}\``,
    `- Profile: \`${state.profile}\``,
    `- Commit: \`${state.commit}\``,
    `- Branch: \`${state.branch || '(detached)'}\``,
    `- Status: **${state.status}**`,
    `- Evidence: \`${state.evidence?.status || 'pending'}\``,
    '',
    '| Stage | Status | Attempts | Duration | Log |',
    '| --- | --- | ---: | ---: | --- |',
  ]
  for (const stage of state.stages) {
    const latest = stage.attempts.at(-1)
    lines.push(`| ${stage.id} | ${stage.status} | ${stage.attempts.length} | ${latest ? `${(latest.durationMs / 1000).toFixed(1)}s` : '-'} | ${latest?.logPath ? `\`${latest.logPath}\`` : '-'} |`)
  }
  lines.push('')
  if (state.evidence?.manifestPath) lines.push(`Evidence manifest: \`${state.evidence.manifestPath}\``, '')
  return `${lines.join('\n')}\n`
}

async function atomicJson(path, value) {
  const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, path)
}

async function persist(state, runDirectory) {
  await mkdir(runDirectory, { recursive: true })
  await Promise.all([
    atomicJson(resolve(runDirectory, 'state.json'), state),
    writeFile(resolve(runDirectory, 'summary.md'), render(state), { mode: 0o600 }),
    atomicJson(resolve(reportRoot, 'latest.json'), state),
    writeFile(resolve(reportRoot, 'latest.md'), render(state), { mode: 0o600 }),
  ])
}

function lineSink(path) {
  const stream = createWriteStream(path, { flags: 'a', mode: 0o600 })
  return {
    write(chunk) {
      const text = redactDependencyOutput(String(chunk), secrets)
      stream.write(text)
      process.stdout.write(text)
    },
    end() { return new Promise((resolvePromise) => stream.end(resolvePromise)) },
  }
}

async function executeStage(id, context, logPath) {
  const command = firstRunStageCommand(id, context)
  const sink = lineSink(logPath)
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const timeout = setTimeout(() => {
    sink.write(`\nFIRST_RUN_STAGE_TIMEOUT:${id}\n`)
    activeChild?.kill('SIGTERM')
    setTimeout(() => activeChild?.kill('SIGKILL'), 5_000).unref()
  }, command.timeoutMinutes * 60_000)
  const outcome = await new Promise((resolvePromise) => {
    const child = spawn(command.executable, command.args, { cwd: root, env: workstationEnvironment, shell: false, windowsHide: true })
    activeChild = child
    child.stdout?.on('data', (chunk) => sink.write(chunk))
    child.stderr?.on('data', (chunk) => sink.write(chunk))
    child.on('error', (error) => resolvePromise({ exitCode: null, signal: null, error: error.message }))
    child.on('close', (exitCode, signal) => resolvePromise({ exitCode, signal, error: undefined }))
  })
  clearTimeout(timeout)
  activeChild = undefined
  if (outcome.error) sink.write(`\n${outcome.error}\n`)
  await sink.end()
  return {
    status: outcome.exitCode === 0 ? 'passed' : interrupted ? 'interrupted' : 'failed',
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    exitCode: outcome.exitCode,
    signal: outcome.signal,
    logPath: relativePath(logPath),
  }
}

const validation = validateFirstRunRepository(root)
if (!validation.ok) {
  for (const finding of validation.issues) console.error(`${finding.code}: ${finding.message}`)
  process.exit(1)
}
const plan = validation.plan
const context = gitContext(root)
const gitIssues = validateGitContext(context, { expectedCommit, requiredBranch: plan.requiredBranch, allowDirty, allowDetached })
if (gitIssues.length) {
  for (const finding of gitIssues) console.error(`${finding.code}: ${finding.message}`)
  process.exit(1)
}
workstationEnvironment.CI_COMMIT_SHA = context.commit
process.env.CI_COMMIT_SHA = context.commit
const stageIds = firstRunStageIds(plan, profile)
const previewRunId = `${context.commit.slice(0, 12)}-YYYYMMDDTHHMMSS`
console.log(`RC first real run · profile=${profile} · commit=${context.commit}`)
console.log(`Workstation identity: ${workstationEnvironment.RC_WORKSTATION_UID}:${workstationEnvironment.RC_WORKSTATION_GID}`)
for (const id of stageIds) {
  const command = firstRunStageCommand(id, { runId: previewRunId, profile, externalStatus: 'unknown' })
  console.log(`- ${id}: ${command.executable} ${command.args.map((part) => JSON.stringify(part)).join(' ')}`)
}
if (planOnly) process.exit(0)

await mkdir(reportRoot, { recursive: true })
const lockPath = resolve(reportRoot, 'active.lock')
let lock
if (forceUnlock) await rm(lockPath, { force: true })
try {
  lock = await open(lockPath, 'wx', 0o600)
  await lock.writeFile(`${JSON.stringify({ pid: process.pid, commit: context.commit, startedAt: new Date().toISOString() })}\n`)
} catch (error) {
  console.error(`FIRST_RUN_ALREADY_ACTIVE:${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
}

try {
  let state
  let runDirectory
  if (resume) {
    const source = resume === 'latest' ? resolve(reportRoot, 'latest.json') : resolve(reportRoot, resume, 'state.json')
    if (!existsSync(source)) throw new Error(`FIRST_RUN_RESUME_NOT_FOUND:${relativePath(source)}`)
    state = JSON.parse(await readFile(source, 'utf8'))
    if (state.commit !== context.commit) throw new Error(`FIRST_RUN_RESUME_COMMIT_MISMATCH:${state.commit}:${context.commit}`)
    if (state.profile !== profile) throw new Error(`FIRST_RUN_RESUME_PROFILE_MISMATCH:${state.profile}:${profile}`)
    const ageHours = (Date.now() - Date.parse(state.startedAt)) / 3_600_000
    if (!allowStaleResume && ageHours > plan.maximumRunAgeHours) throw new Error(`FIRST_RUN_RESUME_EXPIRED:${ageHours.toFixed(1)}h`)
    prepareFirstRunResume(state)
    state.host = hostContext(root)
    runDirectory = resolve(reportRoot, state.runId)
  } else {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')
    const runId = `${context.commit.slice(0, 12)}-${timestamp}`
    state = createFirstRunState({ plan, profile, commit: context.commit, branch: context.branch, runId, host: hostContext(root) })
    runDirectory = resolve(reportRoot, runId)
  }
  const logDirectory = resolve(runDirectory, 'logs')
  await mkdir(logDirectory, { recursive: true })
  await persist(state, runDirectory)
  let failed = false
  for (const id of stageIds) {
    const stage = state.stages.find((item) => item.id === id)
    if (stage.status === 'passed') continue
    const always = plan.alwaysRun.includes(id)
    if (failed && !always) {
      stage.status = 'skipped'
      continue
    }
    const attempt = stage.attempts.length + 1
    const logPath = resolve(logDirectory, `${id.replace(/[^a-z0-9.-]+/gi, '_')}.attempt-${attempt}.log`)
    const result = await executeStage(id, { runId: state.runId, profile, externalStatus: failed ? 'failure' : 'success' }, logPath)
    applyFirstRunStageResult(state, id, result)
    if (result.status !== 'passed' && !always) failed = true
    await persist(state, runDirectory)
  }
  const requiredFailed = state.stages.some((stage) => !plan.alwaysRun.includes(stage.id) && stage.status !== 'passed')
  const cleanupFailed = state.stages.some((stage) => plan.alwaysRun.includes(stage.id) && stage.status === 'failed')
  state.status = interrupted ? 'interrupted' : requiredFailed || cleanupFailed ? 'failed' : 'passed'
  state.finishedAt = new Date().toISOString()
  state.evidence = { status: 'sealing' }
  await persist(state, runDirectory)
  try {
    const sealed = await sealFirstRunEvidence({ root, runDirectory, state })
    state.evidence = {
      status: 'sealed',
      manifestPath: sealed.manifestPath,
      checksumsPath: sealed.checksumsPath,
      manifestSha256: sealed.manifestSha256,
    }
  } catch (error) {
    state.status = 'failed'
    state.evidence = { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
  await persist(state, runDirectory)
  console.log(`RC first real run status: ${state.status}`)
  console.log(`Report: ${relativePath(resolve(runDirectory, 'summary.md'))}`)
  if (state.status !== 'passed') process.exitCode = interrupted ? 130 : 1
} finally {
  await lock?.close()
  await rm(lockPath, { force: true })
}

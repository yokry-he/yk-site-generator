import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { validateWorkstation } from './rc-workstation.mjs'

export const FIRST_RUN_PLAN_PATH = 'release/rc-first-run-plan.json'
export const RC_MANIFEST_PATH = 'release/rc-manifest.json'
export const RUNTIME_MATRIX_PATH = 'scripts/run-golden-matrix.ts'
export const FIRST_RUN_WORKFLOW_PATH = '.github/workflows/rc-first-real-run.yml'
export const GITIGNORE_PATH = '.gitignore'
export const FIRST_RUN_PROFILES = Object.freeze(['core', 'full', 'release'])
export const FIRST_RUN_ALWAYS_STAGES = Object.freeze(['triage', 'services-down'])

const COMPOSE_PATH = 'infra/rc-workstation/compose.yml'
const GOLDEN_PROJECTS = Object.freeze([
  'hono-drizzle-sqlite',
  'nestjs-prisma-postgresql',
  'fastapi-sqlalchemy-postgresql',
  'spring-boot-jpa-postgresql',
  'gin-gorm-postgresql',
])
const EVIDENCE_RESET_PATHS = Object.freeze([
  'artifacts/rc-preflight',
  'artifacts/rc-dependencies',
  'artifacts/rc-gates',
  'artifacts/rc-workflow-bootstrap',
  'artifacts/rc-triage',
  'artifacts/rc-matrix',
  'artifacts/golden-projects',
  'artifacts/security-audit.json',
  'artifacts/prompt-eval.json',
  'apps/web/playwright-report',
  'apps/web/test-results',
])

function issue(code, message, path) {
  return { severity: 'error', code, message, ...(path ? { path } : {}) }
}

function readJson(root, path, issues) {
  try {
    return JSON.parse(readFileSync(resolve(root, path), 'utf8'))
  } catch (error) {
    issues.push(issue('FIRST_RUN_JSON_INVALID', error instanceof Error ? error.message : String(error), path))
    return undefined
  }
}

export function validateFirstRunGitignore(source) {
  const lines = new Set(String(source ?? '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean))
  const issues = []
  for (const path of ['artifacts/', '.data/', 'apps/web/playwright-report/', 'apps/web/test-results/']) {
    if (!lines.has(path)) issues.push(issue('FIRST_RUN_GENERATED_PATH_NOT_IGNORED', `Generated first-run path ${path} must be ignored`, GITIGNORE_PATH))
  }
  return issues
}

export function validateRuntimeMatrixSource(source) {
  const value = String(source ?? '')
  const issues = []
  for (const token of ['RC_POSTGRES_HOST', 'RC_POSTGRES_PORT', 'RC_POSTGRES_USER', 'RC_POSTGRES_PASSWORD', 'RC_POSTGRES_ADMIN_DATABASE']) {
    if (!value.includes(token)) issues.push(issue('FIRST_RUN_POSTGRES_CONFIG_MISSING', `Runtime matrix does not read ${token}`, RUNTIME_MATRIX_PATH))
  }
  for (const forbidden of ['PGPASSWORD=siteforge psql -h 127.0.0.1', 'postgresql://siteforge:siteforge@127.0.0.1:5432']) {
    if (value.includes(forbidden)) issues.push(issue('FIRST_RUN_POSTGRES_HARDCODED', `Runtime matrix contains hard-coded PostgreSQL connection: ${forbidden}`, RUNTIME_MATRIX_PATH))
  }
  return issues
}

export function validateFirstRunWorkflowSource(source, plan) {
  const value = String(source ?? '')
  const issues = []
  const tokens = [
    "github.event.label.name == '" + plan.triggerLabel + "'",
    `github.event.pull_request.number == ${plan.pullRequestNumber}`,
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.pull_request.head.ref == '" + plan.requiredBranch + "'",
    'github.event.pull_request.head.sha || github.sha',
  ]
  for (const token of tokens) {
    if (!value.includes(token)) issues.push(issue('FIRST_RUN_WORKFLOW_GUARD_MISSING', `First-run workflow is missing guard ${token}`, FIRST_RUN_WORKFLOW_PATH))
  }
  if (!value.includes('timeout-minutes: 360')) issues.push(issue('FIRST_RUN_WORKFLOW_TIMEOUT_INVALID', 'First-run workflow must keep the 360-minute timeout', FIRST_RUN_WORKFLOW_PATH))
  return issues
}

export function validateFirstRunPlan(plan, rcManifest) {
  const issues = []
  if (!plan || typeof plan !== 'object') return [issue('FIRST_RUN_PLAN_INVALID', 'First-run plan must be an object', FIRST_RUN_PLAN_PATH)]
  if (plan.schemaVersion !== 1) issues.push(issue('FIRST_RUN_SCHEMA_UNSUPPORTED', `Expected schemaVersion 1, found ${plan.schemaVersion}`, FIRST_RUN_PLAN_PATH))
  if (plan.candidateVersion !== rcManifest?.candidateVersion) issues.push(issue('FIRST_RUN_CANDIDATE_MISMATCH', `First-run candidate ${plan.candidateVersion} does not match RC manifest ${rcManifest?.candidateVersion}`, FIRST_RUN_PLAN_PATH))
  if (!/^[A-Za-z0-9._/-]+$/.test(String(plan.requiredBranch ?? ''))) issues.push(issue('FIRST_RUN_BRANCH_INVALID', 'requiredBranch is missing or invalid', FIRST_RUN_PLAN_PATH))
  if (!Number.isInteger(plan.pullRequestNumber) || plan.pullRequestNumber < 1) issues.push(issue('FIRST_RUN_PR_NUMBER_INVALID', 'pullRequestNumber must be a positive integer', FIRST_RUN_PLAN_PATH))
  if (!/^[A-Za-z0-9._-]+$/.test(String(plan.triggerLabel ?? ''))) issues.push(issue('FIRST_RUN_TRIGGER_LABEL_INVALID', 'triggerLabel is missing or invalid', FIRST_RUN_PLAN_PATH))

  const alwaysRun = new Set(Array.isArray(plan.alwaysRun) ? plan.alwaysRun : [])
  for (const required of FIRST_RUN_ALWAYS_STAGES) if (!alwaysRun.has(required)) issues.push(issue('FIRST_RUN_ALWAYS_STAGE_MISSING', `alwaysRun must include ${required}`, FIRST_RUN_PLAN_PATH))

  for (const profile of FIRST_RUN_PROFILES) {
    const stages = plan.profiles?.[profile]
    if (!Array.isArray(stages) || !stages.length) {
      issues.push(issue('FIRST_RUN_PROFILE_MISSING', `Profile ${profile} is missing`, FIRST_RUN_PLAN_PATH))
      continue
    }
    if (new Set(stages).size !== stages.length) issues.push(issue('FIRST_RUN_STAGE_DUPLICATE', `Profile ${profile} contains duplicate stages`, FIRST_RUN_PLAN_PATH))
    if (stages.at(-1) !== 'services-down') issues.push(issue('FIRST_RUN_CLEANUP_ORDER', `Profile ${profile} must end with services-down`, FIRST_RUN_PLAN_PATH))
    if (stages.indexOf('triage') !== stages.length - 2) issues.push(issue('FIRST_RUN_TRIAGE_ORDER', `Profile ${profile} must run triage immediately before services-down`, FIRST_RUN_PLAN_PATH))
    const resetIndex = stages.indexOf('evidence-reset')
    const fingerprintIndex = stages.indexOf('workstation-fingerprint')
    const servicesIndex = stages.indexOf('services-up')
    if (resetIndex === -1 || resetIndex !== fingerprintIndex + 1 || resetIndex >= servicesIndex) {
      issues.push(issue('FIRST_RUN_EVIDENCE_RESET_ORDER', `Profile ${profile} must run evidence-reset after workstation-fingerprint and before services-up`, FIRST_RUN_PLAN_PATH))
    }
    for (const id of stages) if (!knownStage(id)) issues.push(issue('FIRST_RUN_STAGE_UNKNOWN', `Profile ${profile} references unknown stage ${id}`, FIRST_RUN_PLAN_PATH))
  }

  for (const profile of ['full', 'release']) {
    const stages = plan.profiles?.[profile] ?? []
    if (stages.indexOf('core-gates') === -1 || stages.indexOf('full-gates') <= stages.indexOf('core-gates')) {
      issues.push(issue('FIRST_RUN_GATE_ORDER', `Profile ${profile} must run incremental full-gates after core-gates`, FIRST_RUN_PLAN_PATH))
    }
  }
  for (const project of GOLDEN_PROJECTS) {
    if (!plan.profiles?.release?.includes(`golden:${project}`)) issues.push(issue('FIRST_RUN_GOLDEN_STAGE_MISSING', `Release profile is missing golden:${project}`, FIRST_RUN_PLAN_PATH))
  }
  return issues
}

export function validateFirstRunRepository(root = process.cwd()) {
  const issues = []
  for (const path of [FIRST_RUN_PLAN_PATH, RC_MANIFEST_PATH, RUNTIME_MATRIX_PATH, FIRST_RUN_WORKFLOW_PATH, GITIGNORE_PATH]) {
    if (!existsSync(resolve(root, path))) issues.push(issue('FIRST_RUN_FILE_MISSING', `Required first-run file ${path} is missing`, path))
  }
  if (issues.length) return { schemaVersion: 1, ok: false, issues }
  const plan = readJson(root, FIRST_RUN_PLAN_PATH, issues)
  const rcManifest = readJson(root, RC_MANIFEST_PATH, issues)
  if (plan && rcManifest) issues.push(...validateFirstRunPlan(plan, rcManifest))
  if (plan) issues.push(...validateFirstRunWorkflowSource(readFileSync(resolve(root, FIRST_RUN_WORKFLOW_PATH), 'utf8'), plan))
  issues.push(...validateRuntimeMatrixSource(readFileSync(resolve(root, RUNTIME_MATRIX_PATH), 'utf8')))
  issues.push(...validateFirstRunGitignore(readFileSync(resolve(root, GITIGNORE_PATH), 'utf8')))
  issues.push(...validateWorkstation(root).issues)
  return { schemaVersion: 1, ok: issues.length === 0, issues, plan, candidateVersion: plan?.candidateVersion }
}

function positiveIdentity(value, fallback = 10001) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function workstationIdentityEnvironment(environment = process.env, uid = typeof process.getuid === 'function' ? process.getuid() : 10001, gid = typeof process.getgid === 'function' ? process.getgid() : 10001) {
  return { ...environment, RC_WORKSTATION_UID: environment.RC_WORKSTATION_UID || String(positiveIdentity(uid)), RC_WORKSTATION_GID: environment.RC_WORKSTATION_GID || String(positiveIdentity(gid)) }
}

export function hostContext(root = process.cwd()) {
  const version = (command, args) => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true })
    return result.status === 0 ? (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] : ''
  }
  return { platform: process.platform, architecture: process.arch, node: process.version, docker: version('docker', ['--version']), compose: version('docker', ['compose', 'version']), workstationUid: process.env.RC_WORKSTATION_UID || '', workstationGid: process.env.RC_WORKSTATION_GID || '' }
}

export function gitContext(root = process.cwd()) {
  const run = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10_000, windowsHide: true })
  const head = run('rev-parse', 'HEAD')
  const branch = run('branch', '--show-current')
  const status = run('status', '--porcelain=v1', '--untracked-files=normal')
  return { available: head.status === 0, commit: head.status === 0 ? head.stdout.trim() : '', branch: branch.status === 0 ? branch.stdout.trim() : '', dirty: status.status === 0 ? Boolean(status.stdout.trim()) : true, detail: head.status === 0 ? '' : head.error?.message || head.stderr?.trim() || `git exited ${head.status}` }
}

export function validateGitContext(context, { expectedCommit = '', requiredBranch = '', allowDirty = false, allowDetached = false } = {}) {
  const issues = []
  if (!context.available) return [issue('FIRST_RUN_GIT_UNAVAILABLE', `Git metadata is unavailable: ${context.detail}`)]
  if (!/^[0-9a-f]{40}$/i.test(context.commit)) issues.push(issue('FIRST_RUN_COMMIT_INVALID', `Invalid Git commit ${context.commit || '(missing)'}`))
  if (expectedCommit && context.commit !== expectedCommit) issues.push(issue('FIRST_RUN_COMMIT_MISMATCH', `Expected ${expectedCommit}, found ${context.commit}`))
  if (!allowDirty && context.dirty) issues.push(issue('FIRST_RUN_WORKTREE_DIRTY', 'First real run requires a clean worktree'))
  if (!context.branch && !allowDetached) issues.push(issue('FIRST_RUN_DETACHED_HEAD', 'Detached HEAD requires --allow-detached or a CI environment'))
  if (requiredBranch && context.branch && context.branch !== requiredBranch) issues.push(issue('FIRST_RUN_BRANCH_MISMATCH', `Expected branch ${requiredBranch}, found ${context.branch}`))
  return issues
}

export function knownStage(id) {
  return ['contract', 'workstation-build', 'workstation-fingerprint', 'evidence-reset', 'services-up', 'dependencies', 'core-gates', 'mysql', 'redis', 'full-gates', 'triage', 'services-down'].includes(id) || /^golden:[a-z0-9-]+$/.test(id)
}

function shellLiteral(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}
function compose(...args) {
  return { executable: 'docker', args: ['compose', '-f', COMPOSE_PATH, ...args] }
}
function workstationShell(script, runId) {
  return compose('run', '--rm', '-e', `RC_FIRST_RUN_ID=${runId}`, 'workstation', 'bash', '-lc', script)
}

export function firstRunStageCommand(id, { runId = 'plan', profile = 'release', externalStatus = 'unknown' } = {}) {
  const runtimeDirectory = 'artifacts/rc-first-run/${RC_FIRST_RUN_ID}/runtime'
  const common = `set -euo pipefail; mkdir -p "${runtimeDirectory}"`
  if (id === 'contract') return { executable: 'node', args: ['--test', 'scripts/rc-first-run.test.mjs'], timeoutMinutes: 5 }
  if (id === 'workstation-build') return { ...compose('build', 'workstation'), timeoutMinutes: 45 }
  if (id === 'workstation-fingerprint') {
    const directory = `artifacts/rc-first-run/${runId}`
    const output = `${directory}/workstation-image.json`
    const checksums = `${directory}/workstation-inputs.sha256`
    const script = `set -euo pipefail; mkdir -p ${shellLiteral(directory)}; image_id=$(docker compose -f ${shellLiteral(COMPOSE_PATH)} images -q workstation); test -n "$image_id"; docker image inspect "$image_id" > ${shellLiteral(output)}; sha256sum infra/rc-workstation/Dockerfile infra/rc-workstation/compose.yml infra/rc-workstation/images.lock.json > ${shellLiteral(checksums)}`
    return { executable: 'bash', args: ['-lc', script], timeoutMinutes: 5 }
  }
  if (id === 'evidence-reset') {
    const targets = EVIDENCE_RESET_PATHS.map(shellLiteral).join(' ')
    return { executable: 'bash', args: ['-lc', `set -euo pipefail; rm -rf ${targets}; mkdir -p artifacts`], timeoutMinutes: 5 }
  }
  if (id === 'services-up') return { ...compose('up', '-d', '--wait', 'mysql', 'postgres', 'redis'), timeoutMinutes: 10 }
  if (id === 'dependencies') return { ...workstationShell(`${common}; pnpm rc:deps`, runId), timeoutMinutes: 30 }
  if (id === 'core-gates') return { ...workstationShell(`${common}; pnpm rc:gates:core`, runId), timeoutMinutes: 60 }
  if (id === 'full-gates') return { ...workstationShell(`${common}; pnpm rc:gates:full --only=history,browser,visual`, runId), timeoutMinutes: 60 }
  if (id === 'mysql') return { ...workstationShell(`${common}; NODE_ENV=development DATA_STORAGE_DRIVER=mysql MYSQL_SSL_MODE=disabled AUTH_JWT_SECRET=first-run-mysql-auth-secret-2026 pnpm --filter server db:mysql:ci`, runId), timeoutMinutes: 30 }
  if (id === 'redis') {
    const authEnvironment = 'NODE_ENV=development AUTH_DISTRIBUTED_LIMIT_DRIVER=redis AUTH_RATE_LIMIT_FAIL_MODE=closed AUTH_MAX_VERIFY_FAILURES=3 AUTH_JWT_SECRET=first-run-redis-jwt-secret-2026 AUTH_RATE_LIMIT_HASH_KEY=first-run-redis-hash-secret-2026'
    const script = `${common}; pnpm --filter server build; ${authEnvironment} PORT=8787 DATA_STORAGE_FILE="${runtimeDirectory}/redis-a.json" node apps/server/dist/index.js > "${runtimeDirectory}/redis-a.log" 2>&1 & a=$!; ${authEnvironment} PORT=8788 DATA_STORAGE_FILE="${runtimeDirectory}/redis-b.json" node apps/server/dist/index.js > "${runtimeDirectory}/redis-b.log" 2>&1 & b=$!; cleanup(){ kill "$a" "$b" 2>/dev/null || true; }; trap cleanup EXIT; for port in 8787 8788; do for attempt in $(seq 1 45); do curl -fsS "http://127.0.0.1:\${port}/api/health/live" >/dev/null && break; kill -0 "$a" 2>/dev/null && kill -0 "$b" 2>/dev/null || exit 1; test "\$attempt" -lt 45 || exit 1; sleep 1; done; done; pnpm rc:redis`
    return { ...workstationShell(script, runId), timeoutMinutes: 30 }
  }
  if (id.startsWith('golden:')) {
    const project = id.slice('golden:'.length)
    if (!GOLDEN_PROJECTS.includes(project)) throw new Error(`UNKNOWN_FIRST_RUN_GOLDEN_PROJECT:${project}`)
    return { ...workstationShell(`${common}; pnpm rc:golden; pnpm rc:matrix --project ${project}`, runId), timeoutMinutes: 60 }
  }
  if (id === 'triage') return { executable: 'node', args: ['scripts/rc-triage.mjs', '--source-root=artifacts', `--report-dir=artifacts/rc-triage/first-run-${runId}`, `--scope=first-run-${profile}`, '--allow-missing', '--fail-on=never', '--exclude=rc-first-run', `--external-status=first-run:${externalStatus}`], timeoutMinutes: 5 }
  if (id === 'services-down') return { ...compose('down', '--remove-orphans'), timeoutMinutes: 10 }
  throw new Error(`UNKNOWN_FIRST_RUN_STAGE:${id}`)
}

export function createFirstRunState({ plan, profile, commit, branch, runId, host = {}, startedAt = new Date().toISOString() }) {
  return { schemaVersion: 1, runId, candidateVersion: plan.candidateVersion, profile, commit, branch, host, startedAt, finishedAt: null, status: 'running', stages: plan.profiles[profile].map((id) => ({ id, status: 'pending', attempts: [] })) }
}
export function applyFirstRunStageResult(state, stageId, result) {
  const stage = state.stages.find((item) => item.id === stageId)
  if (!stage) throw new Error(`FIRST_RUN_STAGE_NOT_IN_STATE:${stageId}`)
  stage.status = result.status
  stage.attempts.push({ ...result })
  return state
}
export function prepareFirstRunResume(state) {
  const firstFailure = state.stages.findIndex((stage) => stage.status !== 'passed')
  const resetAnchor = state.stages.findIndex((stage) => stage.id === 'evidence-reset')
  const resetFrom = firstFailure === -1 ? state.stages.length : Math.min(firstFailure, resetAnchor === -1 ? firstFailure : resetAnchor)
  state.stages.forEach((stage, index) => { if (index >= resetFrom) stage.status = 'pending' })
  state.status = 'running'
  state.finishedAt = null
  return state
}
export function firstRunStageIds(plan, profile) {
  if (!FIRST_RUN_PROFILES.includes(profile)) throw new Error(`UNKNOWN_FIRST_RUN_PROFILE:${profile}`)
  return [...plan.profiles[profile]]
}

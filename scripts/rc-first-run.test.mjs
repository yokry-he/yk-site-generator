import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  applyFirstRunStageResult,
  createFirstRunState,
  firstRunStageCommand,
  prepareFirstRunResume,
  validateFirstRunGitignore,
  validateFirstRunPlan,
  validateFirstRunWorkflowSource,
  validateGitContext,
  validateRuntimeMatrixSource,
  workstationIdentityEnvironment,
} from './lib/rc-first-run.mjs'

const root = resolve(import.meta.dirname, '..')
const plan = JSON.parse(readFileSync(resolve(root, 'release/rc-first-run-plan.json'), 'utf8'))
const rcManifest = JSON.parse(readFileSync(resolve(root, 'release/rc-manifest.json'), 'utf8'))

test('first-run plan matches the RC candidate and resets evidence plus service volumes before startup', () => {
  assert.deepEqual(validateFirstRunPlan(plan, rcManifest), [])
  for (const stages of Object.values(plan.profiles)) {
    const fingerprint = stages.indexOf('workstation-fingerprint')
    assert.deepEqual(stages.slice(fingerprint + 1, fingerprint + 4), ['evidence-reset', 'services-reset', 'services-up'])
    assert.equal(stages.at(-2), 'triage')
    assert.equal(stages.at(-1), 'services-down')
  }
})

test('runtime matrix rejects localhost-only PostgreSQL wiring', () => {
  assert.ok(validateRuntimeMatrixSource('PGPASSWORD=siteforge psql -h 127.0.0.1').some((item) => item.code === 'FIRST_RUN_POSTGRES_HARDCODED'))
  const source = ['RC_POSTGRES_HOST', 'RC_POSTGRES_PORT', 'RC_POSTGRES_USER', 'RC_POSTGRES_PASSWORD', 'RC_POSTGRES_ADMIN_DATABASE'].join('\n')
  assert.deepEqual(validateRuntimeMatrixSource(source), [])
})

test('first-run generated paths remain outside Git worktree evidence', () => {
  const source = ['artifacts/', '.data/', 'apps/web/playwright-report/', 'apps/web/test-results/'].join('\n')
  assert.deepEqual(validateFirstRunGitignore(source), [])
  assert.ok(validateFirstRunGitignore('node_modules/').some((item) => item.code === 'FIRST_RUN_GENERATED_PATH_NOT_IGNORED'))
})

test('Git context enforces clean exact-commit runs', () => {
  const context = { available: true, commit: 'a'.repeat(40), branch: 'Feature-dev-v0.1.0', dirty: false, detail: '' }
  assert.deepEqual(validateGitContext(context, { expectedCommit: 'a'.repeat(40), requiredBranch: 'Feature-dev-v0.1.0' }), [])
  assert.ok(validateGitContext({ ...context, dirty: true }, {}).some((item) => item.code === 'FIRST_RUN_WORKTREE_DIRTY'))
})

test('Workstation identity follows a non-root host and preserves explicit overrides', () => {
  assert.deepEqual(workstationIdentityEnvironment({}, 1001, 121), { RC_WORKSTATION_UID: '1001', RC_WORKSTATION_GID: '121' })
  assert.deepEqual(workstationIdentityEnvironment({ RC_WORKSTATION_UID: '2000', RC_WORKSTATION_GID: '2001' }, 1001, 121), { RC_WORKSTATION_UID: '2000', RC_WORKSTATION_GID: '2001' })
  assert.equal(workstationIdentityEnvironment({}, 0, 0).RC_WORKSTATION_UID, '10001')
})

test('full gates are incremental, triage excludes state, and service cleanup removes volumes', () => {
  const full = firstRunStageCommand('full-gates', { runId: 'test' })
  assert.match(full.args.join(' '), /--only=history,browser,visual/)
  const triage = firstRunStageCommand('triage', { runId: 'test' })
  assert.ok(triage.args.includes('--exclude=rc-first-run'))
  assert.ok(firstRunStageCommand('services-reset', { runId: 'test' }).args.includes('--volumes'))
  assert.ok(firstRunStageCommand('services-down', { runId: 'test' }).args.includes('--volumes'))
})

test('evidence reset preserves first-run state but removes shared diagnostics', () => {
  const reset = firstRunStageCommand('evidence-reset', { runId: 'test' })
  const command = reset.args.join(' ')
  assert.match(command, /artifacts\/rc-gates/)
  assert.doesNotMatch(command, /artifacts\/rc-first-run(?:\s|'|$)/)
})

test('configured runtime dependencies are isolated to the current run', () => {
  const mysql = firstRunStageCommand('mysql', { runId: 'test' })
  assert.match(mysql.args.join(' '), /db:mysql:ci/)
  const redis = firstRunStageCommand('redis', { runId: 'test' })
  const redisCommand = redis.args.join(' ')
  assert.match(redisCommand, /runtime\/redis-a\.json/)
  assert.match(redisCommand, /AUTH_DISTRIBUTED_LIMIT_DRIVER=redis/)
  assert.match(redisCommand, /AUTH_RATE_LIMIT_FAIL_MODE=closed/)
  assert.match(redisCommand, /AUTH_MAX_VERIFY_FAILURES=3/)
  assert.doesNotMatch(redisCommand, /\.data\/first-run-redis/)
  const golden = firstRunStageCommand('golden:nestjs-prisma-postgresql', { runId: 'test' })
  assert.match(golden.args.join(' '), /rc:matrix --project nestjs-prisma-postgresql/)
})

test('resume restarts from evidence reset without rebuilding the image', () => {
  const state = createFirstRunState({ plan, profile: 'core', commit: 'b'.repeat(40), branch: 'Feature-dev-v0.1.0', runId: 'run' })
  for (const id of ['contract', 'workstation-build', 'workstation-fingerprint', 'evidence-reset', 'services-reset', 'services-up', 'dependencies']) applyFirstRunStageResult(state, id, { status: 'passed' })
  applyFirstRunStageResult(state, 'core-gates', { status: 'failed' })
  applyFirstRunStageResult(state, 'services-down', { status: 'passed' })
  state.evidence = { status: 'sealed' }
  prepareFirstRunResume(state)
  assert.equal(state.stages.find((item) => item.id === 'workstation-build').status, 'passed')
  assert.equal(state.stages.find((item) => item.id === 'workstation-fingerprint').status, 'passed')
  assert.equal(state.stages.find((item) => item.id === 'evidence-reset').status, 'pending')
  assert.equal(state.stages.find((item) => item.id === 'services-reset').status, 'pending')
  assert.equal(state.stages.find((item) => item.id === 'services-down').status, 'pending')
  assert.equal(state.evidence, undefined)
})

test('label trigger is restricted to the long-lived same-repository PR and verifies the seal', () => {
  const workflow = [
    "github.event.label.name == 'rc-first-run'",
    'github.event.pull_request.number == 44',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.pull_request.head.ref == 'Feature-dev-v0.1.0'",
    'github.event.pull_request.head.sha || github.sha',
    'node scripts/rc-first-run-evidence.mjs --run=latest',
    'timeout-minutes: 360',
  ].join('\n')
  assert.deepEqual(validateFirstRunWorkflowSource(workflow, plan), [])
  assert.ok(validateFirstRunWorkflowSource("github.event.label.name == 'rc-first-run'", plan).length > 0)
})

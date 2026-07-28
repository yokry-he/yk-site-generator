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
  validateGitContext,
  validateRuntimeMatrixSource,
  workstationIdentityEnvironment,
} from './lib/rc-first-run.mjs'

const root = resolve(import.meta.dirname, '..')
const plan = JSON.parse(readFileSync(resolve(root, 'release/rc-first-run-plan.json'), 'utf8'))
const rcManifest = JSON.parse(readFileSync(resolve(root, 'release/rc-manifest.json'), 'utf8'))

test('first-run plan matches the RC candidate and contains ordered cleanup', () => {
  assert.deepEqual(validateFirstRunPlan(plan, rcManifest), [])
  assert.ok(plan.profiles.release.includes('workstation-fingerprint'))
  assert.equal(plan.profiles.release.at(-2), 'triage')
  assert.equal(plan.profiles.release.at(-1), 'services-down')
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
  assert.deepEqual(
    workstationIdentityEnvironment({}, 1001, 121),
    { RC_WORKSTATION_UID: '1001', RC_WORKSTATION_GID: '121' },
  )
  assert.deepEqual(
    workstationIdentityEnvironment({ RC_WORKSTATION_UID: '2000', RC_WORKSTATION_GID: '2001' }, 1001, 121),
    { RC_WORKSTATION_UID: '2000', RC_WORKSTATION_GID: '2001' },
  )
  assert.equal(workstationIdentityEnvironment({}, 0, 0).RC_WORKSTATION_UID, '10001')
})

test('release plan commands use Workstation services and configured runtime dependencies', () => {
  const fingerprint = firstRunStageCommand('workstation-fingerprint', { runId: 'test' })
  assert.match(fingerprint.args.join(' '), /workstation-image\.json/)
  const mysql = firstRunStageCommand('mysql', { runId: 'test' })
  assert.equal(mysql.executable, 'docker')
  assert.match(mysql.args.join(' '), /db:mysql:ci/)
  const redis = firstRunStageCommand('redis', { runId: 'test' })
  const redisCommand = redis.args.join(' ')
  assert.match(redisCommand, /AUTH_DISTRIBUTED_LIMIT_DRIVER=redis/)
  assert.match(redisCommand, /AUTH_RATE_LIMIT_FAIL_MODE=closed/)
  assert.match(redisCommand, /AUTH_MAX_VERIFY_FAILURES=3/)
  assert.match(redisCommand, /AUTH_RATE_LIMIT_HASH_KEY=first-run-redis-hash-secret-2026/)
  const golden = firstRunStageCommand('golden:nestjs-prisma-postgresql', { runId: 'test' })
  assert.match(golden.args.join(' '), /rc:matrix --project nestjs-prisma-postgresql/)
})

test('resume restarts services and all later stages after cleanup', () => {
  const state = createFirstRunState({ plan, profile: 'core', commit: 'b'.repeat(40), branch: 'Feature-dev-v0.1.0', runId: 'run' })
  for (const id of ['contract', 'workstation-build', 'workstation-fingerprint', 'services-up', 'dependencies']) applyFirstRunStageResult(state, id, { status: 'passed' })
  applyFirstRunStageResult(state, 'core-gates', { status: 'failed' })
  applyFirstRunStageResult(state, 'services-down', { status: 'passed' })
  prepareFirstRunResume(state)
  assert.equal(state.stages.find((item) => item.id === 'workstation-build').status, 'passed')
  assert.equal(state.stages.find((item) => item.id === 'services-up').status, 'pending')
  assert.equal(state.stages.find((item) => item.id === 'services-down').status, 'pending')
})

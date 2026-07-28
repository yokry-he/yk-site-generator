import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { sealFirstRunEvidence } from './lib/rc-first-run-evidence.mjs'
import { validateRcReleaseWorkflowSource, verifyRcFirstRunAdmission } from './lib/rc-release-admission.mjs'

const commit = 'c'.repeat(40)
const candidateVersion = '0.1.0-rc.1'
const workflowRunId = '987654321'
const repository = 'yokry-he/yk-site-generator'
const artifactName = `rc-first-real-run-release-${commit}`

function environment() {
  return {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: repository,
    GITHUB_WORKFLOW: 'RC First Real Run',
    GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/rc-first-real-run.yml@refs/heads/Feature-dev-v0.1.0`,
    GITHUB_RUN_ID: workflowRunId,
    GITHUB_RUN_ATTEMPT: '1',
    RC_FIRST_RUN_ARTIFACT_NAME: artifactName,
  }
}

async function fixture({ status = 'passed', profile = 'release', p0 = 0, p1 = 0, blockers = p0 + p1 } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'siteforge-admission-'))
  const runId = `${commit.slice(0, 12)}-20260728T120000Z`
  const runDirectory = resolve(root, 'artifacts/rc-first-run', runId)
  const triageDirectory = resolve(root, 'artifacts/rc-triage', `first-run-${runId}`)
  for (const path of ['release', 'infra/rc-workstation', `${runDirectory}/logs`, triageDirectory]) await mkdir(path.startsWith(root) ? path : resolve(root, path), { recursive: true })
  for (const path of ['release/rc-first-run-plan.json', 'release/rc-manifest.json', 'infra/rc-workstation/Dockerfile', 'infra/rc-workstation/compose.yml', 'infra/rc-workstation/images.lock.json']) await writeFile(resolve(root, path), `${path}\n`)
  await writeFile(resolve(runDirectory, 'workstation-image.json'), '{}\n')
  await writeFile(resolve(runDirectory, 'workstation-inputs.sha256'), 'abc  input\n')
  const logPath = `artifacts/rc-first-run/${runId}/logs/contract.attempt-1.log`
  await writeFile(resolve(root, logPath), 'passed\n')
  const triage = {
    schemaVersion: 1,
    scope: 'first-run-release',
    commit,
    workflowRunId,
    status: blockers ? 'blocked' : p0 || p1 ? 'blocked' : 'clear',
    counts: { P0: p0, P1: p1, P2: 0, P3: 0 },
    blockers,
    findings: [],
    nextActions: [],
  }
  await writeFile(resolve(triageDirectory, 'latest.json'), `${JSON.stringify(triage, null, 2)}\n`)
  const state = {
    schemaVersion: 1,
    runId,
    candidateVersion,
    profile,
    commit,
    status,
    stages: [{ id: 'contract', status: 'passed', attempts: [{ logPath }] }],
  }
  await sealFirstRunEvidence({ root, runDirectory, state, environment: environment() })
  await mkdir(resolve(root, 'artifacts/rc-first-run'), { recursive: true })
  await writeFile(resolve(root, 'artifacts/rc-first-run/latest.json'), `${JSON.stringify(state, null, 2)}\n`)
  return { root, runId, runDirectory }
}

function options(root, overrides = {}) {
  return {
    root,
    run: 'latest',
    candidateVersion,
    commit,
    workflowRunId,
    repository,
    artifactName,
    ...overrides,
  }
}

test('release admission accepts one exact passed release first-run artifact', async () => {
  const { root, runId } = await fixture()
  const result = await verifyRcFirstRunAdmission(options(root))
  assert.equal(result.ok, true)
  assert.equal(result.runId, runId)
  assert.equal(result.admission.integrityAlgorithm, 'sha256')
  assert.equal(result.admission.authentication, 'github-actions-run-and-artifact-source')
  assert.equal(result.admission.triageCounts.P0, 0)
  assert.equal(result.admission.triageCounts.P1, 0)
})

test('release admission rejects non-release or failed first-run state', async () => {
  const profileFixture = await fixture({ profile: 'full' })
  const profileResult = await verifyRcFirstRunAdmission(options(profileFixture.root))
  assert.ok(profileResult.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_PROFILE_BLOCKED'))

  const failedFixture = await fixture({ status: 'failed' })
  const failedResult = await verifyRcFirstRunAdmission(options(failedFixture.root))
  assert.ok(failedResult.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_STATUS_BLOCKED'))
})

test('release admission rejects sealed P0 or P1 triage findings', async () => {
  const p0Fixture = await fixture({ p0: 1 })
  const p0Result = await verifyRcFirstRunAdmission(options(p0Fixture.root))
  assert.ok(p0Result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_TRIAGE_P0_BLOCKED'))

  const p1Fixture = await fixture({ p1: 2 })
  const p1Result = await verifyRcFirstRunAdmission(options(p1Fixture.root))
  assert.ok(p1Result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_TRIAGE_P1_BLOCKED'))
})

test('release admission rejects mismatched GitHub run and artifact source', async () => {
  const { root } = await fixture()
  const result = await verifyRcFirstRunAdmission(options(root, { workflowRunId: '123', artifactName: 'wrong-artifact' }))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_WORKFLOW_RUN_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_ARTIFACT_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_TRIAGE_RUN_MISMATCH'))
})

test('release admission refuses tampered sealed files even when metadata matches', async () => {
  const { root, runDirectory } = await fixture()
  await writeFile(resolve(runDirectory, 'logs/contract.attempt-1.log'), 'tampered\n')
  const result = await verifyRcFirstRunAdmission(options(root))
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_EVIDENCE_DIGEST_MISMATCH'))
})

test('first-run triage metadata prefers the candidate commit over pull-request merge SHA', async () => {
  const source = await readFile(resolve(import.meta.dirname, 'rc-triage.mjs'), 'utf8')
  assert.match(source, /commit: process\.env\.CI_COMMIT_SHA \|\| process\.env\.GITHUB_SHA/)
})

test('release workflow contract pins source run and artifact before assembly', async () => {
  const workflow = await readFile(resolve(import.meta.dirname, '../.github/workflows/rc-release.yml'), 'utf8')
  assert.deepEqual(validateRcReleaseWorkflowSource(workflow), [])
})

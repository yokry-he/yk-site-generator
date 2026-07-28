import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { sealFirstRunEvidence } from './lib/rc-first-run-evidence.mjs'
import {
  validateRcReleaseWorkflowSource,
  validateRcSignedGateMetadata,
  verifyRcFirstRunAdmission,
} from './lib/rc-release-admission.mjs'

const commit = 'c'.repeat(40)
const candidateVersion = '0.1.0-rc.1'
const workflowRunId = '987654321'
const workflowRunAttempt = 2
const repository = 'yokry-he/yk-site-generator'
const artifactName = `rc-first-real-run-release-${commit}-attempt-${workflowRunAttempt}`
const artifactId = 123456789
const artifactDigest = `sha256:${'d'.repeat(64)}`
const artifactSizeBytes = 4096
const trustedNow = Date.now()
const workflowCreatedAt = new Date(trustedNow - 5 * 60_000).toISOString()
const artifactCreatedAt = new Date(trustedNow + 60_000).toISOString()
const artifactExpiresAt = new Date(trustedNow + 30 * 24 * 3_600_000).toISOString()

function environment() {
  return {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: repository,
    GITHUB_WORKFLOW: 'RC First Real Run',
    GITHUB_WORKFLOW_REF: `${repository}/.github/workflows/rc-first-real-run.yml@refs/heads/Feature-dev-v0.1.0`,
    GITHUB_RUN_ID: workflowRunId,
    GITHUB_RUN_ATTEMPT: String(workflowRunAttempt),
    RC_FIRST_RUN_ARTIFACT_NAME: artifactName,
  }
}

async function fixture({ status = 'passed', profile = 'release', p0 = 0, p1 = 0, blockers = p0 + p1 } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'siteforge-admission-'))
  const runId = `${commit.slice(0, 12)}-20260729T120000Z`
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
    workflowRunAttempt,
    workflowCreatedAt,
    repository,
    workflowName: 'RC First Real Run',
    artifactName,
    artifactId,
    artifactDigest,
    artifactSizeBytes,
    artifactCreatedAt,
    artifactExpiresAt,
    maximumAgeHours: 24,
    now: trustedNow,
    ...overrides,
  }
}

function gate(gate, overrides = {}) {
  return {
    schemaVersion: 1,
    candidateVersion,
    gate,
    status: 'passed',
    trusted: true,
    source: 'github-actions',
    commit,
    runId: '777',
    workflowRunAttempt: 3,
    repository,
    workflowPath: '.github/workflows/rc-release.yml',
    observedAt: new Date(trustedNow - 60_000).toISOString(),
    signature: 'signed',
    ...overrides,
  }
}

function gateOptions(rows, overrides = {}) {
  return {
    rows,
    requiredGates: ['build', 'unit'],
    allowedSources: ['github-actions', 'isolated-runner'],
    candidateVersion,
    commit,
    expectedSource: 'github-actions',
    workflowRunId: '777',
    workflowRunAttempt: 3,
    repository,
    workflowPath: '.github/workflows/rc-release.yml',
    maximumEvidenceAgeHours: 24,
    now: trustedNow,
    ...overrides,
  }
}

test('release admission accepts one exact passed release first-run artifact identity', async () => {
  const { root, runId } = await fixture()
  const result = await verifyRcFirstRunAdmission(options(root))
  assert.equal(result.ok, true)
  assert.equal(result.runId, runId)
  assert.equal(result.admission.integrityAlgorithm, 'sha256')
  assert.equal(result.admission.authentication, 'github-actions-run-attempt-and-artifact-identity')
  assert.equal(result.admission.workflowRunAttempt, workflowRunAttempt)
  assert.equal(result.admission.artifactId, artifactId)
  assert.equal(result.admission.artifactDigest, artifactDigest)
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

test('release admission rejects mismatched GitHub run attempt and artifact source', async () => {
  const { root } = await fixture()
  const result = await verifyRcFirstRunAdmission(options(root, {
    workflowRunId: '123',
    workflowRunAttempt: 9,
    artifactName: 'wrong-artifact',
  }))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_WORKFLOW_RUN_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_WORKFLOW_ATTEMPT_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_ARTIFACT_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_TRIAGE_RUN_MISMATCH'))
})

test('release admission rejects invalid, expired, or stale artifact identity', async () => {
  const { root } = await fixture()
  const invalid = await verifyRcFirstRunAdmission(options(root, { artifactDigest: 'sha256:bad' }))
  assert.ok(invalid.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_ARTIFACT_DIGEST_INVALID'))

  const expired = await verifyRcFirstRunAdmission(options(root, { artifactExpiresAt: new Date(trustedNow - 1).toISOString() }))
  assert.ok(expired.issues.some((item) => item.code === 'FIRST_RUN_ADMISSION_ARTIFACT_EXPIRED'))

  const stale = await verifyRcFirstRunAdmission(options(root, { now: trustedNow + 48 * 3_600_000 }))
  assert.ok(stale.issues.some((item) => item.code.endsWith('_STALE')))
})

test('release admission refuses tampered sealed files even when metadata matches', async () => {
  const { root, runDirectory } = await fixture()
  await writeFile(resolve(runDirectory, 'logs/contract.attempt-1.log'), 'tampered\n')
  const result = await verifyRcFirstRunAdmission(options(root))
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_EVIDENCE_DIGEST_MISMATCH'))
})

test('signed gate metadata requires one current release workflow attempt', () => {
  const result = validateRcSignedGateMetadata(gateOptions([gate('build'), gate('unit')]))
  assert.equal(result.ok, true)
  assert.equal(result.rowsByGate.build.workflowRunAttempt, 3)
})

test('signed gate metadata rejects mixed attempts, unexpected gates, duplicates, and stale rows', () => {
  const result = validateRcSignedGateMetadata(gateOptions([
    gate('build'),
    gate('unit', { workflowRunAttempt: 4 }),
    gate('unexpected'),
    gate('build'),
  ]))
  assert.ok(result.issues.some((item) => item.code === 'RC_SIGNED_GATE_WORKFLOW_ATTEMPT_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'RC_SIGNED_GATE_UNEXPECTED'))
  assert.ok(result.issues.some((item) => item.code === 'RC_SIGNED_GATE_DUPLICATE'))

  const stale = validateRcSignedGateMetadata(gateOptions([
    gate('build', { observedAt: new Date(trustedNow - 48 * 3_600_000).toISOString() }),
    gate('unit'),
  ]))
  assert.ok(stale.issues.some((item) => item.code === 'RC_SIGNED_GATE_OBSERVED_AT_STALE'))
})

test('first-run triage metadata prefers the candidate commit over pull-request merge SHA', async () => {
  const source = await readFile(resolve(import.meta.dirname, 'rc-triage.mjs'), 'utf8')
  assert.match(source, /commit: process\.env\.CI_COMMIT_SHA \|\| process\.env\.GITHUB_SHA/)
})

test('release workflow contract pins source artifact identity and release attempt before assembly', async () => {
  const workflow = await readFile(resolve(import.meta.dirname, '../.github/workflows/rc-release.yml'), 'utf8')
  assert.deepEqual(validateRcReleaseWorkflowSource(workflow), [])
})

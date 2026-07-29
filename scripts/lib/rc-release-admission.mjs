import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { FIRST_RUN_WORKFLOW_PATH, verifyFirstRunEvidence } from './rc-first-run-evidence.mjs'

const CLOCK_SKEW_MS = 300_000

function issue(code, message, path) {
  return { code, message, ...(path ? { path } : {}) }
}

function safeRunId(value) {
  const runId = String(value ?? '').trim()
  if (!runId || runId.includes('/') || runId.includes('\\') || runId === '.' || runId === '..') throw new Error(`FIRST_RUN_ADMISSION_RUN_ID_INVALID:${value}`)
  return runId
}

function positiveInteger(value) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function validRepository(value) {
  return /^[^/\s]+\/[^/\s]+$/.test(String(value ?? ''))
}

function validWorkflowPath(value) {
  return /^\.github\/workflows\/[A-Za-z0-9._/-]+\.ya?ml$/.test(String(value ?? ''))
}

function timestamp(issues, { code, value, now, maximumAgeMs, path }) {
  const parsed = Date.parse(String(value ?? ''))
  if (!Number.isFinite(parsed)) {
    issues.push(issue(`${code}_INVALID`, `${code.toLowerCase().replaceAll('_', ' ')} is invalid`, path))
    return Number.NaN
  }
  if (parsed > now + CLOCK_SKEW_MS) issues.push(issue(`${code}_FUTURE`, `${code.toLowerCase().replaceAll('_', ' ')} is in the future`, path))
  if (Number.isFinite(maximumAgeMs) && now - parsed > maximumAgeMs) issues.push(issue(`${code}_STALE`, `${code.toLowerCase().replaceAll('_', ' ')} is older than the admission window`, path))
  return parsed
}

async function resolveRunId(root, requested) {
  if (requested && requested !== 'latest') return safeRunId(requested)
  const latestPath = resolve(root, 'artifacts/rc-first-run/latest.json')
  if (!existsSync(latestPath)) throw new Error('FIRST_RUN_ADMISSION_LATEST_MISSING')
  const latest = JSON.parse(await readFile(latestPath, 'utf8'))
  return safeRunId(latest.runId)
}

function hasListedFile(manifest, path) {
  return Array.isArray(manifest?.files) && manifest.files.some((item) => item?.path === path)
}

export function validateRcReleaseWorkflowSource(source) {
  const value = String(source ?? '')
  const required = [
    'first_run_workflow_run_id:',
    'actions: read',
    'actions/github-script@v7',
    'getWorkflowRun',
    'listWorkflowRunArtifacts',
    'run.run_attempt',
    'artifact.id',
    'artifact.digest',
    'artifact.size_in_bytes',
    'artifact.created_at',
    'artifact.expires_at',
    "runPath = String(run.path || '').split('@')[0]",
    'expectedArtifactName = `rc-first-real-run-release-${context.sha}-attempt-${runAttempt}`',
    'actions/download-artifact@v4',
    'pattern: rc-evidence-attempt-${{ github.run_attempt }}-*',
    'bundle-attempt-${{ github.run_attempt }}',
    'run-id: ${{ steps.first-run-source.outputs.run-id }}',
    'github-token: ${{ github.token }}',
    '--first-run-workflow-run-id',
    '--first-run-workflow-run-attempt',
    '--first-run-artifact',
    '--first-run-artifact-id',
    '--first-run-artifact-digest',
    '--first-run-artifact-size',
    '--first-run-artifact-created-at',
    '--first-run-artifact-expires-at',
    '--first-run-repository',
    '--release-workflow-run-id',
    '--release-workflow-run-attempt',
    '--release-repository',
    '--release-workflow-path',
  ]
  return required.filter((token) => !value.includes(token)).map((token) => issue('RC_RELEASE_FIRST_RUN_WORKFLOW_GUARD_MISSING', `RC release workflow is missing ${token}`, '.github/workflows/rc-release.yml'))
}

export function validateRcSignedGateMetadata({
  rows = [],
  requiredGates = [],
  allowedSources = [],
  candidateVersion,
  commit,
  expectedSource = 'github-actions',
  workflowRunId,
  workflowRunAttempt,
  repository,
  workflowPath,
  maximumEvidenceAgeHours = 24,
  now = Date.now(),
} = {}) {
  const issues = []
  const attempt = positiveInteger(workflowRunAttempt)
  const maximumAgeHours = Number(maximumEvidenceAgeHours)
  const maximumAgeMs = maximumAgeHours * 3_600_000
  if (!/^\d+$/.test(String(workflowRunId ?? ''))) issues.push(issue('RC_SIGNED_GATE_WORKFLOW_RUN_ID_INVALID', 'A trusted release workflow run ID is required'))
  if (!attempt) issues.push(issue('RC_SIGNED_GATE_WORKFLOW_ATTEMPT_INVALID', 'A trusted release workflow run attempt is required'))
  if (!validRepository(repository)) issues.push(issue('RC_SIGNED_GATE_REPOSITORY_INVALID', 'A trusted release repository is required'))
  if (!validWorkflowPath(workflowPath)) issues.push(issue('RC_SIGNED_GATE_WORKFLOW_PATH_INVALID', 'A trusted release workflow path is required'))
  if (!Number.isFinite(maximumAgeHours) || maximumAgeHours <= 0) issues.push(issue('RC_SIGNED_GATE_MAXIMUM_AGE_INVALID', 'maximumEvidenceAgeHours must be positive'))
  if (issues.length) return { ok: false, issues, rowsByGate: {} }

  const required = new Set(requiredGates)
  const rowsByGate = {}
  for (const row of rows) {
    const gate = String(row?.gate ?? '')
    if (!gate) {
      issues.push(issue('RC_SIGNED_GATE_NAME_INVALID', 'Signed gate evidence is missing a gate name'))
      continue
    }
    if (Object.hasOwn(rowsByGate, gate)) {
      issues.push(issue('RC_SIGNED_GATE_DUPLICATE', `${gate}: duplicate evidence`))
      continue
    }
    rowsByGate[gate] = row
    if (!required.has(gate)) issues.push(issue('RC_SIGNED_GATE_UNEXPECTED', `${gate}: evidence is not required by the RC manifest`))
    if (row.schemaVersion !== 1) issues.push(issue('RC_SIGNED_GATE_SCHEMA_INVALID', `${gate}: unsupported schema ${row.schemaVersion}`))
    if (row.candidateVersion !== candidateVersion) issues.push(issue('RC_SIGNED_GATE_CANDIDATE_MISMATCH', `${gate}: candidate mismatch`))
    if (row.commit !== commit) issues.push(issue('RC_SIGNED_GATE_COMMIT_MISMATCH', `${gate}: commit mismatch`))
    if (row.status !== 'passed') issues.push(issue('RC_SIGNED_GATE_STATUS_BLOCKED', `${gate}: status ${row.status}`))
    if (!row.trusted || !allowedSources.includes(row.source) || row.source !== expectedSource) issues.push(issue('RC_SIGNED_GATE_SOURCE_UNTRUSTED', `${gate}: untrusted source ${row.source}`))
    if (String(row.runId ?? '') !== String(workflowRunId)) issues.push(issue('RC_SIGNED_GATE_WORKFLOW_RUN_MISMATCH', `${gate}: workflow run ${row.runId ?? 'missing'} does not match ${workflowRunId}`))
    if (positiveInteger(row.workflowRunAttempt) !== attempt) issues.push(issue('RC_SIGNED_GATE_WORKFLOW_ATTEMPT_MISMATCH', `${gate}: workflow attempt ${row.workflowRunAttempt ?? 'missing'} does not match ${attempt}`))
    if (row.repository !== repository) issues.push(issue('RC_SIGNED_GATE_REPOSITORY_MISMATCH', `${gate}: repository ${row.repository ?? 'missing'} does not match ${repository}`))
    if (row.workflowPath !== workflowPath) issues.push(issue('RC_SIGNED_GATE_WORKFLOW_PATH_MISMATCH', `${gate}: workflow ${row.workflowPath ?? 'missing'} does not match ${workflowPath}`))
    timestamp(issues, { code: 'RC_SIGNED_GATE_OBSERVED_AT', value: row.observedAt, now, maximumAgeMs })
  }
  for (const gate of requiredGates) if (!Object.hasOwn(rowsByGate, gate)) issues.push(issue('RC_SIGNED_GATE_MISSING', `${gate}: missing evidence`))
  return { ok: issues.length === 0, issues, rowsByGate }
}

export async function verifyRcFirstRunAdmission({
  root = process.cwd(),
  run = 'latest',
  candidateVersion,
  commit,
  workflowRunId,
  workflowRunAttempt,
  workflowCreatedAt,
  repository,
  workflowName = 'RC First Real Run',
  artifactName,
  artifactId,
  artifactDigest,
  artifactSizeBytes,
  artifactCreatedAt,
  artifactExpiresAt,
  workflowPath = FIRST_RUN_WORKFLOW_PATH,
  maximumAgeHours = 24,
  now = Date.now(),
} = {}) {
  const issues = []
  const runAttempt = positiveInteger(workflowRunAttempt)
  const trustedArtifactId = positiveInteger(artifactId)
  const trustedArtifactSize = positiveInteger(artifactSizeBytes)
  const ageHours = Number(maximumAgeHours)
  const maximumAgeMs = ageHours * 3_600_000
  if (!/^[a-f0-9]{40}$/i.test(String(commit ?? ''))) issues.push(issue('FIRST_RUN_ADMISSION_COMMIT_INVALID', 'A full candidate commit SHA is required'))
  if (!String(candidateVersion ?? '').trim()) issues.push(issue('FIRST_RUN_ADMISSION_CANDIDATE_MISSING', 'Candidate version is required'))
  if (!/^\d+$/.test(String(workflowRunId ?? ''))) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_RUN_ID_INVALID', 'A trusted GitHub workflow run ID is required'))
  if (!runAttempt) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_ATTEMPT_INVALID', 'A trusted GitHub workflow run attempt is required'))
  if (!validRepository(repository)) issues.push(issue('FIRST_RUN_ADMISSION_REPOSITORY_INVALID', 'A trusted GitHub repository is required'))
  if (!String(workflowName ?? '').trim()) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_NAME_INVALID', 'A trusted GitHub workflow name is required'))
  if (!validWorkflowPath(workflowPath)) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_PATH_INVALID', 'A trusted GitHub workflow path is required'))
  if (!String(artifactName ?? '').trim()) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_MISSING', 'A trusted GitHub artifact name is required'))
  if (!trustedArtifactId) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_ID_INVALID', 'A trusted GitHub artifact ID is required'))
  if (!/^sha256:[a-f0-9]{64}$/i.test(String(artifactDigest ?? ''))) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_DIGEST_INVALID', 'A trusted GitHub artifact SHA-256 digest is required'))
  if (!trustedArtifactSize) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_SIZE_INVALID', 'A positive GitHub artifact size is required'))
  if (!Number.isFinite(ageHours) || ageHours <= 0) issues.push(issue('FIRST_RUN_ADMISSION_MAXIMUM_AGE_INVALID', 'maximumAgeHours must be positive'))
  const workflowCreated = timestamp(issues, { code: 'FIRST_RUN_ADMISSION_WORKFLOW_CREATED_AT', value: workflowCreatedAt, now, maximumAgeMs })
  const artifactCreated = timestamp(issues, { code: 'FIRST_RUN_ADMISSION_ARTIFACT_CREATED_AT', value: artifactCreatedAt, now, maximumAgeMs })
  const artifactExpires = Date.parse(String(artifactExpiresAt ?? ''))
  if (!Number.isFinite(artifactExpires)) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_EXPIRES_AT_INVALID', 'Artifact expiration time is invalid'))
  else if (artifactExpires <= now) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_EXPIRED', 'The trusted GitHub artifact is expired'))
  if (Number.isFinite(artifactCreated) && Number.isFinite(artifactExpires) && artifactExpires <= artifactCreated) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_WINDOW_INVALID', 'Artifact expiration must follow artifact creation'))
  if (issues.length) return { ok: false, issues }

  let runId
  try {
    runId = await resolveRunId(root, run)
  } catch (error) {
    issues.push(issue('FIRST_RUN_ADMISSION_RUN_RESOLUTION_FAILED', error instanceof Error ? error.message : String(error)))
    return { ok: false, issues }
  }

  const verification = await verifyFirstRunEvidence({ root, runId })
  if (!verification.ok) {
    for (const finding of verification.issues) issues.push(issue(finding.code, finding.message ?? finding.code, finding.path))
    return { ok: false, issues, runId, verification }
  }

  const manifest = verification.manifest
  if (manifest.status !== 'passed') issues.push(issue('FIRST_RUN_ADMISSION_STATUS_BLOCKED', `First-run status must be passed, found ${manifest.status}`))
  if (manifest.profile !== 'release') issues.push(issue('FIRST_RUN_ADMISSION_PROFILE_BLOCKED', `First-run profile must be release, found ${manifest.profile}`))
  if (manifest.candidateVersion !== candidateVersion) issues.push(issue('FIRST_RUN_ADMISSION_CANDIDATE_MISMATCH', `First-run candidate ${manifest.candidateVersion} does not match ${candidateVersion}`))
  if (manifest.commit !== commit) issues.push(issue('FIRST_RUN_ADMISSION_COMMIT_MISMATCH', `First-run commit ${manifest.commit} does not match ${commit}`))
  const sealedAt = timestamp(issues, { code: 'FIRST_RUN_ADMISSION_SEALED_AT', value: manifest.sealedAt, now, maximumAgeMs })
  if (Number.isFinite(workflowCreated) && Number.isFinite(sealedAt) && sealedAt + CLOCK_SKEW_MS < workflowCreated) issues.push(issue('FIRST_RUN_ADMISSION_SEAL_PRECEDES_WORKFLOW', 'First-run evidence was sealed before the trusted workflow began'))
  if (Number.isFinite(artifactCreated) && Number.isFinite(sealedAt) && artifactCreated + CLOCK_SKEW_MS < sealedAt) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_PRECEDES_SEAL', 'Artifact creation precedes first-run evidence sealing'))

  const provenance = manifest.provenance ?? {}
  if (provenance.provider !== 'github-actions') issues.push(issue('FIRST_RUN_ADMISSION_SOURCE_UNTRUSTED', `First-run provider must be github-actions, found ${provenance.provider ?? 'missing'}`))
  if (provenance.repository !== repository) issues.push(issue('FIRST_RUN_ADMISSION_REPOSITORY_MISMATCH', `First-run repository ${provenance.repository ?? 'missing'} does not match ${repository}`))
  if (provenance.workflowName !== workflowName) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_NAME_MISMATCH', `First-run workflow name ${provenance.workflowName ?? 'missing'} does not match ${workflowName}`))
  if (provenance.workflowPath !== workflowPath) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_MISMATCH', `First-run workflow ${provenance.workflowPath ?? 'missing'} does not match ${workflowPath}`))
  if (String(provenance.workflowRunId ?? '') !== String(workflowRunId)) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_RUN_MISMATCH', `First-run workflow run ${provenance.workflowRunId ?? 'missing'} does not match ${workflowRunId}`))
  if (positiveInteger(provenance.workflowRunAttempt) !== runAttempt) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_ATTEMPT_MISMATCH', `First-run workflow attempt ${provenance.workflowRunAttempt ?? 'missing'} does not match ${runAttempt}`))
  if (provenance.artifactName !== artifactName) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_MISMATCH', `First-run artifact ${provenance.artifactName ?? 'missing'} does not match ${artifactName}`))

  const triagePath = `artifacts/rc-triage/first-run-${runId}/latest.json`
  let triage
  if (!hasListedFile(manifest, triagePath)) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_UNSEALED', 'First-run triage report is not part of the sealed manifest', triagePath))
  else {
    try {
      triage = JSON.parse(await readFile(resolve(root, triagePath), 'utf8'))
      if (triage.scope !== 'first-run-release') issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_SCOPE_MISMATCH', `First-run triage scope must be first-run-release, found ${triage.scope ?? 'missing'}`, triagePath))
      if (String(triage.workflowRunId ?? '') !== String(workflowRunId)) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_RUN_MISMATCH', `Triage workflow run ${triage.workflowRunId ?? 'missing'} does not match ${workflowRunId}`, triagePath))
      if (triage.commit && triage.commit !== commit) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_COMMIT_MISMATCH', `Triage commit ${triage.commit} does not match ${commit}`, triagePath))
      const p0 = Number(triage.counts?.P0)
      const p1 = Number(triage.counts?.P1)
      const blockers = Number(triage.blockers)
      if (!Number.isInteger(p0) || p0 < 0 || !Number.isInteger(p1) || p1 < 0 || !Number.isInteger(blockers) || blockers < 0) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_COUNTS_INVALID', 'Triage P0/P1/blocker counts are invalid', triagePath))
      else {
        if (p0 > 0) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_P0_BLOCKED', `First-run triage contains ${p0} P0 finding(s)`, triagePath))
        if (p1 > 0) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_P1_BLOCKED', `First-run triage contains ${p1} P1 finding(s)`, triagePath))
        if (blockers > 0) issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_BLOCKERS', `First-run triage contains ${blockers} blocking finding(s)`, triagePath))
      }
      if (triage.status === 'blocked') issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_STATUS_BLOCKED', 'First-run triage status is blocked', triagePath))
    } catch (error) {
      issues.push(issue('FIRST_RUN_ADMISSION_TRIAGE_INVALID', error instanceof Error ? error.message : String(error), triagePath))
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    runId,
    manifest,
    manifestSha256: verification.manifestSha256,
    triage,
    admission: issues.length ? undefined : {
      runId,
      manifestSha256: verification.manifestSha256,
      evidenceSealedAt: manifest.sealedAt,
      workflowRunId: String(workflowRunId),
      workflowRunAttempt: runAttempt,
      workflowCreatedAt,
      repository,
      workflowName,
      workflowPath,
      artifactName,
      artifactId: trustedArtifactId,
      artifactDigest,
      artifactSizeBytes: trustedArtifactSize,
      artifactCreatedAt,
      artifactExpiresAt,
      maximumAgeHours: ageHours,
      triageStatus: triage.status,
      triageCounts: triage.counts,
      integrityAlgorithm: 'sha256',
      authentication: 'github-actions-run-attempt-and-artifact-identity',
    },
  }
}

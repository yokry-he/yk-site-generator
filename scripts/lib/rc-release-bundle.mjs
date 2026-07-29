import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const RC_RELEASE_BUNDLE_FILES = Object.freeze(['RELEASE_NOTES.md', 'manifest.json'])
export const RC_RELEASE_BUNDLE_ALL_FILES = Object.freeze([...RC_RELEASE_BUNDLE_FILES, 'SHA256SUMS'])
const CLOCK_SKEW_MS = 5 * 60_000

function issue(code, message, path) {
  return { code, message, ...(path ? { path } : {}) }
}

function positiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0
}

function validRepository(value) {
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value ?? ''))
}

function validWorkflowPath(value) {
  return /^\.github\/workflows\/[A-Za-z0-9_.-]+\.(?:yml|yaml)$/.test(String(value ?? ''))
}

async function digest(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

export function rcReleaseBundleChecksumText(rows) {
  const byName = new Map(rows.map((row) => [row.path, row.sha256]))
  return `${RC_RELEASE_BUNDLE_FILES.map((path) => `${byName.get(path)}  ${path}`).join('\n')}\n`
}

export async function writeRcReleaseBundleChecksums({ bundleDirectory }) {
  const root = resolve(bundleDirectory)
  const rows = []
  for (const path of RC_RELEASE_BUNDLE_FILES) {
    const target = resolve(root, path)
    if (!existsSync(target) || !lstatSync(target).isFile() || lstatSync(target).isSymbolicLink()) throw new Error(`RC_RELEASE_BUNDLE_FILE_INVALID:${path}`)
    rows.push({ path, sha256: await digest(target) })
  }
  const checksumPath = resolve(root, 'SHA256SUMS')
  await writeFile(checksumPath, rcReleaseBundleChecksumText(rows), { mode: 0o600 })
  return { checksumPath, rows }
}

function timestamp(issues, code, value, now, { required = true, futureOnly = false } = {}) {
  const parsed = Date.parse(String(value ?? ''))
  if (!Number.isFinite(parsed)) {
    if (required) issues.push(issue(`${code}_INVALID`, `${code} is invalid`))
    return Number.NaN
  }
  if (!futureOnly && parsed > now + CLOCK_SKEW_MS) issues.push(issue(`${code}_FUTURE`, `${code} is in the future`))
  if (parsed < 0) issues.push(issue(`${code}_INVALID`, `${code} is invalid`))
  return parsed
}

function validateFirstRunAdmission(issues, admission, manifest, assembledAt, now, maximumAgeMs) {
  const prefix = 'RC_RELEASE_BUNDLE_FIRST_RUN'
  if (!admission || typeof admission !== 'object') {
    issues.push(issue(`${prefix}_MISSING`, 'firstRunAdmission is required'))
    return
  }
  const attempt = positiveInteger(admission.workflowRunAttempt)
  const artifactId = positiveInteger(admission.artifactId)
  const artifactSize = positiveInteger(admission.artifactSizeBytes)
  const maximumAge = Number(admission.maximumAgeHours)
  if (!String(admission.runId ?? '').trim() || /[\\/]/.test(String(admission.runId))) issues.push(issue(`${prefix}_RUN_ID_INVALID`, 'First-run ID is invalid'))
  if (!/^[a-f0-9]{64}$/i.test(String(admission.manifestSha256 ?? ''))) issues.push(issue(`${prefix}_MANIFEST_DIGEST_INVALID`, 'First-run manifest SHA-256 is invalid'))
  if (!/^\d+$/.test(String(admission.workflowRunId ?? ''))) issues.push(issue(`${prefix}_WORKFLOW_RUN_INVALID`, 'First-run workflow run ID is invalid'))
  if (!attempt) issues.push(issue(`${prefix}_WORKFLOW_ATTEMPT_INVALID`, 'First-run workflow attempt is invalid'))
  if (!validRepository(admission.repository)) issues.push(issue(`${prefix}_REPOSITORY_INVALID`, 'First-run repository is invalid'))
  if (admission.workflowName !== 'RC First Real Run') issues.push(issue(`${prefix}_WORKFLOW_NAME_INVALID`, 'First-run workflow name is invalid'))
  if (admission.workflowPath !== '.github/workflows/rc-first-real-run.yml') issues.push(issue(`${prefix}_WORKFLOW_PATH_INVALID`, 'First-run workflow path is invalid'))
  const expectedArtifactName = `rc-first-real-run-release-${manifest.commit}-attempt-${attempt}`
  if (admission.artifactName !== expectedArtifactName) issues.push(issue(`${prefix}_ARTIFACT_NAME_MISMATCH`, `First-run artifact must be ${expectedArtifactName}`))
  if (!artifactId) issues.push(issue(`${prefix}_ARTIFACT_ID_INVALID`, 'First-run artifact ID is invalid'))
  if (!/^sha256:[a-f0-9]{64}$/i.test(String(admission.artifactDigest ?? ''))) issues.push(issue(`${prefix}_ARTIFACT_DIGEST_INVALID`, 'First-run artifact digest is invalid'))
  if (!artifactSize) issues.push(issue(`${prefix}_ARTIFACT_SIZE_INVALID`, 'First-run artifact size is invalid'))
  if (!Number.isFinite(maximumAge) || maximumAge <= 0) issues.push(issue(`${prefix}_MAXIMUM_AGE_INVALID`, 'First-run maximum age is invalid'))
  if (Number.isFinite(maximumAge) && maximumAge !== manifest.maximumEvidenceAgeHours) issues.push(issue(`${prefix}_MAXIMUM_AGE_MISMATCH`, 'First-run maximum age does not match the bundle'))
  if (admission.integrityAlgorithm !== 'sha256') issues.push(issue(`${prefix}_INTEGRITY_ALGORITHM_INVALID`, 'First-run integrity algorithm must be sha256'))
  if (admission.authentication !== 'github-actions-run-attempt-and-artifact-identity') issues.push(issue(`${prefix}_AUTHENTICATION_INVALID`, 'First-run authentication mode is invalid'))
  if (!admission.triageCounts || Number(admission.triageCounts.P0) !== 0 || Number(admission.triageCounts.P1) !== 0) issues.push(issue(`${prefix}_TRIAGE_BLOCKED`, 'First-run triage must have zero P0 and P1 findings'))
  if (admission.triageStatus === 'blocked') issues.push(issue(`${prefix}_TRIAGE_STATUS_BLOCKED`, 'First-run triage is blocked'))

  const workflowCreated = timestamp(issues, `${prefix}_WORKFLOW_CREATED_AT`, admission.workflowCreatedAt, now)
  const sealedAt = timestamp(issues, `${prefix}_SEALED_AT`, admission.evidenceSealedAt, now)
  const artifactCreated = timestamp(issues, `${prefix}_ARTIFACT_CREATED_AT`, admission.artifactCreatedAt, now)
  const artifactExpires = timestamp(issues, `${prefix}_ARTIFACT_EXPIRES_AT`, admission.artifactExpiresAt, now, { futureOnly: true })
  if (Number.isFinite(workflowCreated) && Number.isFinite(assembledAt) && assembledAt - workflowCreated > maximumAgeMs + CLOCK_SKEW_MS) issues.push(issue(`${prefix}_WORKFLOW_STALE_AT_ASSEMBLY`, 'First-run workflow was stale at bundle assembly'))
  if (Number.isFinite(sealedAt) && Number.isFinite(assembledAt) && assembledAt - sealedAt > maximumAgeMs + CLOCK_SKEW_MS) issues.push(issue(`${prefix}_SEAL_STALE_AT_ASSEMBLY`, 'First-run seal was stale at bundle assembly'))
  if (Number.isFinite(artifactCreated) && Number.isFinite(assembledAt) && assembledAt - artifactCreated > maximumAgeMs + CLOCK_SKEW_MS) issues.push(issue(`${prefix}_ARTIFACT_STALE_AT_ASSEMBLY`, 'First-run artifact was stale at bundle assembly'))
  if (Number.isFinite(workflowCreated) && Number.isFinite(sealedAt) && sealedAt + CLOCK_SKEW_MS < workflowCreated) issues.push(issue(`${prefix}_SEAL_ORDER_INVALID`, 'First-run seal predates the workflow'))
  if (Number.isFinite(sealedAt) && Number.isFinite(artifactCreated) && artifactCreated + CLOCK_SKEW_MS < sealedAt) issues.push(issue(`${prefix}_ARTIFACT_ORDER_INVALID`, 'First-run artifact predates sealing'))
  if (Number.isFinite(artifactCreated) && Number.isFinite(assembledAt) && artifactCreated > assembledAt + CLOCK_SKEW_MS) issues.push(issue(`${prefix}_ARTIFACT_AFTER_ASSEMBLY`, 'First-run artifact was created after bundle assembly'))
  if (Number.isFinite(artifactExpires) && Number.isFinite(assembledAt) && artifactExpires <= assembledAt) issues.push(issue(`${prefix}_ARTIFACT_EXPIRED_AT_ASSEMBLY`, 'First-run artifact was expired at bundle assembly'))
}

function validateSignedGateEvidence(issues, manifest, assembledAt, now, maximumAgeMs) {
  const summary = manifest.signedGateEvidence
  if (!summary || typeof summary !== 'object') {
    issues.push(issue('RC_RELEASE_BUNDLE_SIGNED_GATES_MISSING', 'signedGateEvidence is required'))
    return
  }
  const attempt = positiveInteger(summary.workflowRunAttempt)
  if (summary.signatureAlgorithm !== 'hmac-sha256') issues.push(issue('RC_RELEASE_BUNDLE_SIGNATURE_ALGORITHM_INVALID', 'Signed gate algorithm must be hmac-sha256'))
  if (!/^[a-f0-9]{64}$/i.test(String(summary.evidenceDigest ?? ''))) issues.push(issue('RC_RELEASE_BUNDLE_EVIDENCE_DIGEST_INVALID', 'Signed gate evidence digest is invalid'))
  if (!positiveInteger(summary.gateCount)) issues.push(issue('RC_RELEASE_BUNDLE_GATE_COUNT_INVALID', 'Signed gate count is invalid'))
  if (!['github-actions', 'isolated-runner'].includes(summary.source)) issues.push(issue('RC_RELEASE_BUNDLE_GATE_SOURCE_INVALID', 'Signed gate source is invalid'))
  if (!validRepository(summary.repository)) issues.push(issue('RC_RELEASE_BUNDLE_GATE_REPOSITORY_INVALID', 'Signed gate repository is invalid'))
  if (!validWorkflowPath(summary.workflowPath)) issues.push(issue('RC_RELEASE_BUNDLE_GATE_WORKFLOW_INVALID', 'Signed gate workflow path is invalid'))
  if (!/^\d+$/.test(String(summary.workflowRunId ?? ''))) issues.push(issue('RC_RELEASE_BUNDLE_GATE_RUN_INVALID', 'Signed gate workflow run ID is invalid'))
  if (!attempt) issues.push(issue('RC_RELEASE_BUNDLE_GATE_ATTEMPT_INVALID', 'Signed gate workflow attempt is invalid'))

  const gates = Array.isArray(manifest.gates) ? manifest.gates : []
  if (gates.length !== summary.gateCount) issues.push(issue('RC_RELEASE_BUNDLE_GATE_COUNT_MISMATCH', `Manifest has ${gates.length} gates but summary declares ${summary.gateCount}`))
  const names = gates.map((gate) => String(gate?.gate ?? ''))
  if (names.some((name) => !name)) issues.push(issue('RC_RELEASE_BUNDLE_GATE_NAME_INVALID', 'A gate name is missing'))
  if (new Set(names).size !== names.length) issues.push(issue('RC_RELEASE_BUNDLE_GATE_DUPLICATE', 'Gate names must be unique'))
  if (names.join('\n') !== [...names].sort().join('\n')) issues.push(issue('RC_RELEASE_BUNDLE_GATES_UNSORTED', 'Gates must be sorted by name'))

  const digestValue = createHash('sha256')
  for (const gate of gates) {
    const name = String(gate?.gate ?? '')
    if (!/^[a-f0-9]{64}$/i.test(String(gate?.signatureSha256 ?? ''))) issues.push(issue('RC_RELEASE_BUNDLE_GATE_SIGNATURE_DIGEST_INVALID', `${name || '(unknown)'} signature digest is invalid`))
    if (gate.candidateVersion !== manifest.candidateVersion) issues.push(issue('RC_RELEASE_BUNDLE_GATE_CANDIDATE_MISMATCH', `${name} candidate mismatch`))
    if (gate.commit !== manifest.commit) issues.push(issue('RC_RELEASE_BUNDLE_GATE_COMMIT_MISMATCH', `${name} commit mismatch`))
    if (gate.status !== 'passed' || gate.trusted !== true) issues.push(issue('RC_RELEASE_BUNDLE_GATE_STATUS_INVALID', `${name} is not a trusted passing gate`))
    if (gate.source !== summary.source || gate.repository !== summary.repository || gate.workflowPath !== summary.workflowPath || String(gate.runId ?? '') !== String(summary.workflowRunId) || positiveInteger(gate.workflowRunAttempt) !== attempt) {
      issues.push(issue('RC_RELEASE_BUNDLE_GATE_SOURCE_MISMATCH', `${name} does not match the signed gate summary source`))
    }
    const observed = timestamp(issues, 'RC_RELEASE_BUNDLE_GATE_OBSERVED_AT', gate.observedAt, now)
    if (Number.isFinite(observed) && Number.isFinite(assembledAt) && observed > assembledAt + CLOCK_SKEW_MS) issues.push(issue('RC_RELEASE_BUNDLE_GATE_AFTER_ASSEMBLY', `${name} was observed after bundle assembly`))
    if (Number.isFinite(observed) && Number.isFinite(assembledAt) && assembledAt - observed > maximumAgeMs + CLOCK_SKEW_MS) issues.push(issue('RC_RELEASE_BUNDLE_GATE_STALE_AT_ASSEMBLY', `${name} was stale at bundle assembly`))
    digestValue.update(name).update('\0').update(String(gate.signatureSha256 ?? '')).update('\0')
  }
  const receiptDigest = digestValue.digest('hex')
  if (receiptDigest !== summary.receiptDigest) issues.push(issue('RC_RELEASE_BUNDLE_GATE_RECEIPT_DIGEST_MISMATCH', 'Gate receipt digest does not match the sorted gate receipts'))
  if (manifest.evidenceDigest !== summary.evidenceDigest) issues.push(issue('RC_RELEASE_BUNDLE_EVIDENCE_DIGEST_MISMATCH', 'Top-level evidenceDigest does not match signedGateEvidence'))
}

function validateReleaseNotes(issues, notes, manifest) {
  const required = [
    `# SiteForge ${manifest.candidateVersion}`,
    `Candidate commit: \`${manifest.commit}\``,
    `workflow run \`${manifest.firstRunAdmission?.workflowRunId}\`, attempt \`${manifest.firstRunAdmission?.workflowRunAttempt}\``,
    `release workflow run \`${manifest.signedGateEvidence?.workflowRunId}\`, attempt \`${manifest.signedGateEvidence?.workflowRunAttempt}\``,
    'ready for human approval',
  ]
  for (const token of required) if (!notes.includes(token)) issues.push(issue('RC_RELEASE_BUNDLE_RELEASE_NOTES_MISMATCH', `Release notes are missing ${token}`, 'RELEASE_NOTES.md'))
}

export async function verifyRcReleaseBundle({
  bundleDirectory = 'artifacts/rc-release',
  expectedVersion = '',
  expectedCommit = '',
  expectedReleaseWorkflowRunId = '',
  expectedReleaseWorkflowRunAttempt = '',
  expectedRepository = '',
  expectedWorkflowPath = '',
  now = Date.now(),
} = {}) {
  const root = resolve(bundleDirectory)
  const issues = []
  if (!existsSync(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) return { ok: false, issues: [issue('RC_RELEASE_BUNDLE_DIRECTORY_INVALID', 'RC bundle directory is missing or unsafe', root)] }

  const entries = readdirSync(root, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))
  const names = entries.map((entry) => entry.name)
  for (const entry of entries) {
    if (!RC_RELEASE_BUNDLE_ALL_FILES.includes(entry.name)) issues.push(issue('RC_RELEASE_BUNDLE_FILE_UNEXPECTED', `Unexpected bundle entry ${entry.name}`, entry.name))
    if (!entry.isFile() || entry.isSymbolicLink()) issues.push(issue('RC_RELEASE_BUNDLE_FILE_UNSAFE', `Bundle entry ${entry.name} must be a regular file`, entry.name))
  }
  for (const path of RC_RELEASE_BUNDLE_ALL_FILES) if (!names.includes(path)) issues.push(issue('RC_RELEASE_BUNDLE_FILE_MISSING', `Required bundle file ${path} is missing`, path))
  if (issues.length) return { ok: false, issues }

  let manifest
  try {
    manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
  } catch (error) {
    return { ok: false, issues: [issue('RC_RELEASE_BUNDLE_MANIFEST_INVALID', error instanceof Error ? error.message : String(error), 'manifest.json')] }
  }
  const notes = await readFile(resolve(root, 'RELEASE_NOTES.md'), 'utf8')
  const checksums = await readFile(resolve(root, 'SHA256SUMS'), 'utf8')
  const rows = []
  for (const path of RC_RELEASE_BUNDLE_FILES) rows.push({ path, sha256: await digest(resolve(root, path)) })
  const expectedChecksums = rcReleaseBundleChecksumText(rows)
  if (checksums !== expectedChecksums) issues.push(issue('RC_RELEASE_BUNDLE_CHECKSUMS_MISMATCH', 'SHA256SUMS does not exactly match the bundle files', 'SHA256SUMS'))

  if (manifest.schemaVersion !== 2) issues.push(issue('RC_RELEASE_BUNDLE_SCHEMA_INVALID', `Expected schemaVersion 2, found ${manifest.schemaVersion}`))
  if (!String(manifest.candidateVersion ?? '').trim()) issues.push(issue('RC_RELEASE_BUNDLE_CANDIDATE_INVALID', 'Candidate version is missing'))
  if (!/^[a-f0-9]{40}$/i.test(String(manifest.commit ?? ''))) issues.push(issue('RC_RELEASE_BUNDLE_COMMIT_INVALID', 'Candidate commit is invalid'))
  if (manifest.status !== 'ready-for-human-approval') issues.push(issue('RC_RELEASE_BUNDLE_STATUS_INVALID', `Bundle status is ${manifest.status}`))
  const assembledAt = timestamp(issues, 'RC_RELEASE_BUNDLE_ASSEMBLED_AT', manifest.assembledAt, now)
  const maximumAgeHours = Number(manifest.maximumEvidenceAgeHours)
  const maximumAgeMs = maximumAgeHours * 3_600_000
  if (!Number.isFinite(maximumAgeHours) || maximumAgeHours <= 0) issues.push(issue('RC_RELEASE_BUNDLE_MAXIMUM_AGE_INVALID', 'maximumEvidenceAgeHours must be positive'))
  if (expectedVersion && manifest.candidateVersion !== expectedVersion) issues.push(issue('RC_RELEASE_BUNDLE_CANDIDATE_MISMATCH', `Expected ${expectedVersion}, found ${manifest.candidateVersion}`))
  if (expectedCommit && manifest.commit !== expectedCommit) issues.push(issue('RC_RELEASE_BUNDLE_COMMIT_MISMATCH', `Expected ${expectedCommit}, found ${manifest.commit}`))

  validateFirstRunAdmission(issues, manifest.firstRunAdmission, manifest, assembledAt, now, maximumAgeMs)
  validateSignedGateEvidence(issues, manifest, assembledAt, now, maximumAgeMs)
  validateReleaseNotes(issues, notes, manifest)

  const summary = manifest.signedGateEvidence ?? {}
  if (expectedReleaseWorkflowRunId && String(summary.workflowRunId ?? '') !== String(expectedReleaseWorkflowRunId)) issues.push(issue('RC_RELEASE_BUNDLE_EXPECTED_RUN_MISMATCH', `Expected release workflow run ${expectedReleaseWorkflowRunId}`))
  if (expectedReleaseWorkflowRunAttempt && positiveInteger(summary.workflowRunAttempt) !== positiveInteger(expectedReleaseWorkflowRunAttempt)) issues.push(issue('RC_RELEASE_BUNDLE_EXPECTED_ATTEMPT_MISMATCH', `Expected release workflow attempt ${expectedReleaseWorkflowRunAttempt}`))
  if (expectedRepository && summary.repository !== expectedRepository) issues.push(issue('RC_RELEASE_BUNDLE_EXPECTED_REPOSITORY_MISMATCH', `Expected release repository ${expectedRepository}`))
  if (expectedWorkflowPath && summary.workflowPath !== expectedWorkflowPath) issues.push(issue('RC_RELEASE_BUNDLE_EXPECTED_WORKFLOW_MISMATCH', `Expected release workflow ${expectedWorkflowPath}`))

  return { ok: issues.length === 0, issues, manifest, checksums: rows }
}

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { FIRST_RUN_WORKFLOW_PATH, verifyFirstRunEvidence } from './rc-first-run-evidence.mjs'

function issue(code, message, path) {
  return { code, message, ...(path ? { path } : {}) }
}

function safeRunId(value) {
  const runId = String(value ?? '').trim()
  if (!runId || runId.includes('/') || runId.includes('\\') || runId === '.' || runId === '..') throw new Error(`FIRST_RUN_ADMISSION_RUN_ID_INVALID:${value}`)
  return runId
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
    'actions/download-artifact@v4',
    'run-id: ${{ steps.first-run-source.outputs.run-id }}',
    'github-token: ${{ github.token }}',
    '--first-run-workflow-run-id',
    '--first-run-artifact',
    '--first-run-repository',
  ]
  return required.filter((token) => !value.includes(token)).map((token) => issue('RC_RELEASE_FIRST_RUN_WORKFLOW_GUARD_MISSING', `RC release workflow is missing ${token}`, '.github/workflows/rc-release.yml'))
}

export async function verifyRcFirstRunAdmission({
  root = process.cwd(),
  run = 'latest',
  candidateVersion,
  commit,
  workflowRunId,
  repository,
  artifactName,
  workflowPath = FIRST_RUN_WORKFLOW_PATH,
} = {}) {
  const issues = []
  if (!/^[a-f0-9]{40}$/i.test(String(commit ?? ''))) issues.push(issue('FIRST_RUN_ADMISSION_COMMIT_INVALID', 'A full candidate commit SHA is required'))
  if (!String(candidateVersion ?? '').trim()) issues.push(issue('FIRST_RUN_ADMISSION_CANDIDATE_MISSING', 'Candidate version is required'))
  if (!/^\d+$/.test(String(workflowRunId ?? ''))) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_RUN_ID_INVALID', 'A trusted GitHub workflow run ID is required'))
  if (!String(repository ?? '').includes('/')) issues.push(issue('FIRST_RUN_ADMISSION_REPOSITORY_INVALID', 'A trusted GitHub repository is required'))
  if (!String(artifactName ?? '').trim()) issues.push(issue('FIRST_RUN_ADMISSION_ARTIFACT_MISSING', 'A trusted GitHub artifact name is required'))
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

  const provenance = manifest.provenance ?? {}
  if (provenance.provider !== 'github-actions') issues.push(issue('FIRST_RUN_ADMISSION_SOURCE_UNTRUSTED', `First-run provider must be github-actions, found ${provenance.provider ?? 'missing'}`))
  if (provenance.repository !== repository) issues.push(issue('FIRST_RUN_ADMISSION_REPOSITORY_MISMATCH', `First-run repository ${provenance.repository ?? 'missing'} does not match ${repository}`))
  if (provenance.workflowPath !== workflowPath) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_MISMATCH', `First-run workflow ${provenance.workflowPath ?? 'missing'} does not match ${workflowPath}`))
  if (String(provenance.workflowRunId ?? '') !== String(workflowRunId)) issues.push(issue('FIRST_RUN_ADMISSION_WORKFLOW_RUN_MISMATCH', `First-run workflow run ${provenance.workflowRunId ?? 'missing'} does not match ${workflowRunId}`))
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
      workflowRunId: String(workflowRunId),
      repository,
      workflowPath,
      artifactName,
      triageStatus: triage.status,
      triageCounts: triage.counts,
      integrityAlgorithm: 'sha256',
      authentication: 'github-actions-run-and-artifact-source',
    },
  }
}

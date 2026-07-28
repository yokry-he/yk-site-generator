import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

export const FIRST_RUN_WORKFLOW_PATH = '.github/workflows/rc-first-real-run.yml'

const STATIC_EVIDENCE_PATHS = Object.freeze([
  'release/rc-first-run-plan.json',
  'release/rc-manifest.json',
  'infra/rc-workstation/Dockerfile',
  'infra/rc-workstation/compose.yml',
  'infra/rc-workstation/images.lock.json',
])

const SHARED_EVIDENCE_PATHS = Object.freeze([
  'artifacts/rc-preflight',
  'artifacts/rc-dependencies',
  'artifacts/rc-gates',
  'artifacts/rc-workflow-bootstrap',
  'artifacts/rc-matrix',
  'artifacts/golden-projects',
  'artifacts/security-audit.json',
  'artifacts/prompt-eval.json',
  'apps/web/playwright-report',
  'apps/web/test-results',
])

function safeRelativePath(value) {
  const normalized = String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!normalized || normalized.startsWith('/') || normalized.split('/').some((item) => !item || item === '.' || item === '..')) {
    throw new Error(`FIRST_RUN_EVIDENCE_PATH_UNSAFE:${value}`)
  }
  return normalized
}

function workflowPathFromRef(repository, workflowRef) {
  const prefix = repository ? `${repository}/` : ''
  const separator = workflowRef.lastIndexOf('@')
  if (!prefix || !workflowRef.startsWith(prefix) || separator <= prefix.length) return ''
  return workflowRef.slice(prefix.length, separator)
}

export function firstRunEvidenceProvenance(environment = process.env) {
  if (environment.GITHUB_ACTIONS !== 'true') return { provider: 'local' }
  const repository = String(environment.GITHUB_REPOSITORY ?? '')
  const workflowRef = String(environment.GITHUB_WORKFLOW_REF ?? '')
  const attempt = Number.parseInt(String(environment.GITHUB_RUN_ATTEMPT ?? ''), 10)
  return {
    provider: 'github-actions',
    repository,
    workflowName: String(environment.GITHUB_WORKFLOW ?? ''),
    workflowPath: workflowPathFromRef(repository, workflowRef),
    workflowRef,
    workflowRunId: String(environment.GITHUB_RUN_ID ?? ''),
    workflowRunAttempt: Number.isInteger(attempt) && attempt > 0 ? attempt : 0,
    artifactName: String(environment.RC_FIRST_RUN_ARTIFACT_NAME ?? ''),
  }
}

function provenanceIssues(provenance) {
  const issues = []
  if (!provenance || typeof provenance !== 'object') return [{ code: 'FIRST_RUN_EVIDENCE_PROVENANCE_MISSING' }]
  if (provenance.provider === 'local') return issues
  if (provenance.provider !== 'github-actions') return [{ code: 'FIRST_RUN_EVIDENCE_PROVENANCE_PROVIDER_INVALID' }]
  for (const key of ['repository', 'workflowName', 'workflowPath', 'workflowRef', 'workflowRunId', 'artifactName']) {
    if (!String(provenance[key] ?? '').trim()) issues.push({ code: 'FIRST_RUN_EVIDENCE_PROVENANCE_FIELD_MISSING', field: key })
  }
  if (provenance.workflowPath && provenance.workflowPath !== FIRST_RUN_WORKFLOW_PATH) issues.push({ code: 'FIRST_RUN_EVIDENCE_WORKFLOW_PATH_INVALID', path: provenance.workflowPath })
  if (!/^\d+$/.test(String(provenance.workflowRunId ?? ''))) issues.push({ code: 'FIRST_RUN_EVIDENCE_WORKFLOW_RUN_ID_INVALID' })
  if (!Number.isInteger(provenance.workflowRunAttempt) || provenance.workflowRunAttempt < 1) issues.push({ code: 'FIRST_RUN_EVIDENCE_WORKFLOW_ATTEMPT_INVALID' })
  if (!/^rc-first-real-run-(?:core|full|release)-[a-f0-9]{40}-attempt-[1-9][0-9]*$/i.test(String(provenance.artifactName ?? ''))) issues.push({ code: 'FIRST_RUN_EVIDENCE_ARTIFACT_NAME_INVALID' })
  return issues
}

function walk(root, relativePath, output) {
  const normalized = safeRelativePath(relativePath)
  const target = resolve(root, normalized)
  if (!existsSync(target)) return
  const stat = lstatSync(target)
  if (stat.isSymbolicLink()) throw new Error(`FIRST_RUN_EVIDENCE_SYMLINK:${normalized}`)
  if (stat.isDirectory()) {
    for (const name of readdirSync(target).sort()) walk(root, `${normalized}/${name}`, output)
    return
  }
  if (stat.isFile()) output.push(normalized)
}

async function digestFile(root, relativePath) {
  const content = await readFile(resolve(root, relativePath))
  return {
    path: relativePath,
    bytes: content.byteLength,
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

function evidencePaths(runId) {
  return [
    ...STATIC_EVIDENCE_PATHS,
    `artifacts/rc-first-run/${runId}/sealed-state.json`,
    `artifacts/rc-first-run/${runId}/workstation-image.json`,
    `artifacts/rc-first-run/${runId}/workstation-inputs.sha256`,
    `artifacts/rc-first-run/${runId}/logs`,
    ...SHARED_EVIDENCE_PATHS,
    `artifacts/rc-triage/first-run-${runId}`,
  ]
}

function checksumText(manifestRelativePath, manifestSha256, files) {
  return `${[
    `${manifestSha256}  ${manifestRelativePath}`,
    ...files.map((item) => `${item.sha256}  ${item.path}`),
  ].join('\n')}\n`
}

export async function sealFirstRunEvidence({ root = process.cwd(), runDirectory, state, environment = process.env }) {
  if (!state || typeof state !== 'object') throw new Error('FIRST_RUN_EVIDENCE_STATE_INVALID')
  const resolvedRunDirectory = resolve(runDirectory)
  const expectedRunDirectory = resolve(root, 'artifacts/rc-first-run', state.runId)
  if (resolvedRunDirectory !== expectedRunDirectory) throw new Error('FIRST_RUN_EVIDENCE_RUN_DIRECTORY_MISMATCH')

  const provenance = firstRunEvidenceProvenance(environment)
  const invalidProvenance = provenanceIssues(provenance)
  if (invalidProvenance.length) throw new Error(`FIRST_RUN_EVIDENCE_PROVENANCE_INVALID:${invalidProvenance.map((item) => item.field ?? item.code).join(',')}`)

  const sealedAt = new Date().toISOString()
  const sealedState = { ...state, evidence: { status: 'sealed', sealedAt } }
  await mkdir(resolvedRunDirectory, { recursive: true })
  await writeFile(resolve(resolvedRunDirectory, 'sealed-state.json'), `${JSON.stringify(sealedState, null, 2)}\n`, { mode: 0o600 })

  for (const stage of sealedState.stages ?? []) {
    for (const attempt of stage.attempts ?? []) {
      if (attempt.logPath && !existsSync(resolve(root, safeRelativePath(attempt.logPath)))) {
        throw new Error(`FIRST_RUN_EVIDENCE_LOG_MISSING:${attempt.logPath}`)
      }
    }
  }

  const paths = []
  for (const path of evidencePaths(state.runId)) walk(root, path, paths)
  const manifestRelativePath = `artifacts/rc-first-run/${state.runId}/evidence-manifest.json`
  const checksumsRelativePath = `artifacts/rc-first-run/${state.runId}/SHA256SUMS`
  const excluded = new Set([manifestRelativePath, checksumsRelativePath])
  const unique = [...new Set(paths.filter((path) => !excluded.has(path)))].sort()
  if (!unique.includes(`artifacts/rc-first-run/${state.runId}/sealed-state.json`)) throw new Error('FIRST_RUN_EVIDENCE_SEALED_STATE_MISSING')
  if (unique.length > 20_000) throw new Error(`FIRST_RUN_EVIDENCE_FILE_LIMIT:${unique.length}`)

  const files = []
  for (const path of unique) files.push(await digestFile(root, path))
  const manifest = {
    schemaVersion: 1,
    algorithm: 'sha256',
    runId: state.runId,
    candidateVersion: state.candidateVersion,
    profile: state.profile,
    commit: state.commit,
    status: state.status,
    sealedAt,
    provenance,
    fileCount: files.length,
    files,
  }
  const manifestPath = resolve(root, manifestRelativePath)
  const checksumsPath = resolve(root, checksumsRelativePath)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  const manifestSha256 = createHash('sha256').update(await readFile(manifestPath)).digest('hex')
  await writeFile(checksumsPath, checksumText(manifestRelativePath, manifestSha256, files), { mode: 0o600 })
  return {
    manifest,
    manifestPath: relative(root, manifestPath).split(sep).join('/'),
    checksumsPath: relative(root, checksumsPath).split(sep).join('/'),
    manifestSha256,
  }
}

export async function verifyFirstRunEvidence({ root = process.cwd(), runId }) {
  const manifestRelativePath = `artifacts/rc-first-run/${runId}/evidence-manifest.json`
  const checksumsRelativePath = `artifacts/rc-first-run/${runId}/SHA256SUMS`
  const manifestPath = resolve(root, manifestRelativePath)
  const checksumsPath = resolve(root, checksumsRelativePath)
  const issues = []
  if (!existsSync(manifestPath)) return { ok: false, issues: [{ code: 'FIRST_RUN_EVIDENCE_MANIFEST_MISSING', path: manifestPath }] }
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    return { ok: false, issues: [{ code: 'FIRST_RUN_EVIDENCE_MANIFEST_INVALID', message: error instanceof Error ? error.message : String(error) }] }
  }
  if (manifest.schemaVersion !== 1 || manifest.algorithm !== 'sha256') issues.push({ code: 'FIRST_RUN_EVIDENCE_SCHEMA_INVALID' })
  if (manifest.runId !== runId) issues.push({ code: 'FIRST_RUN_EVIDENCE_RUN_ID_MISMATCH' })
  issues.push(...provenanceIssues(manifest.provenance))
  if (!Array.isArray(manifest.files)) issues.push({ code: 'FIRST_RUN_EVIDENCE_FILES_INVALID' })
  const files = Array.isArray(manifest.files) ? manifest.files : []
  if (manifest.fileCount !== files.length) issues.push({ code: 'FIRST_RUN_EVIDENCE_FILE_COUNT_MISMATCH' })
  const listedPaths = files.map((item) => item.path)
  if (listedPaths.join('\n') !== [...listedPaths].sort().join('\n')) issues.push({ code: 'FIRST_RUN_EVIDENCE_FILES_UNSORTED' })

  const seen = new Set()
  for (const item of files) {
    let path
    try { path = safeRelativePath(item.path) } catch (error) {
      issues.push({ code: 'FIRST_RUN_EVIDENCE_PATH_INVALID', message: error instanceof Error ? error.message : String(error) })
      continue
    }
    if (seen.has(path)) {
      issues.push({ code: 'FIRST_RUN_EVIDENCE_PATH_DUPLICATE', path })
      continue
    }
    seen.add(path)
    const target = resolve(root, path)
    if (!existsSync(target)) {
      issues.push({ code: 'FIRST_RUN_EVIDENCE_FILE_MISSING', path })
      continue
    }
    const actual = await digestFile(root, path)
    if (actual.sha256 !== item.sha256 || actual.bytes !== item.bytes) issues.push({ code: 'FIRST_RUN_EVIDENCE_DIGEST_MISMATCH', path })
  }

  const manifestSha256 = createHash('sha256').update(await readFile(manifestPath)).digest('hex')
  if (!existsSync(checksumsPath)) issues.push({ code: 'FIRST_RUN_EVIDENCE_CHECKSUMS_MISSING', path: checksumsRelativePath })
  else {
    const expectedChecksums = checksumText(manifestRelativePath, manifestSha256, files)
    const actualChecksums = await readFile(checksumsPath, 'utf8')
    if (actualChecksums !== expectedChecksums) issues.push({ code: 'FIRST_RUN_EVIDENCE_CHECKSUMS_MISMATCH', path: checksumsRelativePath })
  }

  const sealedStatePath = `artifacts/rc-first-run/${runId}/sealed-state.json`
  if (!seen.has(sealedStatePath)) issues.push({ code: 'FIRST_RUN_EVIDENCE_SEALED_STATE_UNLISTED', path: sealedStatePath })
  else {
    try {
      const sealedState = JSON.parse(await readFile(resolve(root, sealedStatePath), 'utf8'))
      if (sealedState.runId !== manifest.runId || sealedState.commit !== manifest.commit || sealedState.profile !== manifest.profile || sealedState.status !== manifest.status) {
        issues.push({ code: 'FIRST_RUN_EVIDENCE_STATE_MISMATCH', path: sealedStatePath })
      }
    } catch (error) {
      issues.push({ code: 'FIRST_RUN_EVIDENCE_STATE_INVALID', path: sealedStatePath, message: error instanceof Error ? error.message : String(error) })
    }
  }
  return { ok: issues.length === 0, issues, manifest, manifestSha256 }
}

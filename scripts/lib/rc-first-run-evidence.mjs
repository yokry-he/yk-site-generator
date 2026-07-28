import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'

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

export async function sealFirstRunEvidence({ root = process.cwd(), runDirectory, state }) {
  if (!state || typeof state !== 'object') throw new Error('FIRST_RUN_EVIDENCE_STATE_INVALID')
  const resolvedRunDirectory = resolve(runDirectory)
  const expectedRunDirectory = resolve(root, 'artifacts/rc-first-run', state.runId)
  if (resolvedRunDirectory !== expectedRunDirectory) throw new Error('FIRST_RUN_EVIDENCE_RUN_DIRECTORY_MISMATCH')

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
  const excluded = new Set([
    `artifacts/rc-first-run/${state.runId}/evidence-manifest.json`,
    `artifacts/rc-first-run/${state.runId}/SHA256SUMS`,
  ])
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
    fileCount: files.length,
    files,
  }
  const manifestPath = resolve(resolvedRunDirectory, 'evidence-manifest.json')
  const checksumsPath = resolve(resolvedRunDirectory, 'SHA256SUMS')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await writeFile(checksumsPath, `${files.map((item) => `${item.sha256}  ${item.path}`).join('\n')}\n`, { mode: 0o600 })
  const manifestSha256 = createHash('sha256').update(await readFile(manifestPath)).digest('hex')
  return {
    manifest,
    manifestPath: relative(root, manifestPath).split(sep).join('/'),
    checksumsPath: relative(root, checksumsPath).split(sep).join('/'),
    manifestSha256,
  }
}

export async function verifyFirstRunEvidence({ root = process.cwd(), runId }) {
  const runDirectory = resolve(root, 'artifacts/rc-first-run', runId)
  const manifestPath = resolve(runDirectory, 'evidence-manifest.json')
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
  const seen = new Set()
  for (const item of manifest.files ?? []) {
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
  return { ok: issues.length === 0, issues, manifest }
}

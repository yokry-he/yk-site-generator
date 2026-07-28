import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { verifyRcEvidence, type SignedRcEvidence } from './lib/rc-evidence'
import { validateRcSignedGateMetadata, verifyRcFirstRunAdmission } from './lib/rc-release-admission.mjs'

interface RcManifest {
  schemaVersion: 1
  candidateVersion: string
  maximumEvidenceAgeHours: number
  allowedSources: string[]
  requiredGates: string[]
}

function arg(name: string, fallback = '') {
  const inline = process.argv.find((item) => item.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

async function files(root: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) result.push(...await files(target))
    else if (entry.isFile() && entry.name.endsWith('.json')) result.push(target)
  }
  return result
}

const manifest = JSON.parse(await readFile(arg('manifest', 'release/rc-manifest.json'), 'utf8')) as RcManifest
const version = arg('version', process.env.RC_CANDIDATE_VERSION || manifest.candidateVersion)
const commit = arg('commit', process.env.GITHUB_SHA || process.env.RC_COMMIT || '')
if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('A full candidate commit SHA is required')
if (version !== manifest.candidateVersion) throw new Error(`Candidate version mismatch: ${version} != ${manifest.candidateVersion}`)

const firstRun = await verifyRcFirstRunAdmission({
  root: process.cwd(),
  run: arg('first-run', 'latest'),
  candidateVersion: version,
  commit,
  workflowRunId: arg('first-run-workflow-run-id', process.env.RC_FIRST_RUN_WORKFLOW_RUN_ID || ''),
  workflowRunAttempt: arg('first-run-workflow-run-attempt', process.env.RC_FIRST_RUN_WORKFLOW_RUN_ATTEMPT || ''),
  workflowCreatedAt: arg('first-run-workflow-created-at', process.env.RC_FIRST_RUN_WORKFLOW_CREATED_AT || ''),
  repository: arg('first-run-repository', process.env.GITHUB_REPOSITORY || ''),
  workflowName: arg('first-run-workflow-name', 'RC First Real Run'),
  workflowPath: arg('first-run-workflow-path', '.github/workflows/rc-first-real-run.yml'),
  artifactName: arg('first-run-artifact', process.env.RC_FIRST_RUN_ARTIFACT_NAME || ''),
  artifactId: arg('first-run-artifact-id', process.env.RC_FIRST_RUN_ARTIFACT_ID || ''),
  artifactDigest: arg('first-run-artifact-digest', process.env.RC_FIRST_RUN_ARTIFACT_DIGEST || ''),
  artifactSizeBytes: arg('first-run-artifact-size', process.env.RC_FIRST_RUN_ARTIFACT_SIZE || ''),
  artifactCreatedAt: arg('first-run-artifact-created-at', process.env.RC_FIRST_RUN_ARTIFACT_CREATED_AT || ''),
  artifactExpiresAt: arg('first-run-artifact-expires-at', process.env.RC_FIRST_RUN_ARTIFACT_EXPIRES_AT || ''),
  maximumAgeHours: manifest.maximumEvidenceAgeHours,
})

const releaseSource = arg('release-source', process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'isolated-runner')
const releaseWorkflowRunId = arg('release-workflow-run-id', process.env.GITHUB_RUN_ID || process.env.RC_RUN_ID || '')
const releaseWorkflowRunAttempt = arg('release-workflow-run-attempt', process.env.GITHUB_RUN_ATTEMPT || process.env.RC_RUN_ATTEMPT || '')
const releaseRepository = arg('release-repository', process.env.GITHUB_REPOSITORY || process.env.RC_REPOSITORY || '')
const releaseWorkflowPath = arg('release-workflow-path', process.env.RC_WORKFLOW_PATH || '.github/workflows/rc-release.yml')

const key = process.env.RC_EVIDENCE_SIGNING_KEY || ''
const evidenceRoot = path.resolve(arg('evidence', 'artifacts/rc-evidence'))
const verifiedRows: SignedRcEvidence[] = []
const issues = firstRun.issues.map((finding) => `first-run ${finding.code}: ${finding.message}`)

for (const file of await files(evidenceRoot)) {
  let row: SignedRcEvidence
  try {
    row = JSON.parse(await readFile(file, 'utf8')) as SignedRcEvidence
  } catch {
    issues.push(`${file}: invalid JSON`)
    continue
  }
  if (!verifyRcEvidence(row, key)) {
    issues.push(`${row.gate || file}: invalid signature`)
    continue
  }
  verifiedRows.push(row)
}

const gateMetadata = validateRcSignedGateMetadata({
  rows: verifiedRows,
  requiredGates: manifest.requiredGates,
  allowedSources: manifest.allowedSources,
  candidateVersion: version,
  commit,
  expectedSource: releaseSource,
  workflowRunId: releaseWorkflowRunId,
  workflowRunAttempt: releaseWorkflowRunAttempt,
  repository: releaseRepository,
  workflowPath: releaseWorkflowPath,
  maximumEvidenceAgeHours: manifest.maximumEvidenceAgeHours,
})
for (const finding of gateMetadata.issues) issues.push(`signed-gate ${finding.code}: ${finding.message}`)

if (issues.length) {
  console.error(`RC preparation blocked by ${issues.length} issue(s):`)
  for (const issue of issues) console.error(`- ${issue}`)
  process.exitCode = 1
} else {
  const output = path.resolve(arg('output', 'artifacts/rc-release'))
  await mkdir(output, { recursive: true })
  const evidence = manifest.requiredGates.map((gate) => gateMetadata.rowsByGate[gate] as SignedRcEvidence)
  const digest = createHash('sha256')
  for (const row of evidence) digest.update(row.gate).update('\0').update(row.signature).update('\0')
  const evidenceDigest = digest.digest('hex')
  const release = {
    schemaVersion: 2,
    candidateVersion: version,
    commit,
    status: 'ready-for-human-approval',
    assembledAt: new Date().toISOString(),
    firstRunAdmission: firstRun.admission,
    signedGateEvidence: {
      signatureAlgorithm: 'hmac-sha256',
      evidenceDigest,
      gateCount: evidence.length,
      source: releaseSource,
      repository: releaseRepository,
      workflowPath: releaseWorkflowPath,
      workflowRunId: releaseWorkflowRunId,
      workflowRunAttempt: Number.parseInt(releaseWorkflowRunAttempt, 10),
    },
    evidenceDigest,
    gates: evidence.map(({ signature, ...row }) => ({ ...row, signatureSha256: createHash('sha256').update(signature).digest('hex') })),
  }
  const manifestPath = path.join(output, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(release, null, 2)}\n`, 'utf8')
  const manifestBytes = await readFile(manifestPath)
  await writeFile(path.join(output, 'SHA256SUMS'), `${createHash('sha256').update(manifestBytes).digest('hex')}  manifest.json\n`, 'utf8')
  await writeFile(path.join(output, 'RELEASE_NOTES.md'), `# SiteForge ${version}\n\nCandidate commit: \`${commit}\`\n\nThe commit-bound release first run was admitted from GitHub Actions workflow run \`${firstRun.admission!.workflowRunId}\`, attempt \`${firstRun.admission!.workflowRunAttempt}\`, artifact ID \`${firstRun.admission!.artifactId}\`, and artifact digest \`${firstRun.admission!.artifactDigest}\`. Its SHA-256 seal and GitHub artifact digest provide integrity and source identity; they do not replace signed gate evidence.\n\nAll required RC gates were independently verified with HMAC-SHA-256 and bound to release workflow run \`${releaseWorkflowRunId}\`, attempt \`${releaseWorkflowRunAttempt}\`.\n\nThis bundle is ready for human approval; it does not create a tag, merge a branch, or deploy Production.\n`, 'utf8')
  console.log(`RC bundle ready: ${output}`)
}

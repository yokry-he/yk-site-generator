import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  safeEvidenceFileName,
  signRcEvidence,
  workflowPathFromRef,
  type RcEvidencePayload,
  type RcEvidenceStatus,
} from './lib/rc-evidence'

function arg(name: string, fallback = '') {
  const inline = process.argv.find((item) => item.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback
}

const gate = arg('gate')
if (!gate) throw new Error('--gate is required')
const status = arg('status', 'passed') as RcEvidenceStatus
if (!['passed', 'failed'].includes(status)) throw new Error('--status must be passed or failed')

const candidateVersion = arg('version', process.env.RC_CANDIDATE_VERSION || '0.1.0-rc.1')
const commit = arg('commit', process.env.GITHUB_SHA || process.env.RC_COMMIT || '')
if (!/^[a-f0-9]{40}$/i.test(commit)) throw new Error('A full candidate commit SHA is required')

const source = arg('source', process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'isolated-runner') as RcEvidencePayload['source']
if (!['github-actions', 'isolated-runner'].includes(source)) throw new Error('Unsupported evidence source')

const runId = arg('run-id', process.env.GITHUB_RUN_ID || process.env.RC_RUN_ID || 'local')
const repository = arg('repository', process.env.GITHUB_REPOSITORY || process.env.RC_REPOSITORY || '')
const workflowPath = arg(
  'workflow-path',
  workflowPathFromRef(repository, process.env.GITHUB_WORKFLOW_REF || '') || process.env.RC_WORKFLOW_PATH || '',
)
const runAttemptValue = arg('run-attempt', process.env.GITHUB_RUN_ATTEMPT || process.env.RC_RUN_ATTEMPT || '')
const workflowRunAttempt = Number.parseInt(runAttemptValue, 10)

if (source === 'github-actions') {
  if (!/^\d+$/.test(runId)) throw new Error('A numeric GitHub Actions run ID is required')
  if (!Number.isInteger(workflowRunAttempt) || workflowRunAttempt < 1) throw new Error('A positive GitHub Actions run attempt is required')
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) throw new Error('A GitHub repository is required')
  if (!/^\.github\/workflows\/[A-Za-z0-9._/-]+\.ya?ml$/.test(workflowPath)) throw new Error('A GitHub workflow path is required')
}

const payload: RcEvidencePayload = {
  schemaVersion: 1,
  candidateVersion,
  gate,
  status,
  trusted: true,
  source,
  commit,
  runId,
  workflowRunAttempt: Number.isInteger(workflowRunAttempt) && workflowRunAttempt > 0 ? workflowRunAttempt : undefined,
  repository: repository || undefined,
  workflowPath: workflowPath || undefined,
  observedAt: new Date().toISOString(),
  details: arg('details') || undefined,
  artifacts: arg('artifacts').split(',').map((item) => item.trim()).filter(Boolean),
}
const signature = signRcEvidence(payload, process.env.RC_EVIDENCE_SIGNING_KEY || '')
const output = path.resolve(arg('output', `artifacts/rc-evidence/${safeEvidenceFileName(gate)}.json`))
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify({ ...payload, signature }, null, 2)}\n`, 'utf8')
console.log(`Signed RC evidence: ${gate} → ${output}`)

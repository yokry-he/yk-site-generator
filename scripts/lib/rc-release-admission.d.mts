export interface RcReleaseAdmissionIssue {
  code: string
  message: string
  path?: string
}

export interface RcFirstRunAdmissionSummary {
  runId: string
  manifestSha256: string
  evidenceSealedAt: string
  workflowRunId: string
  workflowRunAttempt: number
  workflowCreatedAt: string
  repository: string
  workflowName: string
  workflowPath: string
  artifactName: string
  artifactId: number
  artifactDigest: string
  artifactSizeBytes: number
  artifactCreatedAt: string
  artifactExpiresAt: string
  maximumAgeHours: number
  triageStatus: string
  triageCounts: Record<'P0' | 'P1' | 'P2' | 'P3', number>
  integrityAlgorithm: 'sha256'
  authentication: 'github-actions-run-attempt-and-artifact-identity'
}

export interface RcFirstRunAdmissionResult {
  ok: boolean
  issues: RcReleaseAdmissionIssue[]
  runId?: string
  manifest?: unknown
  manifestSha256?: string
  triage?: unknown
  admission?: RcFirstRunAdmissionSummary
}

export interface RcSignedGateMetadataResult {
  ok: boolean
  issues: RcReleaseAdmissionIssue[]
  rowsByGate: Record<string, unknown>
}

export function validateRcReleaseWorkflowSource(source: string): RcReleaseAdmissionIssue[]

export function validateRcSignedGateMetadata(input: {
  rows: unknown[]
  requiredGates: string[]
  allowedSources: string[]
  candidateVersion: string
  commit: string
  expectedSource?: string
  workflowRunId: string
  workflowRunAttempt: string | number
  repository: string
  workflowPath: string
  maximumEvidenceAgeHours: number
  now?: number
}): RcSignedGateMetadataResult

export function verifyRcFirstRunAdmission(input: {
  root?: string
  run?: string
  candidateVersion: string
  commit: string
  workflowRunId: string
  workflowRunAttempt: string | number
  workflowCreatedAt: string
  repository: string
  workflowName?: string
  artifactName: string
  artifactId: string | number
  artifactDigest: string
  artifactSizeBytes: string | number
  artifactCreatedAt: string
  artifactExpiresAt: string
  workflowPath?: string
  maximumAgeHours: number
  now?: number
}): Promise<RcFirstRunAdmissionResult>

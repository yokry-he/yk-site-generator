export interface RcReleaseAdmissionIssue {
  code: string
  message: string
  path?: string
}

export interface RcFirstRunAdmissionSummary {
  runId: string
  manifestSha256: string
  workflowRunId: string
  repository: string
  workflowPath: string
  artifactName: string
  triageStatus: string
  triageCounts: Record<'P0' | 'P1' | 'P2' | 'P3', number>
  integrityAlgorithm: 'sha256'
  authentication: 'github-actions-run-and-artifact-source'
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

export function validateRcReleaseWorkflowSource(source: string): RcReleaseAdmissionIssue[]

export function verifyRcFirstRunAdmission(input: {
  root?: string
  run?: string
  candidateVersion: string
  commit: string
  workflowRunId: string
  repository: string
  artifactName: string
  workflowPath?: string
}): Promise<RcFirstRunAdmissionResult>

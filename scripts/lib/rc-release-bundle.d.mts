export interface RcReleaseBundleIssue {
  code: string
  message: string
  path?: string
}

export interface RcReleaseBundleVerification {
  ok: boolean
  issues: RcReleaseBundleIssue[]
  manifest?: unknown
  checksums?: Array<{ path: string; sha256: string }>
}

export const RC_RELEASE_BUNDLE_FILES: readonly ['RELEASE_NOTES.md', 'manifest.json']
export const RC_RELEASE_BUNDLE_ALL_FILES: readonly ['RELEASE_NOTES.md', 'manifest.json', 'SHA256SUMS']
export function rcReleaseBundleChecksumText(rows: Array<{ path: string; sha256: string }>): string
export function writeRcReleaseBundleChecksums(input: { bundleDirectory: string }): Promise<{ checksumPath: string; rows: Array<{ path: string; sha256: string }> }>
export function verifyRcReleaseBundle(input?: {
  bundleDirectory?: string
  expectedVersion?: string
  expectedCommit?: string
  expectedReleaseWorkflowRunId?: string | number
  expectedReleaseWorkflowRunAttempt?: string | number
  expectedRepository?: string
  expectedWorkflowPath?: string
  now?: number
}): Promise<RcReleaseBundleVerification>

import { describe, expect, it } from 'vitest'
import { signRcEvidence, verifyRcEvidence, type RcEvidencePayload } from '../../../scripts/lib/rc-evidence'

describe('RC signed evidence', () => {
  it('rejects body, commit, workflow attempt, and repository changes', () => {
    const key = 'rc-evidence-signing-key-2026-change-me'
    const row: RcEvidencePayload = {
      schemaVersion: 1,
      candidateVersion: '0.1.0-rc.1',
      gate: 'build',
      status: 'passed',
      trusted: true,
      source: 'github-actions',
      commit: 'a'.repeat(40),
      runId: '1',
      workflowRunAttempt: 2,
      repository: 'yokry-he/yk-site-generator',
      workflowPath: '.github/workflows/rc-release.yml',
      observedAt: new Date().toISOString(),
    }
    const signed = { ...row, signature: signRcEvidence(row, key) }
    expect(verifyRcEvidence(signed, key)).toBe(true)
    expect(verifyRcEvidence({ ...signed, commit: 'b'.repeat(40) }, key)).toBe(false)
    expect(verifyRcEvidence({ ...signed, workflowRunAttempt: 3 }, key)).toBe(false)
    expect(verifyRcEvidence({ ...signed, repository: 'other/repository' }, key)).toBe(false)
  })
})

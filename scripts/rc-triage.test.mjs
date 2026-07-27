import test from 'node:test'
import assert from 'node:assert/strict'
import { rcTriageShouldFail, renderRcTriageMarkdown, triageRcDiagnostics } from './lib/rc-triage.mjs'

const dependencyReport = {
  path: 'artifacts/rc-dependencies/latest.json',
  data: {
    mode: 'all',
    attempts: [
      { phase: 'fetch', attempt: 1, status: 'failed', category: 'REGISTRY_UNAVAILABLE', logPath: 'fetch-1.log' },
      { phase: 'fetch', attempt: 2, status: 'passed', logPath: 'fetch-2.log' },
      { phase: 'install', attempt: 1, status: 'failed', category: 'LOCKFILE_OUT_OF_SYNC', logPath: 'install-1.log' },
    ],
  },
}

const gateReport = {
  path: 'artifacts/rc-gates/latest.json',
  data: {
    profile: 'core',
    results: [
      { id: 'security', label: 'Security', status: 'failed', exitCode: 1, logPath: 'security.log' },
      { id: 'lint', label: 'Lint', status: 'failed', exitCode: 1, logPath: 'lint.log' },
    ],
  },
}

test('triage keeps only the final dependency attempt per phase', () => {
  const report = triageRcDiagnostics({ reports: [dependencyReport] })
  assert.equal(report.findings.length, 1)
  assert.equal(report.findings[0].code, 'LOCKFILE_OUT_OF_SYNC')
  assert.equal(report.findings[0].priority, 'P1')
  assert.equal(report.status, 'blocked')
})

test('security gate is P0 while lint is P2', () => {
  const report = triageRcDiagnostics({ reports: [gateReport] })
  assert.deepEqual(report.findings.map((item) => [item.code, item.priority]), [
    ['RC_GATE_SECURITY_FAILED', 'P0'],
    ['RC_GATE_LINT_FAILED', 'P2'],
  ])
  assert.equal(report.blockers, 1)
})

test('workflow bootstrap drift is P0 and duplicate reports are deduplicated', () => {
  const workflow = {
    path: 'artifacts/rc-workflow-bootstrap/latest.json',
    data: {
      action: './.github/actions/rc-node-bootstrap',
      workflows: [],
      issues: [{ code: 'DIRECT_PNPM_INSTALL', path: '.github/workflows/ci.yml', message: 'direct install' }],
    },
  }
  const report = triageRcDiagnostics({ reports: [workflow, { ...workflow, path: 'artifacts/copy/summary.json' }] })
  assert.equal(report.findings.length, 1)
  assert.equal(report.findings[0].priority, 'P0')
  assert.match(report.findings[0].remediation, /shared Store fetch/i)
})

test('external failed jobs become blocking P1 findings', () => {
  const report = triageRcDiagnostics({
    reports: [],
    allowMissing: true,
    externalStatuses: [{ scope: 'mysql-integration', status: 'failure' }],
  })
  assert.equal(report.findings.some((item) => item.code === 'WORKFLOW_JOB_FAILURE' && item.priority === 'P1'), true)
  assert.equal(report.findings.some((item) => item.code === 'RC_DIAGNOSTICS_NOT_FOUND' && item.priority === 'P3'), true)
  assert.equal(report.status, 'blocked')
})

test('missing diagnostics can be blocking or advisory', () => {
  const strict = triageRcDiagnostics({ reports: [], allowMissing: false })
  const advisory = triageRcDiagnostics({ reports: [], allowMissing: true })
  assert.equal(strict.blockers, 1)
  assert.equal(advisory.blockers, 0)
  assert.equal(advisory.status, 'clear')
})

test('failure thresholds and markdown are stable', () => {
  const report = triageRcDiagnostics({ reports: [gateReport] })
  assert.equal(rcTriageShouldFail(report, 'blocking'), true)
  assert.equal(rcTriageShouldFail(report, 'P0'), true)
  assert.equal(rcTriageShouldFail({ ...report, findings: report.findings.filter((item) => item.priority === 'P2'), blockers: 0 }, 'P1'), false)
  assert.equal(rcTriageShouldFail(report, 'never'), false)
  const markdown = renderRcTriageMarkdown(report, { commit: 'abc123', workflowRunId: '42' })
  assert.match(markdown, /RC Diagnostic Triage/)
  assert.match(markdown, /abc123/)
  assert.match(markdown, /RC_GATE_SECURITY_FAILED/)
})

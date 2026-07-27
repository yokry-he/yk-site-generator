export const RC_TRIAGE_PRIORITIES = Object.freeze(['P0', 'P1', 'P2', 'P3'])

const DEPENDENCY_PRIORITY = Object.freeze({
  TARBALL_INTEGRITY_FAILURE: 'P0',
  LOCKFILE_OUT_OF_SYNC: 'P1',
  OFFLINE_STORE_INCOMPLETE: 'P1',
  LIFECYCLE_SCRIPT_FAILURE: 'P1',
  DISK_SPACE_EXHAUSTED: 'P1',
  FILESYSTEM_PERMISSION_DENIED: 'P1',
  PEER_DEPENDENCY_CONFLICT: 'P1',
  REGISTRY_UNAVAILABLE: 'P2',
  UNKNOWN_DEPENDENCY_FAILURE: 'P1',
})

const GATE_PRIORITY = Object.freeze({
  security: 'P0',
  integrity: 'P0',
  'runner-images': 'P0',
  preflight: 'P1',
  'workflow-bootstrap': 'P1',
  'triage-contract': 'P1',
  golden: 'P1',
  typecheck: 'P1',
  build: 'P1',
  unit: 'P1',
  history: 'P1',
  browser: 'P1',
  visual: 'P1',
  lint: 'P2',
  docs: 'P2',
  bundle: 'P2',
  'prompt-quality': 'P2',
})

const REMEDIATION = Object.freeze({
  REGISTRY_UNAVAILABLE: 'Check Registry reachability and credentials, then rerun only the dependency fetch phase.',
  LOCKFILE_OUT_OF_SYNC: 'Regenerate pnpm-lock.yaml with pnpm 11, review the lockfile diff, and rerun the frozen install.',
  TARBALL_INTEGRITY_FAILURE: 'Stop the release, purge the affected Store entry, and verify the package source and integrity metadata.',
  OFFLINE_STORE_INCOMPLETE: 'Rerun the fetch phase with network access and verify the pnpm Store cache key.',
  LIFECYCLE_SCRIPT_FAILURE: 'Inspect the lifecycle log and fix the failing package script without disabling install scripts globally.',
  DISK_SPACE_EXHAUSTED: 'Free runner disk space or increase the job disk budget before retrying.',
  FILESYSTEM_PERMISSION_DENIED: 'Correct workspace or Store ownership and rerun without elevated install privileges.',
  PEER_DEPENDENCY_CONFLICT: 'Resolve the declared peer range or pin a compatible dependency version.',
  UNKNOWN_DEPENDENCY_FAILURE: 'Inspect the dependency NDJSON log and add a stable classifier before retrying repeatedly.',
  RC_BOOTSTRAP_MISSING: 'Route the Workflow through ./.github/actions/rc-node-bootstrap.',
  DIRECT_PNPM_SETUP: 'Remove the direct pnpm setup and use the shared RC Node bootstrap action.',
  DIRECT_NODE_SETUP: 'Remove the direct Node setup and use the shared RC Node bootstrap action.',
  DIRECT_PNPM_INSTALL: 'Replace direct installation with the shared Store fetch and offline frozen install.',
  DIRECT_DEPENDENCY_BOOTSTRAP: 'Call the shared Bootstrap action instead of invoking the dependency script directly.',
  RC_BOOTSTRAP_ARTIFACT_NAME_MISSING: 'Provide a unique artifact-name for every shared Bootstrap invocation.',
})

export function detectRcDiagnosticType(path, data) {
  const value = String(path ?? '').toLowerCase()
  if (Array.isArray(data?.attempts) && typeof data?.mode === 'string') return 'dependencies'
  if (Array.isArray(data?.results) && typeof data?.profile === 'string') return 'gates'
  if (Array.isArray(data?.workflows) && typeof data?.action === 'string') return 'workflow-bootstrap'
  if (Array.isArray(data?.issues) && data?.tools && data?.counts) return 'preflight'
  if (value.includes('security-audit')) return 'security'
  if (value.includes('rc-matrix') || data?.project || Array.isArray(data?.steps)) return 'matrix'
  if (value.includes('rc-release') || data?.candidateVersion) return 'release'
  return 'generic'
}

function priorityRank(priority) {
  const index = RC_TRIAGE_PRIORITIES.indexOf(priority)
  return index === -1 ? RC_TRIAGE_PRIORITIES.length : index
}

function normalizeStatus(value) {
  return String(value ?? '').trim().toLowerCase()
}

function finding(input) {
  const priority = RC_TRIAGE_PRIORITIES.includes(input.priority) ? input.priority : 'P2'
  return {
    id: input.id,
    priority,
    blocking: input.blocking ?? ['P0', 'P1'].includes(priority),
    source: input.source,
    category: input.category,
    code: input.code,
    title: input.title,
    detail: input.detail ?? '',
    remediation: input.remediation ?? REMEDIATION[input.code] ?? 'Inspect the cited diagnostic and rerun the narrowest affected gate.',
    evidencePath: input.evidencePath,
    owner: input.owner ?? 'release-engineering',
  }
}

function fromPreflight(report) {
  return (report.data.issues ?? []).map((issue, index) => finding({
    id: `preflight:${issue.code ?? index}:${report.path}`,
    priority: issue.severity === 'error' ? 'P1' : 'P3',
    source: 'preflight',
    category: 'environment',
    code: issue.code ?? 'PREFLIGHT_ISSUE',
    title: issue.message ?? 'RC environment preflight issue',
    detail: issue.path ?? '',
    evidencePath: report.path,
    owner: 'developer-experience',
  }))
}

function fromDependencies(report) {
  const latestByPhase = new Map()
  for (const attempt of report.data.attempts ?? []) latestByPhase.set(attempt.phase, attempt)
  return [...latestByPhase.values()]
    .filter((attempt) => normalizeStatus(attempt.status) !== 'passed')
    .map((attempt) => {
      const code = attempt.category ?? 'UNKNOWN_DEPENDENCY_FAILURE'
      return finding({
        id: `dependencies:${attempt.phase}:${code}:${report.path}`,
        priority: DEPENDENCY_PRIORITY[code] ?? 'P1',
        source: 'dependencies',
        category: 'supply-chain',
        code,
        title: `${attempt.phase} dependency phase ${attempt.status ?? 'failed'}`,
        detail: `Attempt ${attempt.attempt ?? '?'}; log ${attempt.logPath ?? report.path}`,
        evidencePath: attempt.logPath ?? report.path,
        owner: code === 'REGISTRY_UNAVAILABLE' ? 'platform-infrastructure' : 'dependency-maintainers',
      })
    })
}

function fromGates(report) {
  return (report.data.results ?? [])
    .filter((result) => normalizeStatus(result.status) !== 'passed')
    .map((result) => {
      const gate = result.id ?? 'unknown'
      const priority = GATE_PRIORITY[gate] ?? 'P1'
      return finding({
        id: `gate:${gate}:${report.path}`,
        priority,
        source: 'gates',
        category: 'quality-gate',
        code: `RC_GATE_${String(gate).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${String(result.status ?? 'FAILED').toUpperCase()}`,
        title: `${result.label ?? gate} ${result.status ?? 'failed'}`,
        detail: `Exit ${result.exitCode ?? 'n/a'}; log ${result.logPath ?? report.path}`,
        evidencePath: result.logPath ?? report.path,
        owner: ['security', 'integrity', 'runner-images'].includes(gate) ? 'security-engineering' : 'application-engineering',
      })
    })
}

function fromWorkflowBootstrap(report) {
  return (report.data.issues ?? []).map((issue, index) => finding({
    id: `workflow:${issue.code ?? index}:${issue.path ?? report.path}`,
    priority: 'P0',
    source: 'workflow-bootstrap',
    category: 'ci-policy',
    code: issue.code ?? 'WORKFLOW_BOOTSTRAP_DRIFT',
    title: issue.message ?? 'Workflow bypasses the shared RC Bootstrap',
    detail: issue.path ?? '',
    evidencePath: report.path,
    owner: 'release-engineering',
  }))
}

function fromSecurity(report) {
  const issues = report.data.issues ?? report.data.findings ?? []
  return issues.map((issue, index) => {
    const severity = normalizeStatus(issue.severity)
    const priority = severity === 'critical' ? 'P0' : severity === 'high' || severity === 'error' ? 'P1' : 'P2'
    return finding({
      id: `security:${issue.code ?? index}:${report.path}`,
      priority,
      source: 'security',
      category: 'security',
      code: issue.code ?? 'SECURITY_AUDIT_FINDING',
      title: issue.message ?? issue.title ?? 'Security audit finding',
      detail: issue.path ?? issue.detail ?? '',
      evidencePath: report.path,
      owner: 'security-engineering',
    })
  })
}

function fromMatrix(report) {
  const status = normalizeStatus(report.data.status ?? (report.data.ok === false ? 'failed' : 'passed'))
  if (status === 'passed' || status === 'success') return []
  return [finding({
    id: `matrix:${report.data.project ?? 'unknown'}:${report.path}`,
    priority: 'P1',
    source: 'matrix',
    category: 'runtime-matrix',
    code: 'RUNTIME_MATRIX_FAILED',
    title: `${report.data.project ?? 'Runtime matrix'} ${status || 'failed'}`,
    detail: report.data.error ?? report.data.message ?? '',
    evidencePath: report.path,
    owner: 'stack-maintainers',
  })]
}

function fromGeneric(report) {
  if (report.data?.ok !== false && !['failed', 'failure', 'cancelled'].includes(normalizeStatus(report.data?.status))) return []
  return [finding({
    id: `generic:${report.path}`,
    priority: 'P1',
    source: 'generic',
    category: 'diagnostic',
    code: 'RC_DIAGNOSTIC_REPORT_FAILED',
    title: `Diagnostic report failed: ${report.path}`,
    detail: report.data?.message ?? report.data?.error ?? '',
    evidencePath: report.path,
  })]
}

export function findingsFromReport(report) {
  const type = detectRcDiagnosticType(report.path, report.data)
  if (type === 'preflight') return fromPreflight(report)
  if (type === 'dependencies') return fromDependencies(report)
  if (type === 'gates') return fromGates(report)
  if (type === 'workflow-bootstrap') return fromWorkflowBootstrap(report)
  if (type === 'security') return fromSecurity(report)
  if (type === 'matrix') return fromMatrix(report)
  return fromGeneric(report)
}

export function findingFromExternalStatus(scope, status) {
  const normalized = normalizeStatus(status)
  if (['success', 'passed'].includes(normalized)) return undefined
  const priority = normalized === 'failure' || normalized === 'failed' ? 'P1' : 'P2'
  return finding({
    id: `external:${scope}:${normalized || 'unknown'}`,
    priority,
    source: 'workflow-job',
    category: 'workflow-result',
    code: `WORKFLOW_JOB_${String(normalized || 'UNKNOWN').toUpperCase()}`,
    title: `${scope} job ${normalized || 'unknown'}`,
    detail: 'Inspect the job log together with the aggregated diagnostic artifacts.',
    evidencePath: `github-actions:${scope}`,
    owner: scope.includes('browser') ? 'frontend-engineering' : scope.includes('mysql') || scope.includes('redis') ? 'platform-engineering' : 'release-engineering',
  })
}

function deduplicate(findings) {
  const rows = new Map()
  for (const item of findings) {
    const key = [item.source, item.code, item.title, item.detail].join('\u0000')
    const previous = rows.get(key)
    if (!previous || priorityRank(item.priority) < priorityRank(previous.priority)) rows.set(key, item)
  }
  return [...rows.values()].sort((left, right) => priorityRank(left.priority) - priorityRank(right.priority) || left.code.localeCompare(right.code))
}

export function triageRcDiagnostics({ reports = [], externalStatuses = [], allowMissing = false } = {}) {
  const findings = []
  for (const report of reports) findings.push(...findingsFromReport(report))
  for (const item of externalStatuses) {
    const next = findingFromExternalStatus(item.scope, item.status)
    if (next) findings.push(next)
  }
  if (!reports.length) {
    findings.push(finding({
      id: 'diagnostics:none',
      priority: allowMissing ? 'P3' : 'P1',
      blocking: !allowMissing,
      source: 'triage',
      category: 'diagnostic-coverage',
      code: 'RC_DIAGNOSTICS_NOT_FOUND',
      title: 'No RC diagnostic JSON reports were found',
      remediation: 'Verify artifact download paths and ensure failed jobs upload diagnostics with always().',
      owner: 'release-engineering',
    }))
  }
  const unique = deduplicate(findings)
  const counts = Object.fromEntries(RC_TRIAGE_PRIORITIES.map((priority) => [priority, unique.filter((item) => item.priority === priority).length]))
  const blockers = unique.filter((item) => item.blocking)
  const status = blockers.length ? 'blocked' : unique.some((item) => item.priority === 'P2') ? 'needs-attention' : 'clear'
  return {
    schemaVersion: 1,
    status,
    counts,
    blockers: blockers.length,
    findings: unique,
    nextActions: unique.slice(0, 10).map((item) => ({ priority: item.priority, code: item.code, action: item.remediation, owner: item.owner })),
  }
}

export function renderRcTriageMarkdown(report, metadata = {}) {
  const lines = [
    '# RC Diagnostic Triage',
    '',
    `- Status: **${report.status}**`,
    `- Commit: \`${metadata.commit || 'unknown'}\``,
    `- Workflow run: \`${metadata.workflowRunId || 'local'}\``,
    `- Findings: P0=${report.counts.P0}, P1=${report.counts.P1}, P2=${report.counts.P2}, P3=${report.counts.P3}`,
    `- Blocking findings: ${report.blockers}`,
    '',
    '| Priority | Code | Owner | Finding | Evidence |',
    '| --- | --- | --- | --- | --- |',
  ]
  if (!report.findings.length) lines.push('| - | - | - | No findings | - |')
  for (const item of report.findings) {
    const text = `${item.title}${item.detail ? ` — ${item.detail}` : ''}`.replace(/\|/g, '\\|')
    lines.push(`| ${item.priority} | \`${item.code}\` | ${item.owner} | ${text} | \`${item.evidencePath ?? '-'}\` |`)
  }
  lines.push('', '## Next actions', '')
  if (!report.nextActions.length) lines.push('- No remediation is required from the available diagnostics.')
  for (const item of report.nextActions) lines.push(`- **${item.priority} ${item.code}** (${item.owner}): ${item.action}`)
  lines.push('')
  return lines.join('\n')
}

export function rcTriageShouldFail(report, failOn = 'blocking') {
  const normalized = String(failOn ?? 'blocking').toLowerCase()
  if (normalized === 'never' || normalized === 'none') return false
  if (normalized === 'blocking') return report.blockers > 0
  const threshold = normalized.toUpperCase()
  const rank = priorityRank(threshold)
  if (rank >= RC_TRIAGE_PRIORITIES.length) throw new Error(`UNKNOWN_TRIAGE_FAIL_THRESHOLD:${failOn}`)
  return report.findings.some((item) => priorityRank(item.priority) <= rank)
}

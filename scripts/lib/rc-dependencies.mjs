export const DEPENDENCY_FAILURE_CATEGORIES = Object.freeze({
  registry: 'REGISTRY_UNAVAILABLE',
  lockfile: 'LOCKFILE_OUT_OF_SYNC',
  integrity: 'TARBALL_INTEGRITY_FAILURE',
  store: 'OFFLINE_STORE_INCOMPLETE',
  lifecycle: 'LIFECYCLE_SCRIPT_FAILURE',
  disk: 'DISK_SPACE_EXHAUSTED',
  permission: 'FILESYSTEM_PERMISSION_DENIED',
  peer: 'PEER_DEPENDENCY_CONFLICT',
  unknown: 'UNKNOWN_DEPENDENCY_FAILURE',
})

const patterns = [
  [DEPENDENCY_FAILURE_CATEGORIES.integrity, /ERR_PNPM_TARBALL_INTEGRITY|integrity checksum|integrity verification failed/i],
  [DEPENDENCY_FAILURE_CATEGORIES.lockfile, /ERR_PNPM_(?:OUTDATED_LOCKFILE|FROZEN_LOCKFILE)|frozen[- ]lockfile|lockfile is out of date|lockfile.*needs an update/i],
  [DEPENDENCY_FAILURE_CATEGORIES.store, /ERR_PNPM_NO_OFFLINE_TARBALL|not found in (?:the )?store|offline mode|no cached metadata|package is missing from the store/i],
  [DEPENDENCY_FAILURE_CATEGORIES.disk, /ENOSPC|no space left on device|disk quota exceeded/i],
  [DEPENDENCY_FAILURE_CATEGORIES.permission, /EACCES|EPERM|permission denied|operation not permitted/i],
  [DEPENDENCY_FAILURE_CATEGORIES.lifecycle, /ELIFECYCLE|lifecycle script|postinstall|preinstall|install script failed/i],
  [DEPENDENCY_FAILURE_CATEGORIES.peer, /ERR_PNPM_PEER_DEP_ISSUES|unmet peer|peer dependency.*conflict/i],
  [DEPENDENCY_FAILURE_CATEGORIES.registry, /ERR_PNPM_(?:FETCH|META_FETCH)|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|HTTP[_ ](?:429|5\d\d)|status(?:Code)?["':= ]+(?:429|5\d\d)|(?:registry|tarball).*(?:429|500|502|503|504)/i],
]

export function classifyDependencyFailure(output) {
  const value = String(output ?? '')
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? DEPENDENCY_FAILURE_CATEGORIES.unknown
}

export function dependencyFailureIsRetryable(category) {
  return category === DEPENDENCY_FAILURE_CATEGORIES.registry
}

export function dependencyCommand(phase) {
  if (phase === 'fetch') return { command: 'pnpm', args: ['fetch', '--reporter=ndjson'] }
  if (phase === 'install') return { command: 'pnpm', args: ['install', '--offline', '--frozen-lockfile', '--reporter=ndjson'] }
  throw new Error(`UNKNOWN_DEPENDENCY_PHASE:${phase}`)
}

export function retryDelayMs(attempt, baseDelayMs = 5_000, maximumDelayMs = 30_000) {
  const normalizedAttempt = Math.max(1, Math.trunc(Number(attempt) || 1))
  const normalizedBase = Math.max(0, Math.trunc(Number(baseDelayMs) || 0))
  return Math.min(maximumDelayMs, normalizedBase * 2 ** (normalizedAttempt - 1))
}

export function secretValuesFromEnvironment(environment) {
  const values = Object.entries(environment ?? {})
    .filter(([key, value]) => /(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|SIGNING_KEY|AUTH)/i.test(key) && typeof value === 'string')
    .map(([, value]) => value.trim())
    .filter((value) => value.length >= 8 && !/^(?:true|false|undefined|null)$/i.test(value))
  return [...new Set(values)].sort((left, right) => right.length - left.length)
}

export function redactDependencyOutput(value, secrets = []) {
  let output = String(value ?? '')
  for (const secret of secrets) output = output.split(secret).join('[REDACTED]')
  return output
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:https?|mysql|postgres(?:ql)?|redis|rediss):\/\/[^\s:@/]+:)[^\s@/]+@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:token|secret|password|api[_-]?key|auth)=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/("(?:token|secret|password|authorization|auth)"\s*:\s*")[^"]+("?)/gi, '$1[REDACTED]$2')
}

export function safeDependencyCommand(phase) {
  const { command, args } = dependencyCommand(phase)
  return [command, ...args].join(' ')
}

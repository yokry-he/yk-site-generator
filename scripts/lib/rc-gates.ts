export type RcGateProfile = 'core' | 'full'

export interface RcGateDefinition {
  id: string
  label: string
  command: string
  args: string[]
  profiles: RcGateProfile[]
  timeoutMinutes?: number
}

export const RC_GATE_DEFINITIONS: readonly RcGateDefinition[] = [
  { id: 'preflight', label: 'RC environment preflight', command: 'pnpm', args: ['rc:preflight'], profiles: ['core', 'full'] },
  { id: 'workflow-bootstrap', label: 'RC Workflow Bootstrap drift', command: 'pnpm', args: ['rc:workflow-bootstrap'], profiles: ['core', 'full'] },
  { id: 'triage-contract', label: 'RC diagnostic triage contract', command: 'pnpm', args: ['rc:triage:test'], profiles: ['core', 'full'] },
  { id: 'workstation-contract', label: 'RC Workstation policy', command: 'pnpm', args: ['rc:workstation:validate'], profiles: ['core', 'full'] },
  { id: 'first-run-contract', label: 'RC first real run contract', command: 'pnpm', args: ['rc:first-run:test'], profiles: ['core', 'full'] },
  { id: 'lint', label: 'Lint', command: 'pnpm', args: ['lint'], profiles: ['core', 'full'] },
  { id: 'docs', label: 'Bilingual docs', command: 'pnpm', args: ['docs:check'], profiles: ['core', 'full'] },
  { id: 'integrity', label: 'RC scaffold integrity', command: 'pnpm', args: ['rc:audit'], profiles: ['core', 'full'] },
  { id: 'security', label: 'RC security audit', command: 'pnpm', args: ['rc:security'], profiles: ['core', 'full'] },
  { id: 'golden', label: 'Golden project lock verification', command: 'pnpm', args: ['rc:golden'], profiles: ['core', 'full'] },
  { id: 'runner-images', label: 'Runner image policy', command: 'pnpm', args: ['runner:images:validate'], profiles: ['core', 'full'] },
  { id: 'typecheck', label: 'Typecheck', command: 'pnpm', args: ['typecheck'], profiles: ['core', 'full'] },
  { id: 'build', label: 'Workspace build', command: 'pnpm', args: ['build'], profiles: ['core', 'full'] },
  { id: 'bundle', label: 'Web bundle budget', command: 'pnpm', args: ['--filter', 'web', 'check:bundle-budget'], profiles: ['core', 'full'] },
  {
    id: 'prompt-quality',
    label: 'Prompt quality dry-run',
    command: 'pnpm',
    args: ['--filter', 'prompts', 'eval:quality', '--', '--dry-run', '--runs', '1', '--report', '../../artifacts/prompt-eval.json'],
    profiles: ['core', 'full'],
  },
  { id: 'unit', label: 'Workspace unit tests', command: 'pnpm', args: ['test'], profiles: ['core', 'full'], timeoutMinutes: 30 },
  { id: 'history', label: 'IndexedDB history recovery', command: 'pnpm', args: ['--filter', 'web', 'e2e:history'], profiles: ['full'] },
  { id: 'browser', label: 'Browser and accessibility E2E', command: 'pnpm', args: ['--filter', 'web', 'e2e:browser'], profiles: ['full'], timeoutMinutes: 30 },
  { id: 'visual', label: 'Visual regression', command: 'pnpm', args: ['--filter', 'web', 'e2e:visual'], profiles: ['full'], timeoutMinutes: 30 },
] as const

export function selectRcGates(
  profile: RcGateProfile,
  only: readonly string[] = [],
  skip: readonly string[] = [],
): RcGateDefinition[] {
  const onlySet = new Set(only.filter(Boolean))
  const skipSet = new Set(skip.filter(Boolean))
  const selected = RC_GATE_DEFINITIONS.filter((gate) => gate.profiles.includes(profile))
    .filter((gate) => !onlySet.size || onlySet.has(gate.id))
    .filter((gate) => !skipSet.has(gate.id))
  const known = new Set(RC_GATE_DEFINITIONS.map((gate) => gate.id))
  for (const id of [...onlySet, ...skipSet]) {
    if (!known.has(id)) throw new Error(`UNKNOWN_RC_GATE:${id}`)
  }
  return selected.map((gate) => ({ ...gate, args: [...gate.args], profiles: [...gate.profiles] }))
}

export function secretValuesFromEnvironment(environment: NodeJS.ProcessEnv): string[] {
  const values = Object.entries(environment)
    .filter(([key, value]) => /(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY|SIGNING_KEY)/i.test(key) && typeof value === 'string')
    .map(([, value]) => value!.trim())
    .filter((value) => value.length >= 8 && !/^(?:true|false|undefined|null)$/i.test(value))
  return [...new Set(values)].sort((a, b) => b.length - a.length)
}

export function redactRcGateOutput(value: string, secrets: readonly string[]): string {
  let output = value
  for (const secret of secrets) output = output.split(secret).join('[REDACTED]')
  return output
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:mysql|postgres(?:ql)?|redis|rediss):\/\/[^\s:@/]+:)[^\s@/]+@/gi, '$1[REDACTED]@')
    .replace(/([?&](?:token|secret|password|api[_-]?key)=)[^&\s]+/gi, '$1[REDACTED]')
}

export function safeRcGateCommand(gate: Pick<RcGateDefinition, 'command' | 'args'>): string {
  return [gate.command, ...gate.args].map((item) => (/^[A-Za-z0-9_./:=@+-]+$/.test(item) ? item : JSON.stringify(item))).join(' ')
}

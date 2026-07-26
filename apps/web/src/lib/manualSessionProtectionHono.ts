import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'
import { AUDIT_RETENTION_DAYS, LOGIN_LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS, SESSION_RETENTION_DAYS } from './manualSessionProtectionCommon'

export function honoProtection(files: ArtifactFile[], access: ManualAccessDefinition, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const sqlite = files.some((file) => file.path === 'apps/api/drizzle/0002_auth_identity_sessions.sql' && file.content.includes('AUTOINCREMENT'))
  const timeType = sqlite ? 'text' : 'timestamp'
  replaceFile(files, 'apps/api/src/schema.ts', (content) => `${content.trimEnd()}

export const authLoginEventTable = ${sqlite ? 'sqliteTable' : 'pgTable'}('auth_login_events', {
  id: integer('id').primaryKey(${sqlite ? '{ autoIncrement: true }' : ''})${sqlite ? '' : '.generatedAlwaysAsIdentity()'},
  principalHash: text('principal_hash').notNull(),
  networkHash: text('network_hash').notNull(),
  outcome: text('outcome').notNull(),
  createdAt: ${timeType}('created_at'${sqlite ? '' : ', { withTimezone: true }'}).notNull()${sqlite ? '' : '.defaultNow()'},
})
`)
  const id = sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY'
  const timestamp = sqlite ? 'TEXT' : 'TIMESTAMPTZ'
  const defaultNow = sqlite ? '' : ' DEFAULT NOW()'
  const role = JSON.stringify(sessionBootstrapRole(access, entities))

  replaceFile(files, 'apps/api/src/auth.ts', (content) => content
    .replace(
      "import { authSessionTable, authUserTable } from './schema'",
      "import { authSessionTable, authUserTable } from './schema'\nimport { cleanupSecurityData, loginGate, recordLoginEvent } from './auth-protection'",
    )
    .replace(
      "    const email = input.email.trim().toLowerCase()\n    const [user] =",
      "    const email = input.email.trim().toLowerCase()\n    const gate = loginGate(email, c.req.header('x-forwarded-for'))\n    if (gate) { c.header('Retry-After', String(gate.retryAfterSeconds)); await recordLoginEvent(email, c.req.header('x-forwarded-for'), 'rate_limited'); return c.json({ error: 'LOGIN_RATE_LIMITED', retryAfterSeconds: gate.retryAfterSeconds }, 429) }\n    const [user] =",
    )
    .replace(
      "      return c.json({ error: 'INVALID_CREDENTIALS' }, 401)\n    }\n    const session = await issueSession(user.id)",
      "      await recordLoginEvent(email, c.req.header('x-forwarded-for'), 'failure')\n      return c.json({ error: 'INVALID_CREDENTIALS' }, 401)\n    }\n    const session = await issueSession(user.id)\n    await recordLoginEvent(email, c.req.header('x-forwarded-for'), 'success')\n    void cleanupSecurityData()",
    )
    .replace(
      "  app.post('/api/auth/revoke-all', async (c) => {",
      `  app.post('/api/auth/maintenance/cleanup', async (c) => {
    const identity = c.get('authIdentity') as RuntimeIdentity | undefined
    if (identity?.role !== ${role}) return c.json({ error: 'FORBIDDEN' }, 403)
    return c.json(await cleanupSecurityData())
  })

  app.post('/api/auth/revoke-all', async (c) => {`,
    ))

  return [
    text('apps/api/src/auth-protection.ts', `import { createHmac, randomBytes } from 'node:crypto'
import { and, eq, isNotNull, lt, or } from 'drizzle-orm'
import { db } from './db'
import { authLoginEventTable, authSessionTable } from './schema'

type Outcome = 'success' | 'failure' | 'rate_limited'
interface AttemptState { failures: number[]; lockedUntil: number }
const attempts = new Map<string, AttemptState>()
let ephemeralKey: Buffer | undefined
let cleanupRunning = false

function integerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function auditKey(): Buffer {
  const raw = process.env.AUTH_AUDIT_HASH_KEY || ''
  if (raw.length >= 32 && !/replace-with|changeme|example/i.test(raw)) return Buffer.from(raw)
  if (!ephemeralKey) { ephemeralKey = randomBytes(32); console.warn('AUTH_AUDIT_HASH_KEY is not configured; audit hashes rotate when this process restarts') }
  return ephemeralKey
}

function digest(scope: string, value: string): string {
  return createHmac('sha256', auditKey()).update(scope + '\\0' + value).digest('hex')
}

function networkValue(forwarded?: string): string {
  const trusted = ['1', 'true', 'yes', 'on'].includes((process.env.AUTH_TRUST_PROXY || '').toLowerCase())
  return trusted ? (forwarded || '').split(',')[0].trim() : ''
}

function keys(email: string, forwarded?: string): string[] {
  const result = [digest('principal', email.trim().toLowerCase())]
  const network = networkValue(forwarded)
  if (network) result.push(digest('network', network))
  return result
}

export function loginGate(email: string, forwarded?: string): { retryAfterSeconds: number } | undefined {
  const now = Date.now()
  const windowMs = integerEnv('AUTH_LOGIN_WINDOW_SECONDS', ${LOGIN_WINDOW_SECONDS}) * 1000
  const lockoutMs = integerEnv('AUTH_LOGIN_LOCKOUT_SECONDS', ${LOGIN_LOCKOUT_SECONDS}) * 1000
  const maximum = integerEnv('AUTH_MAX_LOGIN_ATTEMPTS', ${MAX_LOGIN_ATTEMPTS})
  let retryAfter = 0
  for (const key of keys(email, forwarded)) {
    const state = attempts.get(key) ?? { failures: [], lockedUntil: 0 }
    state.failures = state.failures.filter((timestamp) => timestamp > now - windowMs)
    if (state.lockedUntil > now) retryAfter = Math.max(retryAfter, Math.ceil((state.lockedUntil - now) / 1000))
    else if (state.failures.length >= maximum) { state.lockedUntil = now + lockoutMs; retryAfter = Math.max(retryAfter, Math.ceil(lockoutMs / 1000)) }
    attempts.set(key, state)
  }
  return retryAfter > 0 ? { retryAfterSeconds: retryAfter } : undefined
}

export async function recordLoginEvent(email: string, forwarded: string | undefined, outcome: Outcome): Promise<void> {
  const now = Date.now()
  const itemKeys = keys(email, forwarded)
  if (outcome === 'failure') {
    for (const key of itemKeys) { const state = attempts.get(key) ?? { failures: [], lockedUntil: 0 }; state.failures.push(now); attempts.set(key, state) }
  } else if (outcome === 'success') {
    for (const key of itemKeys) attempts.delete(key)
  }
  const network = networkValue(forwarded)
  await db.insert(authLoginEventTable).values({
    principalHash: digest('principal', email.trim().toLowerCase()),
    networkHash: network ? digest('network', network) : '',
    outcome,
    createdAt: ${sqlite ? 'new Date().toISOString()' : 'new Date()'},
  })
  console.info(JSON.stringify({ event: 'auth.login', outcome, principalHash: digest('principal', email.trim().toLowerCase()), networkHash: network ? digest('network', network) : '', at: new Date().toISOString() }))
}

export async function cleanupSecurityData(): Promise<{ completed: true }> {
  if (cleanupRunning) return { completed: true }
  cleanupRunning = true
  try {
    const now = Date.now()
    const auditCutoff = new Date(now - integerEnv('AUTH_AUDIT_RETENTION_DAYS', ${AUDIT_RETENTION_DAYS}) * 86_400_000)
    const sessionCutoff = new Date(now - integerEnv('AUTH_SESSION_RETENTION_DAYS', ${SESSION_RETENTION_DAYS}) * 86_400_000)
    await db.delete(authLoginEventTable).where(lt(authLoginEventTable.createdAt, ${sqlite ? 'auditCutoff.toISOString()' : 'auditCutoff'}))
    await db.delete(authSessionTable).where(or(
      lt(authSessionTable.expiresAt, ${sqlite ? 'sessionCutoff.toISOString()' : 'sessionCutoff'}),
      and(isNotNull(authSessionTable.revokedAt), lt(authSessionTable.revokedAt, ${sqlite ? 'sessionCutoff.toISOString()' : 'sessionCutoff'})),
    ))
    return { completed: true }
  } finally { cleanupRunning = false }
}
`),
    text('apps/api/drizzle/0003_auth_login_events.sql', `CREATE TABLE auth_login_events (
  id ${id},
  principal_hash TEXT NOT NULL,
  network_hash TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at ${timestamp} NOT NULL${defaultNow}
);
CREATE INDEX auth_login_events_principal_created_idx ON auth_login_events(principal_hash, created_at);
CREATE INDEX auth_login_events_network_created_idx ON auth_login_events(network_hash, created_at);
CREATE INDEX auth_login_events_created_idx ON auth_login_events(created_at);`),
  ]
}


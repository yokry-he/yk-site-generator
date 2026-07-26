import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'
import { AUDIT_RETENTION_DAYS, LOGIN_LOCKOUT_SECONDS, LOGIN_WINDOW_SECONDS, MAX_LOGIN_ATTEMPTS, SESSION_RETENTION_DAYS } from './manualSessionProtectionCommon'

export function nestProtection(files: ArtifactFile[], access: ManualAccessDefinition, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const role = JSON.stringify(sessionBootstrapRole(access, entities))
  replaceFile(files, 'apps/api/prisma/schema.prisma', (content) => `${content.trimEnd()}

model AuthLoginEvent {
  id            Int      @id @default(autoincrement())
  principalHash String
  networkHash   String
  outcome       String
  createdAt     DateTime @default(now())

  @@index([principalHash, createdAt])
  @@index([networkHash, createdAt])
  @@index([createdAt])
  @@map("auth_login_events")
}
`)
  replaceFile(files, 'apps/api/src/app.module.ts', (content) => content
    .replace("import { AuthService } from './auth.service'", "import { AuthService } from './auth.service'\nimport { AuthProtectionService } from './auth-protection.service'")
    .replace('providers: [PrismaService, AuthService,', 'providers: [PrismaService, AuthProtectionService, AuthService,'))
  replaceFile(files, 'apps/api/src/auth.service.ts', (content) => content
    .replace("import { PrismaService } from './prisma.service'", "import { PrismaService } from './prisma.service'\nimport { AuthProtectionService } from './auth-protection.service'")
    .replace('constructor(private readonly prisma: PrismaService) {}', 'constructor(private readonly prisma: PrismaService, private readonly protection: AuthProtectionService) {}')
    .replace('async login(emailInput: string, password: string) {', 'async login(emailInput: string, password: string, network = "") {')
    .replace(
      "    const user = await this.prisma.authUser.findUnique({ where: { email: emailInput.trim().toLowerCase() } })",
      "    const email = emailInput.trim().toLowerCase()\n    this.protection.assertAllowed(email, network)\n    const user = await this.prisma.authUser.findUnique({ where: { email } })",
    )
    .replace(
      '    if (!user || user.disabled || !rules[user.role] || !verifyPassword(password, user.passwordHash)) return undefined',
      "    if (!user || user.disabled || !rules[user.role] || !verifyPassword(password, user.passwordHash)) { await this.protection.record(email, network, 'failure'); return undefined }",
    )
    .replace(
      '    const session = await this.issueSession(user.id)',
      "    const session = await this.issueSession(user.id)\n    await this.protection.record(email, network, 'success')\n    void this.protection.cleanup()",
    ))
  replaceFile(files, 'apps/api/src/auth.controller.ts', (content) => content
    .replace('ConflictException,', 'ConflictException,\n  ForbiddenException,\n  HttpException,\n  HttpStatus,')
    .replace('interface AuthRequest { authIdentity?: RuntimeIdentity }', "interface AuthRequest { authIdentity?: RuntimeIdentity; headers?: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }")
    .replace(
      '  async login(@Body() body: LoginInput) {\n    const result = await this.auth.login(body.email, body.password)',
      `  async login(@Body() body: LoginInput, @Req() request: AuthRequest) {
    const trusted = ['1', 'true', 'yes', 'on'].includes((process.env.AUTH_TRUST_PROXY || '').toLowerCase())
    const forwarded = request.headers?.['x-forwarded-for']
    const network = trusted ? (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim() : request.socket?.remoteAddress || ''
    let result
    try { result = await this.auth.login(body.email, body.password, network) }
    catch (error) {
      if (error instanceof LoginRateLimitedError) throw new HttpException({ error: 'LOGIN_RATE_LIMITED', retryAfterSeconds: error.retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS)
      throw error
    }`,
    )
    .replace("import { AuthService, authEnabled, type RuntimeIdentity } from './auth.service'", "import { AuthService, authEnabled, type RuntimeIdentity } from './auth.service'\nimport { LoginRateLimitedError } from './auth-protection.service'")
    .replace(
      "  @Post('revoke-all')",
      `  @Post('maintenance/cleanup')
  async cleanup(@Req() request: AuthRequest) {
    if (request.authIdentity?.role !== ${role}) throw new ForbiddenException({ error: 'FORBIDDEN' })
    return this.auth.cleanupSecurityData()
  }

  @Post('revoke-all')`,
    ))
  replaceFile(files, 'apps/api/src/auth.service.ts', (content) => content.replace(
    '  async revokeAll(userId: number): Promise<void> {',
    '  async cleanupSecurityData() { return this.protection.cleanup() }\n\n  async revokeAll(userId: number): Promise<void> {',
  ))
  return [text('apps/api/src/auth-protection.service.ts', `import { createHmac, randomBytes } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'

type Outcome = 'success' | 'failure' | 'rate_limited'
interface AttemptState { failures: number[]; lockedUntil: number }
export class LoginRateLimitedError extends Error { constructor(public readonly retryAfterSeconds: number) { super('LOGIN_RATE_LIMITED') } }

@Injectable()
export class AuthProtectionService {
  private readonly attempts = new Map<string, AttemptState>()
  private ephemeralKey?: Buffer
  private cleanupRunning = false
  constructor(private readonly prisma: PrismaService) {}

  private integer(name: string, fallback: number): number { const value = Number(process.env[name]); return Number.isInteger(value) && value > 0 ? value : fallback }
  private key(): Buffer {
    const raw = process.env.AUTH_AUDIT_HASH_KEY || ''
    if (raw.length >= 32 && !/replace-with|changeme|example/i.test(raw)) return Buffer.from(raw)
    if (!this.ephemeralKey) { this.ephemeralKey = randomBytes(32); console.warn('AUTH_AUDIT_HASH_KEY is not configured; audit hashes rotate when this process restarts') }
    return this.ephemeralKey
  }
  private digest(scope: string, value: string): string { return createHmac('sha256', this.key()).update(scope + '\\0' + value).digest('hex') }
  private keys(email: string, network: string): string[] { const values = [this.digest('principal', email)]; if (network) values.push(this.digest('network', network)); return values }

  assertAllowed(email: string, network: string): void {
    const now = Date.now(), windowMs = this.integer('AUTH_LOGIN_WINDOW_SECONDS', ${LOGIN_WINDOW_SECONDS}) * 1000, lockoutMs = this.integer('AUTH_LOGIN_LOCKOUT_SECONDS', ${LOGIN_LOCKOUT_SECONDS}) * 1000, maximum = this.integer('AUTH_MAX_LOGIN_ATTEMPTS', ${MAX_LOGIN_ATTEMPTS})
    let retryAfter = 0
    for (const key of this.keys(email, network)) { const state = this.attempts.get(key) ?? { failures: [], lockedUntil: 0 }; state.failures = state.failures.filter((item) => item > now - windowMs); if (state.lockedUntil > now) retryAfter = Math.max(retryAfter, Math.ceil((state.lockedUntil - now) / 1000)); else if (state.failures.length >= maximum) { state.lockedUntil = now + lockoutMs; retryAfter = Math.max(retryAfter, Math.ceil(lockoutMs / 1000)) }; this.attempts.set(key, state) }
    if (retryAfter > 0) { void this.record(email, network, 'rate_limited'); throw new LoginRateLimitedError(retryAfter) }
  }

  async record(email: string, network: string, outcome: Outcome): Promise<void> {
    const now = Date.now(), itemKeys = this.keys(email, network)
    if (outcome === 'failure') for (const key of itemKeys) { const state = this.attempts.get(key) ?? { failures: [], lockedUntil: 0 }; state.failures.push(now); this.attempts.set(key, state) }
    else if (outcome === 'success') for (const key of itemKeys) this.attempts.delete(key)
    const principalHash = this.digest('principal', email), networkHash = network ? this.digest('network', network) : ''
    await this.prisma.authLoginEvent.create({ data: { principalHash, networkHash, outcome } })
    console.info(JSON.stringify({ event: 'auth.login', outcome, principalHash, networkHash, at: new Date().toISOString() }))
  }

  async cleanup() {
    if (this.cleanupRunning) return { completed: true }
    this.cleanupRunning = true
    try {
      const auditCutoff = new Date(Date.now() - this.integer('AUTH_AUDIT_RETENTION_DAYS', ${AUDIT_RETENTION_DAYS}) * 86_400_000)
      const sessionCutoff = new Date(Date.now() - this.integer('AUTH_SESSION_RETENTION_DAYS', ${SESSION_RETENTION_DAYS}) * 86_400_000)
      const [events, sessions] = await this.prisma.$transaction([
        this.prisma.authLoginEvent.deleteMany({ where: { createdAt: { lt: auditCutoff } } }),
        this.prisma.authSession.deleteMany({ where: { OR: [{ expiresAt: { lt: sessionCutoff } }, { revokedAt: { not: null, lt: sessionCutoff } }] } }),
      ])
      return { completed: true, loginEventsDeleted: events.count, sessionsDeleted: sessions.count }
    } finally { this.cleanupRunning = false }
  }
}
`)]
}

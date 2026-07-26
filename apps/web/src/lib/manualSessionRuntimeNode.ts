import type {
  ArtifactFile,
  BackendDatabaseId,
  ManualAccessDefinition,
  ManualEntityDefinition,
} from 'shared'
import { replaceFile, runtimeRules, runtimeTargets } from './manualAuthCommon'
import { text } from './manualCrudHelpers'
import { sessionBootstrapRole } from './manualSessionRuntimeCommon'

export function honoSessionRuntime(
  files: ArtifactFile[],
  database: BackendDatabaseId,
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  const rules = JSON.stringify(runtimeRules(access))
  const targets = JSON.stringify(runtimeTargets(entities))
  const role = JSON.stringify(sessionBootstrapRole(access, entities))
  const nowValue = sqlite ? 'now.toISOString()' : 'now'
  const expiresValue = sqlite ? 'expiresAt.toISOString()' : 'expiresAt'
  const revokedValue = sqlite ? 'new Date().toISOString()' : 'new Date()'
  const createdFields = sqlite ? ', createdAt: now.toISOString(), updatedAt: now.toISOString()' : ''

  replaceFile(files, 'apps/api/src/index.ts', (content) => content
    .replace(
      "import { authMiddleware, authStatus } from './auth'",
      "import { authMiddleware, registerSessionAuthRoutes } from './auth'",
    )
    .replace(
      "app.get('/api/auth/me', (c) => c.json(authStatus(c.req.header('authorization'))))",
      'registerSessionAuthRoutes(app)',
    ))

  replaceFile(files, 'apps/api/src/auth.ts', () => `import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, asc, count, eq, gt, inArray, isNull } from 'drizzle-orm'
import { Hono, type MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { db } from './db'
import { authSessionTable, authUserTable } from './schema'

type Action = 'list' | 'read' | 'create' | 'update' | 'delete'
type AuthSource = 'static' | 'session'
interface ConfiguredIdentity { token: string; userId: string; email: string; role: string }
interface PublicIdentity { userId: string; email: string; role: string }
interface RuntimeIdentity extends PublicIdentity {
  source: AuthSource
  sessionId?: number
  expiresAt?: string
}

const rules = ${rules} as Record<string, Record<string, Action[]>>
const targets = ${targets} as Array<{ entity: string; route: string }>
const bootstrapRole = ${role}
const sessionTtlSeconds = ${access.session!.ttlSeconds}
const maxActiveSessions = ${access.session!.maxActiveSessions}
const publicPaths = new Set(['/api/health', '/api/auth/bootstrap', '/api/auth/login'])
const loginInput = z.object({ email: z.string().email(), password: z.string().min(12).max(1024) })
let cachedRaw = ''
let cachedIdentities: ConfiguredIdentity[] = []

export function authEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes((process.env.AUTH_ENABLED || '').toLowerCase())
}

function staticIdentities(): ConfiguredIdentity[] {
  const raw = process.env.AUTH_IDENTITIES_JSON || ''
  if (raw === cachedRaw) return cachedIdentities
  cachedRaw = raw
  try {
    const value = JSON.parse(raw)
    cachedIdentities = Array.isArray(value)
      ? value.filter((item): item is ConfiguredIdentity => Boolean(
        item && typeof item.token === 'string' && item.token.length >= 16 &&
        typeof item.userId === 'string' && typeof item.email === 'string' && typeof item.role === 'string' && Boolean(rules[item.role]),
      ))
      : []
  } catch {
    cachedIdentities = []
  }
  return cachedIdentities
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function digestHex(value: string): string {
  return digest(value).toString('hex')
}

function bearer(header?: string): string {
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function authenticateStatic(token: string): RuntimeIdentity | undefined {
  const candidate = digest(token)
  const identity = staticIdentities().find((item) => timingSafeEqual(digest(item.token), candidate))
  return identity ? { userId: identity.userId, email: identity.email, role: identity.role, source: 'static' } : undefined
}

async function authenticateSession(token: string): Promise<RuntimeIdentity | undefined> {
  const now = new Date()
  const [record] = await db.select({
    sessionId: authSessionTable.id,
    expiresAt: authSessionTable.expiresAt,
    userId: authUserTable.id,
    email: authUserTable.email,
    role: authUserTable.role,
    disabled: authUserTable.disabled,
  }).from(authSessionTable)
    .innerJoin(authUserTable, eq(authSessionTable.userId, authUserTable.id))
    .where(and(
      eq(authSessionTable.tokenHash, digestHex(token)),
      isNull(authSessionTable.revokedAt),
      gt(authSessionTable.expiresAt, ${nowValue}),
    ))
    .limit(1)
  if (!record || record.disabled || !rules[record.role]) return undefined
  await db.update(authSessionTable).set({ lastUsedAt: ${nowValue} }).where(eq(authSessionTable.id, record.sessionId))
  return {
    userId: String(record.userId),
    email: record.email,
    role: record.role,
    source: 'session',
    sessionId: record.sessionId,
    expiresAt: record.expiresAt instanceof Date ? record.expiresAt.toISOString() : String(record.expiresAt),
  }
}

async function authenticate(header?: string): Promise<RuntimeIdentity | undefined> {
  const token = bearer(header)
  if (!token) return undefined
  return authenticateStatic(token) ?? await authenticateSession(token)
}

async function hasConfiguredIdentity(): Promise<boolean> {
  if (staticIdentities().length) return true
  const [row] = await db.select({ total: count() }).from(authUserTable)
  return Number(row?.total || 0) > 0
}

function passwordHash(password: string): string {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 600_000, 32, 'sha256')
  return ['pbkdf2_sha256', '600000', salt.toString('hex'), hash.toString('hex')].join('$')
}

function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, iterationsText, saltHex, hashHex] = stored.split('$')
  const iterations = Number(iterationsText)
  if (algorithm !== 'pbkdf2_sha256' || !Number.isInteger(iterations) || iterations < 1 || !saltHex || !hashHex) return false
  try {
    const expected = Buffer.from(hashHex, 'hex')
    const actual = pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, expected.length, 'sha256')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

function publicIdentity(identity: RuntimeIdentity): PublicIdentity {
  return { userId: identity.userId, email: identity.email, role: identity.role }
}

function resolveAction(method: string, path: string): { entity: string; action: Action } | undefined {
  const target = targets.find((item) => path === item.route || path.startsWith(item.route + '/'))
  if (!target) return undefined
  const detail = path !== target.route
  if (method === 'GET') return { entity: target.entity, action: detail ? 'read' : 'list' }
  if (method === 'POST' && !detail) return { entity: target.entity, action: 'create' }
  if ((method === 'PATCH' || method === 'PUT') && detail) return { entity: target.entity, action: 'update' }
  if (method === 'DELETE' && detail) return { entity: target.entity, action: 'delete' }
  return undefined
}

async function issueSession(userId: number, currentSessionId?: number) {
  return db.transaction(async (tx) => {
    const now = new Date()
    if (currentSessionId !== undefined) {
      await tx.update(authSessionTable).set({ revokedAt: ${revokedValue} }).where(eq(authSessionTable.id, currentSessionId))
    }
    const active = await tx.select({ id: authSessionTable.id }).from(authSessionTable)
      .where(and(eq(authSessionTable.userId, userId), isNull(authSessionTable.revokedAt), gt(authSessionTable.expiresAt, ${nowValue})))
      .orderBy(asc(authSessionTable.createdAt))
    const revokeCount = Math.max(0, active.length - maxActiveSessions + 1)
    if (revokeCount > 0) {
      await tx.update(authSessionTable).set({ revokedAt: ${revokedValue} }).where(inArray(authSessionTable.id, active.slice(0, revokeCount).map((item) => item.id)))
    }
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000)
    await tx.insert(authSessionTable).values({
      tokenHash: digestHex(token),
      userId,
      expiresAt: ${expiresValue},
      revokedAt: null,
      lastUsedAt: ${nowValue},
      createdAt: ${nowValue},
    })
    return { token, expiresAt: expiresAt.toISOString() }
  })
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS' || publicPaths.has(c.req.path)) return next()
  const identity = await authenticate(c.req.header('authorization'))
  if (!authEnabled()) {
    if (identity) c.set('authIdentity', identity)
    return next()
  }
  if (!identity) {
    if (!await hasConfiguredIdentity()) return c.json({ error: 'AUTH_NOT_CONFIGURED' }, 503)
    return c.json({ error: 'UNAUTHORIZED' }, 401)
  }
  c.set('authIdentity', identity)
  const resolved = resolveAction(c.req.method, c.req.path)
  const allowed = resolved ? rules[identity.role]?.[resolved.entity]?.includes(resolved.action) : true
  if (!allowed) return c.json({ error: 'FORBIDDEN' }, 403)
  return next()
}

export function registerSessionAuthRoutes(app: Hono) {
  app.post('/api/auth/bootstrap', async (c) => {
    const email = (process.env.AUTH_BOOTSTRAP_EMAIL || '').trim().toLowerCase()
    const password = process.env.AUTH_BOOTSTRAP_PASSWORD || ''
    if (!email.includes('@') || password.length < 12 || /replace-with|changeme|example/i.test(password)) {
      return c.json({ error: 'BOOTSTRAP_NOT_CONFIGURED' }, 503)
    }
    const [row] = await db.select({ total: count() }).from(authUserTable)
    if (Number(row?.total || 0) > 0) return c.json({ error: 'BOOTSTRAP_ALREADY_COMPLETED' }, 409)
    const now = new Date()
    const [user] = await db.insert(authUserTable).values({
      email,
      passwordHash: passwordHash(password),
      role: bootstrapRole,
      disabled: false${createdFields},
    }).returning({ id: authUserTable.id, email: authUserTable.email, role: authUserTable.role })
    return c.json({ created: true, identity: { userId: String(user.id), email: user.email, role: user.role } }, 201)
  })

  app.post('/api/auth/login', async (c) => {
    const input = loginInput.parse(await c.req.json())
    const email = input.email.trim().toLowerCase()
    const [user] = await db.select().from(authUserTable).where(eq(authUserTable.email, email)).limit(1)
    if (!user || user.disabled || !rules[user.role] || !verifyPassword(input.password, user.passwordHash)) {
      return c.json({ error: 'INVALID_CREDENTIALS' }, 401)
    }
    const session = await issueSession(user.id)
    return c.json({ ...session, identity: { userId: String(user.id), email: user.email, role: user.role } })
  })

  app.get('/api/auth/me', async (c) => {
    const identity = c.get('authIdentity') as RuntimeIdentity | undefined
    return c.json({
      enabled: authEnabled(),
      identity: identity ? publicIdentity(identity) : null,
      source: identity?.source ?? null,
      expiresAt: identity?.expiresAt ?? null,
    })
  })

  app.post('/api/auth/logout', async (c) => {
    const identity = c.get('authIdentity') as RuntimeIdentity | undefined
    if (!identity?.sessionId) return c.json({ error: 'SESSION_REQUIRED' }, 409)
    await db.update(authSessionTable).set({ revokedAt: ${revokedValue} }).where(eq(authSessionTable.id, identity.sessionId))
    return c.body(null, 204)
  })

  app.post('/api/auth/rotate', async (c) => {
    const identity = c.get('authIdentity') as RuntimeIdentity | undefined
    if (!identity?.sessionId) return c.json({ error: 'SESSION_REQUIRED' }, 409)
    const session = await issueSession(Number(identity.userId), identity.sessionId)
    return c.json({ ...session, identity: publicIdentity(identity) })
  })

  app.post('/api/auth/revoke-all', async (c) => {
    const identity = c.get('authIdentity') as RuntimeIdentity | undefined
    if (!identity?.sessionId) return c.json({ error: 'SESSION_REQUIRED' }, 409)
    await db.update(authSessionTable).set({ revokedAt: ${revokedValue} }).where(and(eq(authSessionTable.userId, Number(identity.userId)), isNull(authSessionTable.revokedAt)))
    return c.body(null, 204)
  })
}
`)
  return []
}

export function nestSessionRuntime(
  files: ArtifactFile[],
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access))
  const targets = JSON.stringify(runtimeTargets(entities))
  const role = JSON.stringify(sessionBootstrapRole(access, entities))

  replaceFile(files, 'apps/api/src/app.module.ts', (content) => content
    .replace(
      "import { AuthController } from './auth.controller'",
      "import { AuthController } from './auth.controller'\nimport { AuthService } from './auth.service'",
    )
    .replace(
      'providers: [PrismaService, { provide: APP_GUARD, useClass: AuthGuard }]',
      'providers: [PrismaService, AuthService, { provide: APP_GUARD, useClass: AuthGuard }]',
    ))

  replaceFile(files, 'apps/api/src/auth.guard.ts', () => `import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService, authEnabled, type RuntimeIdentity } from './auth.service'

type Action = 'list' | 'read' | 'create' | 'update' | 'delete'
const rules = ${rules} as Record<string, Record<string, Action[]>>
const targets = ${targets} as Array<{ entity: string; route: string }>
const publicPaths = new Set(['/api/health', '/api/auth/bootstrap', '/api/auth/login'])

function resolveAction(method: string, path: string): { entity: string; action: Action } | undefined {
  const target = targets.find((item) => path === item.route || path.startsWith(item.route + '/'))
  if (!target) return undefined
  const detail = path !== target.route
  if (method === 'GET') return { entity: target.entity, action: detail ? 'read' : 'list' }
  if (method === 'POST' && !detail) return { entity: target.entity, action: 'create' }
  if ((method === 'PATCH' || method === 'PUT') && detail) return { entity: target.entity, action: 'update' }
  if (method === 'DELETE' && detail) return { entity: target.entity, action: 'delete' }
  return undefined
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      path: string
      method: string
      headers: Record<string, string | undefined>
      authIdentity?: RuntimeIdentity
    }>()
    if (request.method === 'OPTIONS' || publicPaths.has(request.path)) return true
    const identity = await this.auth.authenticate(request.headers.authorization)
    if (!authEnabled()) {
      request.authIdentity = identity
      return true
    }
    if (!identity) {
      if (!await this.auth.hasConfiguredIdentity()) throw new ServiceUnavailableException({ error: 'AUTH_NOT_CONFIGURED' })
      throw new UnauthorizedException({ error: 'UNAUTHORIZED' })
    }
    request.authIdentity = identity
    const resolved = resolveAction(request.method, request.path)
    const allowed = resolved ? rules[identity.role]?.[resolved.entity]?.includes(resolved.action) : true
    if (!allowed) throw new ForbiddenException({ error: 'FORBIDDEN' })
    return true
  }
}
`)

  replaceFile(files, 'apps/api/src/auth.controller.ts', () => `import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { AuthService, authEnabled, type RuntimeIdentity } from './auth.service'

interface LoginInput { email: string; password: string }
interface AuthRequest { authIdentity?: RuntimeIdentity }

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('bootstrap')
  async bootstrap() {
    const result = await this.auth.bootstrap()
    if (result.error === 'BOOTSTRAP_NOT_CONFIGURED') throw new ServiceUnavailableException({ error: result.error })
    if (result.error === 'BOOTSTRAP_ALREADY_COMPLETED') throw new ConflictException({ error: result.error })
    return result.value
  }

  @Post('login')
  async login(@Body() body: LoginInput) {
    const result = await this.auth.login(body.email, body.password)
    if (!result) throw new UnauthorizedException({ error: 'INVALID_CREDENTIALS' })
    return result
  }

  @Get('me')
  me(@Req() request: AuthRequest) {
    const identity = request.authIdentity
    return {
      enabled: authEnabled(),
      identity: identity ? { userId: identity.userId, email: identity.email, role: identity.role } : null,
      source: identity?.source ?? null,
      expiresAt: identity?.expiresAt ?? null,
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: AuthRequest) {
    if (!request.authIdentity?.sessionId) throw new ConflictException({ error: 'SESSION_REQUIRED' })
    await this.auth.logout(request.authIdentity.sessionId)
  }

  @Post('rotate')
  async rotate(@Req() request: AuthRequest) {
    const identity = request.authIdentity
    if (!identity?.sessionId) throw new ConflictException({ error: 'SESSION_REQUIRED' })
    return this.auth.rotate(identity)
  }

  @Post('revoke-all')
  @HttpCode(204)
  async revokeAll(@Req() request: AuthRequest) {
    const identity = request.authIdentity
    if (!identity?.sessionId) throw new ConflictException({ error: 'SESSION_REQUIRED' })
    await this.auth.revokeAll(Number(identity.userId))
  }
}
`)

  return [text('apps/api/src/auth.service.ts', `import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'

export type AuthSource = 'static' | 'session'
export interface RuntimeIdentity {
  userId: string
  email: string
  role: string
  source: AuthSource
  sessionId?: number
  expiresAt?: string
}
interface ConfiguredIdentity { token: string; userId: string; email: string; role: string }
const rules = ${rules} as Record<string, Record<string, string[]>>
const bootstrapRole = ${role}
const sessionTtlSeconds = ${access.session!.ttlSeconds}
const maxActiveSessions = ${access.session!.maxActiveSessions}
let cachedRaw = ''
let cachedIdentities: ConfiguredIdentity[] = []

export function authEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes((process.env.AUTH_ENABLED || '').toLowerCase())
}

function staticIdentities(): ConfiguredIdentity[] {
  const raw = process.env.AUTH_IDENTITIES_JSON || ''
  if (raw === cachedRaw) return cachedIdentities
  cachedRaw = raw
  try {
    const value = JSON.parse(raw)
    cachedIdentities = Array.isArray(value)
      ? value.filter((item): item is ConfiguredIdentity => Boolean(
        item && typeof item.token === 'string' && item.token.length >= 16 &&
        typeof item.userId === 'string' && typeof item.email === 'string' && typeof item.role === 'string' && Boolean(rules[item.role]),
      ))
      : []
  } catch { cachedIdentities = [] }
  return cachedIdentities
}

function digest(value: string): Buffer { return createHash('sha256').update(value).digest() }
function digestHex(value: string): string { return digest(value).toString('hex') }
function passwordHash(password: string): string {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, 600_000, 32, 'sha256')
  return ['pbkdf2_sha256', '600000', salt.toString('hex'), hash.toString('hex')].join('$')
}
function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, iterationsText, saltHex, hashHex] = stored.split('$')
  const iterations = Number(iterationsText)
  if (algorithm !== 'pbkdf2_sha256' || !Number.isInteger(iterations) || iterations < 1 || !saltHex || !hashHex) return false
  try {
    const expected = Buffer.from(hashHex, 'hex')
    const actual = pbkdf2Sync(password, Buffer.from(saltHex, 'hex'), iterations, expected.length, 'sha256')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch { return false }
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async hasConfiguredIdentity(): Promise<boolean> {
    return staticIdentities().length > 0 || await this.prisma.authUser.count() > 0
  }

  async authenticate(header?: string): Promise<RuntimeIdentity | undefined> {
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) return undefined
    const candidate = digest(token)
    const staticIdentity = staticIdentities().find((item) => timingSafeEqual(digest(item.token), candidate))
    if (staticIdentity) return { userId: staticIdentity.userId, email: staticIdentity.email, role: staticIdentity.role, source: 'static' }
    const session = await this.prisma.authSession.findUnique({ where: { tokenHash: digestHex(token) }, include: { user: true } })
    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.disabled || !rules[session.user.role]) return undefined
    await this.prisma.authSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
    return { userId: String(session.user.id), email: session.user.email, role: session.user.role, source: 'session', sessionId: session.id, expiresAt: session.expiresAt.toISOString() }
  }

  async bootstrap(): Promise<{ error?: 'BOOTSTRAP_NOT_CONFIGURED' | 'BOOTSTRAP_ALREADY_COMPLETED'; value?: unknown }> {
    const email = (process.env.AUTH_BOOTSTRAP_EMAIL || '').trim().toLowerCase()
    const password = process.env.AUTH_BOOTSTRAP_PASSWORD || ''
    if (!email.includes('@') || password.length < 12 || /replace-with|changeme|example/i.test(password)) return { error: 'BOOTSTRAP_NOT_CONFIGURED' }
    if (await this.prisma.authUser.count() > 0) return { error: 'BOOTSTRAP_ALREADY_COMPLETED' }
    const user = await this.prisma.authUser.create({ data: { email, passwordHash: passwordHash(password), role: bootstrapRole } })
    return { value: { created: true, identity: { userId: String(user.id), email: user.email, role: user.role } } }
  }

  async login(emailInput: string, password: string) {
    if (typeof emailInput !== 'string' || typeof password !== 'string' || password.length < 12) return undefined
    const user = await this.prisma.authUser.findUnique({ where: { email: emailInput.trim().toLowerCase() } })
    if (!user || user.disabled || !rules[user.role] || !verifyPassword(password, user.passwordHash)) return undefined
    const session = await this.issueSession(user.id)
    return { ...session, identity: { userId: String(user.id), email: user.email, role: user.role } }
  }

  async logout(sessionId: number): Promise<void> {
    await this.prisma.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } })
  }

  async rotate(identity: RuntimeIdentity) {
    const session = await this.issueSession(Number(identity.userId), identity.sessionId)
    return { ...session, identity: { userId: identity.userId, email: identity.email, role: identity.role } }
  }

  async revokeAll(userId: number): Promise<void> {
    await this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  }

  private async issueSession(userId: number, currentSessionId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date()
      if (currentSessionId !== undefined) await tx.authSession.updateMany({ where: { id: currentSessionId, revokedAt: null }, data: { revokedAt: now } })
      const active = await tx.authSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: now } }, orderBy: { createdAt: 'asc' }, select: { id: true } })
      const revokeCount = Math.max(0, active.length - maxActiveSessions + 1)
      if (revokeCount > 0) await tx.authSession.updateMany({ where: { id: { in: active.slice(0, revokeCount).map((item) => item.id) } }, data: { revokedAt: now } })
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000)
      await tx.authSession.create({ data: { tokenHash: digestHex(token), userId, expiresAt, lastUsedAt: now } })
      return { token, expiresAt: expiresAt.toISOString() }
    })
  }
}
`)]
}

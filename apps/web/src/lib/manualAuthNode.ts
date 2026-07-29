import type { ArtifactFile, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { text } from './manualCrudHelpers'
import { replaceFile, runtimeRules, runtimeTargets } from './manualAuthCommon'

export function honoAuth(
  files: ArtifactFile[],
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access))
  const targets = JSON.stringify(runtimeTargets(entities))
  replaceFile(files, 'apps/api/src/index.ts', (content) => content
    .replace(
      "import { z } from 'zod'",
      "import { z } from 'zod'\nimport { authMiddleware, authStatus } from './auth'",
    )
    .replace(
      "app.use('*', cors())",
      "app.use('*', cors({ origin: 'http://localhost:5173', allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] }))\napp.use('/api/*', authMiddleware)",
    )
    .replace(
      "app.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Hono + Drizzle', database:",
      "app.get('/api/auth/me', (c) => c.json(authStatus(c.req.header('authorization'))))\napp.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Hono + Drizzle', database:",
    ))

  return [text('apps/api/src/auth.ts', `import { createHash, timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'

type Action = 'list' | 'read' | 'create' | 'update' | 'delete'
interface ConfiguredIdentity { token: string; userId: string; email: string; role: string }
interface PublicIdentity { userId: string; email: string; role: string }

const rules = ${rules} as Record<string, Record<string, Action[]>>
const targets = ${targets} as Array<{ entity: string; route: string }>
let cachedRaw = ''
let cachedIdentities: ConfiguredIdentity[] = []

export function authEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes((process.env.AUTH_ENABLED || '').toLowerCase())
}

function identities(): ConfiguredIdentity[] {
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

function sameToken(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest()
  const rightDigest = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

function bearer(header?: string): string {
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function authenticate(header?: string): ConfiguredIdentity | undefined {
  const token = bearer(header)
  return token ? identities().find((identity) => sameToken(identity.token, token)) : undefined
}

function publicIdentity(identity: ConfiguredIdentity): PublicIdentity {
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

export function authStatus(header?: string): { enabled: boolean; identity: PublicIdentity | null } {
  if (!authEnabled()) return { enabled: false, identity: null }
  const identity = authenticate(header)
  return { enabled: true, identity: identity ? publicIdentity(identity) : null }
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (c.req.method === 'OPTIONS' || c.req.path === '/api/health' || !authEnabled()) return next()
  const configured = identities()
  if (!configured.length) return c.json({ error: 'AUTH_NOT_CONFIGURED' }, 503)
  const identity = authenticate(c.req.header('authorization'))
  if (!identity) return c.json({ error: 'UNAUTHORIZED' }, 401)
  if (c.req.path !== '/api/auth/me') {
    const resolved = resolveAction(c.req.method, c.req.path)
    const allowed = resolved ? rules[identity.role]?.[resolved.entity]?.includes(resolved.action) : true
    if (!allowed) return c.json({ error: 'FORBIDDEN' }, 403)
  }
  return next()
}
`)]
}

export function nestAuth(
  files: ArtifactFile[],
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const rules = JSON.stringify(runtimeRules(access))
  const targets = JSON.stringify(runtimeTargets(entities))
  replaceFile(files, 'apps/api/src/app.module.ts', (content) => content
    .replace(
      "import { Module } from '@nestjs/common'",
      "import { Module } from '@nestjs/common'\nimport { APP_GUARD } from '@nestjs/core'\nimport { AuthController } from './auth.controller'\nimport { AuthGuard } from './auth.guard'",
    )
    .replace('controllers: [HealthController, ', 'controllers: [HealthController, AuthController, ')
    .replace('providers: [PrismaService]', 'providers: [PrismaService, { provide: APP_GUARD, useClass: AuthGuard }]'))

  return [
    text('apps/api/src/auth.guard.ts', `import { createHash, timingSafeEqual } from 'node:crypto'
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'

type Action = 'list' | 'read' | 'create' | 'update' | 'delete'
export interface AuthIdentity { userId: string; email: string; role: string }
interface ConfiguredIdentity extends AuthIdentity { token: string }

const rules = ${rules} as Record<string, Record<string, Action[]>>
const targets = ${targets} as Array<{ entity: string; route: string }>
let cachedRaw = ''
let cachedIdentities: ConfiguredIdentity[] = []

export function authEnabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes((process.env.AUTH_ENABLED || '').toLowerCase())
}

function identities(): ConfiguredIdentity[] {
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

function sameToken(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest()
  const rightDigest = createHash('sha256').update(right).digest()
  return timingSafeEqual(leftDigest, rightDigest)
}

function authenticate(header?: string): ConfiguredIdentity | undefined {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return token ? identities().find((identity) => sameToken(identity.token, token)) : undefined
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

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      path: string
      method: string
      headers: Record<string, string | undefined>
      authIdentity?: AuthIdentity
    }>()
    if (request.method === 'OPTIONS' || request.path === '/api/health' || !authEnabled()) return true
    const configured = identities()
    if (!configured.length) throw new ServiceUnavailableException({ error: 'AUTH_NOT_CONFIGURED' })
    const identity = authenticate(request.headers.authorization)
    if (!identity) throw new UnauthorizedException({ error: 'UNAUTHORIZED' })
    request.authIdentity = { userId: identity.userId, email: identity.email, role: identity.role }
    if (request.path === '/api/auth/me') return true
    const resolved = resolveAction(request.method, request.path)
    const allowed = resolved ? rules[identity.role]?.[resolved.entity]?.includes(resolved.action) : true
    if (!allowed) throw new ForbiddenException({ error: 'FORBIDDEN' })
    return true
  }
}
`),
    text('apps/api/src/auth.controller.ts', `import { Controller, Get, Req } from '@nestjs/common'
import { authEnabled, type AuthIdentity } from './auth.guard'

@Controller('api/auth')
export class AuthController {
  @Get('me')
  me(@Req() request: { authIdentity?: AuthIdentity }) {
    return { enabled: authEnabled(), identity: request.authIdentity ?? null }
  }
}
`),
  ]
}

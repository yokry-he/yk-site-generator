import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { MiddlewareHandler } from 'hono'
import { env } from '../env'
import { readData } from './data-store'

export interface AccessClaims {
  sub: string
  sid: string
  email: string
  iat: number
  exp: number
}

export interface AuthVariables {
  auth: AccessClaims
}

export type AuthEnv = { Variables: AuthVariables }

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function signature(input: string): string {
  return createHmac('sha256', env.AUTH_JWT_SECRET).update(input).digest('base64url')
}

export function hashToken(value: string): string {
  return createHmac('sha256', env.AUTH_JWT_SECRET).update(value).digest('hex')
}

export function safeHashEquals(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(value), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function createAccessToken(input: {
  userId: string
  sessionId: string
  email: string
  now?: number
}): { token: string; expiresAt: string } {
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000)
  const exp = nowSeconds + env.ACCESS_TOKEN_TTL_MIN * 60
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' })
  const payload = encodeJson({
    sub: input.userId,
    sid: input.sessionId,
    email: input.email,
    iat: nowSeconds,
    exp,
  } satisfies AccessClaims)
  const unsigned = `${header}.${payload}`
  return {
    token: `${unsigned}.${signature(unsigned)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  }
}

export function verifyAccessToken(token: string, now = Date.now()): AccessClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, suppliedSignature] = parts
  const expected = Buffer.from(signature(`${header}.${payload}`))
  const supplied = Buffer.from(suppliedSignature)
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AccessClaims>
    if (
      typeof parsed.sub !== 'string' ||
      typeof parsed.sid !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.iat !== 'number' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Math.floor(now / 1000)
    ) {
      return null
    }
    return parsed as AccessClaims
  } catch {
    return null
  }
}

/** JWT 校验后继续确认服务端会话没有撤销或过期。 */
export async function authenticateBearerHeader(authorization?: string): Promise<AccessClaims | null> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const claims = token ? verifyAccessToken(token) : null
  if (!claims) return null
  const data = await readData()
  const session = data.sessions.find(
    (item) =>
      item.id === claims.sid &&
      item.userId === claims.sub &&
      !item.revokedAt &&
      Date.parse(item.expiresAt) > Date.now(),
  )
  return session ? claims : null
}

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const claims = await authenticateBearerHeader(c.req.header('authorization'))
  if (!claims) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '登录状态无效或已过期' } }, 401)
  }
  c.set('auth', claims)
  await next()
}

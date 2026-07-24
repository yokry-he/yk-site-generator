import { randomInt, randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { z } from 'zod'
import { env } from '../env'
import {
  authMiddleware,
  createAccessToken,
  hashToken,
  randomToken,
  safeHashEquals,
  type AuthEnv,
} from '../lib/auth'
import { mutateData, readData, type SessionRecord, type UserRecord } from '../lib/data-store'
import { errorBody } from '../types'

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const requestSchema = z.object({ email: emailSchema })
const verifySchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) })
const refreshSchema = z.object({ refreshToken: z.string().min(20).optional() })

const auth = new Hono<AuthEnv>()

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    role: user.role ?? 'user',
    status: user.status ?? 'active',
    createdAt: user.createdAt,
  }
}

function setRefreshCookie(c: Parameters<typeof setCookie>[0], token: string): void {
  setCookie(c, 'sf_refresh', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400,
  })
}

async function removeCode(email: string, id: string): Promise<void> {
  await mutateData((data) => {
    data.verificationCodes = data.verificationCodes.filter((item) => item.id !== id || item.email !== email)
  })
}

async function deliverCode(email: string, code: string): Promise<void> {
  if (!env.EMAIL_WEBHOOK_URL) {
    if (env.NODE_ENV === 'production') throw new Error('EMAIL_DELIVERY_NOT_CONFIGURED')
    return
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(env.EMAIL_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${env.EMAIL_WEBHOOK_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        to: email,
        template: 'siteforge-login-code',
        code,
        expiresInMinutes: env.VERIFICATION_CODE_TTL_MIN,
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`EMAIL_DELIVERY_HTTP_${response.status}`)
  } finally {
    clearTimeout(timer)
  }
}

auth.post('/request-code', async (c) => {
  let input: z.infer<typeof requestSchema>
  try {
    input = requestSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '邮箱格式错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  const existing = (await readData()).users.find((item) => item.email === input.email)
  if (existing && (existing.status ?? 'active') !== 'active') {
    return c.json(errorBody('ACCOUNT_RESTRICTED', '账号当前不可登录，请联系管理员'), 403)
  }

  const code = String(randomInt(100_000, 1_000_000))
  const id = randomUUID()
  const now = Date.now()
  const created = await mutateData((data) => {
    data.verificationCodes = data.verificationCodes.filter((item) => Date.parse(item.expiresAt) > now)
    const previous = data.verificationCodes
      .filter((item) => item.email === input.email)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    if (previous && now - Date.parse(previous.createdAt) < 60_000) return false
    data.verificationCodes = data.verificationCodes.filter((item) => item.email !== input.email)
    data.verificationCodes.push({
      id,
      email: input.email,
      codeHash: hashToken(`${input.email}:${code}`),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + env.VERIFICATION_CODE_TTL_MIN * 60_000).toISOString(),
      attempts: 0,
    })
    return true
  })
  if (!created) return c.json(errorBody('CODE_RATE_LIMIT', '验证码发送过于频繁,请 60 秒后重试'), 429)

  try {
    await deliverCode(input.email, code)
  } catch (err) {
    await removeCode(input.email, id)
    const message = err instanceof Error && err.message === 'EMAIL_DELIVERY_NOT_CONFIGURED'
      ? '生产环境尚未配置邮件发送服务'
      : '验证码邮件发送失败,请稍后重试'
    return c.json(errorBody('EMAIL_DELIVERY_FAILED', message), 502)
  }

  return c.json(
    {
      ok: true,
      expiresInSeconds: env.VERIFICATION_CODE_TTL_MIN * 60,
      retryAfterSeconds: 60,
      ...(env.NODE_ENV !== 'production' && !env.EMAIL_WEBHOOK_URL ? { debugCode: code } : {}),
    },
    202,
  )
})

auth.post('/verify', async (c) => {
  let input: z.infer<typeof verifySchema>
  try {
    input = verifySchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  const refreshToken = randomToken(36)
  const sessionId = randomUUID()
  const now = Date.now()
  const result = await mutateData<{ user?: UserRecord; session?: SessionRecord; error?: string }>((data) => {
    const record = data.verificationCodes
      .filter((item) => item.email === input.email)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
    if (!record || Date.parse(record.expiresAt) <= now) {
      data.verificationCodes = data.verificationCodes.filter((item) => item.email !== input.email)
      return { error: 'CODE_EXPIRED' }
    }
    if (record.attempts >= 5) return { error: 'CODE_ATTEMPTS_EXCEEDED' }
    if (!safeHashEquals(`${input.email}:${input.code}`, record.codeHash)) {
      record.attempts += 1
      return { error: record.attempts >= 5 ? 'CODE_ATTEMPTS_EXCEEDED' : 'CODE_INVALID' }
    }

    data.verificationCodes = data.verificationCodes.filter((item) => item.email !== input.email)
    let user = data.users.find((item) => item.email === input.email)
    const iso = new Date(now).toISOString()
    if (!user) {
      user = {
        id: randomUUID(),
        email: input.email,
        role: env.adminEmails.has(input.email) ? 'admin' : 'user',
        status: 'active',
        createdAt: iso,
        updatedAt: iso,
      }
      data.users.push(user)
    } else {
      if ((user.status ?? 'active') !== 'active') return { error: 'ACCOUNT_RESTRICTED' }
      if (env.adminEmails.has(input.email)) user.role = 'admin'
      user.updatedAt = iso
    }
    const session: SessionRecord = {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashToken(refreshToken),
      createdAt: iso,
      lastUsedAt: iso,
      expiresAt: new Date(now + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000).toISOString(),
    }
    data.sessions.push(session)
    return { user, session }
  })

  if (!result.user || !result.session) {
    const messages: Record<string, string> = {
      CODE_EXPIRED: '验证码不存在或已过期',
      CODE_INVALID: '验证码不正确',
      CODE_ATTEMPTS_EXCEEDED: '验证码错误次数过多,请重新获取',
      ACCOUNT_RESTRICTED: '账号当前不可登录，请联系管理员',
    }
    const status = result.error === 'ACCOUNT_RESTRICTED' ? 403 : 400
    return c.json(errorBody(result.error ?? 'CODE_INVALID', messages[result.error ?? ''] ?? '验证码校验失败'), status)
  }

  const access = createAccessToken({
    userId: result.user.id,
    sessionId: result.session.id,
    email: result.user.email,
  })
  setRefreshCookie(c, refreshToken)
  return c.json({
    user: publicUser(result.user),
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
  })
})

auth.post('/refresh', async (c) => {
  let bodyToken: string | undefined
  try {
    bodyToken = refreshSchema.parse(await c.req.json()).refreshToken
  } catch {
    // 允许空请求体,优先使用 HttpOnly Cookie
  }
  const supplied = getCookie(c, 'sf_refresh') ?? bodyToken
  if (!supplied) return c.json(errorBody('REFRESH_TOKEN_REQUIRED', '缺少刷新令牌'), 401)

  const nextRefreshToken = randomToken(36)
  const now = Date.now()
  const result = await mutateData<{ user?: UserRecord; session?: SessionRecord }>((data) => {
    const session = data.sessions.find(
      (item) =>
        !item.revokedAt &&
        Date.parse(item.expiresAt) > now &&
        safeHashEquals(supplied, item.refreshTokenHash),
    )
    if (!session) return {}
    const user = data.users.find((item) => item.id === session.userId)
    if (!user || (user.status ?? 'active') !== 'active') return {}
    session.refreshTokenHash = hashToken(nextRefreshToken)
    session.lastUsedAt = new Date(now).toISOString()
    return { user, session }
  })
  if (!result.user || !result.session) {
    deleteCookie(c, 'sf_refresh', { path: '/api/auth' })
    return c.json(errorBody('REFRESH_TOKEN_INVALID', '刷新令牌无效、账号受限或已过期'), 401)
  }

  const access = createAccessToken({
    userId: result.user.id,
    sessionId: result.session.id,
    email: result.user.email,
  })
  setRefreshCookie(c, nextRefreshToken)
  return c.json({
    user: publicUser(result.user),
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
  })
})

auth.use('/me', authMiddleware)
auth.get('/me', async (c) => {
  const claims = c.get('auth')
  const data = await readData()
  const user = data.users.find((item) => item.id === claims.sub)
  if (!user) return c.json(errorBody('USER_NOT_FOUND', '用户不存在'), 404)
  return c.json({ user: publicUser(user) })
})

auth.use('/logout', authMiddleware)
auth.post('/logout', async (c) => {
  const claims = c.get('auth')
  await mutateData((data) => {
    const session = data.sessions.find((item) => item.id === claims.sid && item.userId === claims.sub)
    if (session && !session.revokedAt) session.revokedAt = new Date().toISOString()
  })
  deleteCookie(c, 'sf_refresh', { path: '/api/auth' })
  return c.json({ ok: true })
})

export default auth

import { Hono } from 'hono'
import { z } from 'zod'
import { OFFICIAL_TEMPLATES } from 'shared'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  mutateData,
  readData,
  type FeedbackStatus,
  type UserRecord,
  type UserRole,
  type UserStatus,
} from '../lib/data-store'
import { recordAudit, requestMetadata } from '../lib/observability'
import {
  currentAuthorizedUser,
  hasPermission,
  operatorMiddleware,
  permissionMiddleware,
  userRole,
} from '../lib/rbac'
import { errorBody } from '../types'

const usersQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'active', 'suspended', 'deleted']).default('all'),
  role: z.enum(['all', 'user', 'admin', 'support']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

const updateUserSchema = z.object({
  role: z.enum(['user', 'admin', 'support']).optional(),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
}).refine((value) => value.role !== undefined || value.status !== undefined, '至少提交一个修改字段')

const logQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  action: z.string().trim().max(80).default(''),
  resourceType: z.string().trim().max(64).default(''),
  outcome: z.enum(['all', 'success', 'failure']).default('all'),
})

const eventQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  level: z.enum(['all', 'info', 'warning', 'error']).default('all'),
  source: z.string().trim().max(80).default(''),
})

const feedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  status: z.enum(['all', 'open', 'reviewed', 'resolved', 'dismissed']).default('all'),
  sentiment: z.enum(['all', 'positive', 'negative']).default('all'),
  siteType: z.string().trim().max(40).default(''),
  model: z.string().trim().max(120).default(''),
})

const feedbackStatusSchema = z.object({
  status: z.enum(['open', 'reviewed', 'resolved', 'dismissed']),
})

const admin = new Hono<AuthEnv>()
admin.use('*', authMiddleware)
admin.use('*', operatorMiddleware)

function roleOf(user: UserRecord): UserRole {
  return user.role ?? 'user'
}

function statusOf(user: UserRecord): UserStatus {
  return user.status ?? 'active'
}

function startOfDaysAgo(days: number): number {
  return Date.now() - days * 86_400_000
}

function feedbackSummary(data: Awaited<ReturnType<typeof readData>>) {
  const negative = data.feedback.filter((item) => item.sentiment === 'negative')
  const categoryCounts = negative
    .flatMap((item) => item.categories)
    .reduce<Record<string, number>>((acc, category) => {
      acc[category] = (acc[category] ?? 0) + 1
      return acc
    }, {})
  return {
    total: data.feedback.length,
    positive: data.feedback.length - negative.length,
    negative: negative.length,
    negativeRate: data.feedback.length ? Math.round((negative.length / data.feedback.length) * 100) : 0,
    open: data.feedback.filter((item) => item.status === 'open').length,
    topCategories: Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([category, count]) => ({ category, count })),
  }
}

async function auditBlockedUserAction(
  c: Parameters<typeof requestMetadata>[0],
  actor: UserRecord,
  targetId: string,
  errorCode: string,
  input: Record<string, unknown>,
): Promise<void> {
  const meta = requestMetadata(c)
  await recordAudit({
    actorUserId: actor.id,
    actorRole: userRole(actor),
    action: 'admin.user.update',
    resourceType: 'user',
    resourceId: targetId,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    outcome: 'failure',
    afterData: input,
    errorCode,
  })
}

admin.get('/overview', permissionMiddleware('admin.overview.read'), async (c) => {
  const data = await readData()
  const last30Days = startOfDaysAgo(30)
  const last24Hours = startOfDaysAgo(1)
  const recentUsage = data.usage.filter((item) => Date.parse(item.createdAt) >= last30Days)
  const usageByAction = recentUsage.reduce<Record<string, number>>((acc, item) => {
    acc[item.action] = (acc[item.action] ?? 0) + item.units
    return acc
  }, {})
  const dailyUsage = Array.from({ length: 14 }, (_, index) => {
    const start = new Date(Date.now() - (13 - index) * 86_400_000)
    start.setUTCHours(0, 0, 0, 0)
    const end = start.getTime() + 86_400_000
    const count = data.usage
      .filter((item) => {
        const time = Date.parse(item.createdAt)
        return time >= start.getTime() && time < end
      })
      .reduce((sum, item) => sum + item.units, 0)
    return { date: start.toISOString().slice(0, 10), value: count }
  })

  return c.json({
    overview: {
      users: {
        total: data.users.length,
        active: data.users.filter((item) => statusOf(item) === 'active').length,
        suspended: data.users.filter((item) => statusOf(item) === 'suspended').length,
        admins: data.users.filter((item) => roleOf(item) === 'admin').length,
      },
      projects: {
        total: data.projects.length,
        versions: data.projectVersions.length,
        fromTemplates: data.projects.filter((item) => Boolean(item.templateId)).length,
      },
      publications: {
        total: data.publications.length,
        published: data.publications.filter((item) => item.status === 'published').length,
        offline: data.publications.filter((item) => item.status === 'offline').length,
      },
      assets: {
        brandKits: data.brandKits.length,
        officialTemplates: OFFICIAL_TEMPLATES.length,
      },
      usage: {
        last30Days: recentUsage.reduce((sum, item) => sum + item.units, 0),
        byAction: usageByAction,
        daily: dailyUsage,
      },
      quality: feedbackSummary(data),
      operations: {
        audit24h: data.auditLogs.filter((item) => Date.parse(item.createdAt) >= last24Hours).length,
        errors24h: data.systemEvents.filter(
          (item) => item.level === 'error' && Date.parse(item.createdAt) >= last24Hours,
        ).length,
        slow24h: data.systemEvents.filter(
          (item) => item.eventType === 'request.slow' && Date.parse(item.createdAt) >= last24Hours,
        ).length,
      },
      recentEvents: [...data.systemEvents]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8),
      recentAudit: [...data.auditLogs]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 8),
      recentFeedback: [...data.feedback]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 8),
    },
  })
})

admin.get('/users', permissionMiddleware('users.read'), async (c) => {
  let query: z.infer<typeof usersQuerySchema>
  try {
    query = usersQuerySchema.parse(c.req.query())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '查询参数错误' : '查询参数错误'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const data = await readData()
  const normalized = query.q.toLowerCase()
  const rows = data.users
    .filter((user) => (
      (!normalized || user.email.toLowerCase().includes(normalized) || user.id.includes(normalized))
      && (query.status === 'all' || statusOf(user) === query.status)
      && (query.role === 'all' || roleOf(user) === query.role)
    ))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  const start = (query.page - 1) * query.limit
  const paged = rows.slice(start, start + query.limit).map((user) => {
    const sessions = data.sessions.filter((session) => session.userId === user.id)
    const activeSessions = sessions.filter(
      (session) => !session.revokedAt && Date.parse(session.expiresAt) > Date.now(),
    )
    return {
      id: user.id,
      email: user.email,
      role: roleOf(user),
      status: statusOf(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      projectCount: data.projects.filter((item) => item.userId === user.id).length,
      publicationCount: data.publications.filter((item) => item.userId === user.id).length,
      usageUnits: data.usage.filter((item) => item.userId === user.id).reduce((sum, item) => sum + item.units, 0),
      activeSessions: activeSessions.length,
      lastActiveAt: sessions.sort((a, b) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt))[0]?.lastUsedAt,
    }
  })
  return c.json({
    users: paged,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: rows.length,
      pages: Math.max(1, Math.ceil(rows.length / query.limit)),
    },
  })
})

admin.patch('/users/:id', async (c) => {
  let input: z.infer<typeof updateUserSchema>
  try {
    input = updateUserSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  const claims = c.get('auth')
  const actor = await currentAuthorizedUser(claims.sub)
  if (!actor) return c.json(errorBody('UNAUTHORIZED', '登录状态无效'), 401)
  if (input.status !== undefined && !hasPermission(actor, 'users.update_status')) {
    return c.json(errorBody('PERMISSION_DENIED', '缺少用户状态修改权限'), 403)
  }
  if (input.role !== undefined && !hasPermission(actor, 'users.update_role')) {
    return c.json(errorBody('PERMISSION_DENIED', '缺少用户角色修改权限'), 403)
  }

  const targetId = c.req.param('id')
  if (targetId === claims.sub && input.status && input.status !== 'active') {
    await auditBlockedUserAction(c, actor, targetId, 'SELF_LOCKOUT_BLOCKED', input)
    return c.json(errorBody('SELF_LOCKOUT_BLOCKED', '不能限制当前登录账号'), 409)
  }
  if (targetId === claims.sub && input.role && input.role !== 'admin') {
    await auditBlockedUserAction(c, actor, targetId, 'SELF_DEMOTION_BLOCKED', input)
    return c.json(errorBody('SELF_DEMOTION_BLOCKED', '不能降低当前登录账号权限'), 409)
  }

  const result = await mutateData<
    | { ok: true; before: Record<string, unknown>; after: Record<string, unknown> }
    | { ok: false }
  >((data) => {
    const user = data.users.find((item) => item.id === targetId)
    if (!user) return { ok: false }
    const before = { id: user.id, email: user.email, role: roleOf(user), status: statusOf(user) }
    if (input.role !== undefined) user.role = input.role
    if (input.status !== undefined) user.status = input.status
    user.updatedAt = new Date().toISOString()
    if (input.status && input.status !== 'active') {
      for (const session of data.sessions) {
        if (session.userId === user.id && !session.revokedAt) session.revokedAt = user.updatedAt
      }
    }
    return {
      ok: true,
      before,
      after: { id: user.id, email: user.email, role: roleOf(user), status: statusOf(user) },
    }
  })
  if (!result.ok) {
    await auditBlockedUserAction(c, actor, targetId, 'USER_NOT_FOUND', input)
    return c.json(errorBody('USER_NOT_FOUND', '用户不存在'), 404)
  }

  const meta = requestMetadata(c)
  await recordAudit({
    actorUserId: actor.id,
    actorRole: userRole(actor),
    action: 'admin.user.update',
    resourceType: 'user',
    resourceId: targetId,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    outcome: 'success',
    beforeData: result.before,
    afterData: result.after,
  })
  return c.json({ user: result.after })
})

admin.get('/feedback', permissionMiddleware('feedback.read'), async (c) => {
  let query: z.infer<typeof feedbackQuerySchema>
  try {
    query = feedbackQuerySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '查询参数错误'), 400)
  }
  const data = await readData()
  const rows = data.feedback
    .filter((item) => (
      (query.status === 'all' || item.status === query.status)
      && (query.sentiment === 'all' || item.sentiment === query.sentiment)
      && (!query.siteType || item.siteType.includes(query.siteType))
      && (!query.model || item.model?.includes(query.model))
    ))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, query.limit)
  return c.json({ feedback: rows, summary: feedbackSummary(data) })
})

admin.patch('/feedback/:id', permissionMiddleware('feedback.resolve'), async (c) => {
  let input: z.infer<typeof feedbackStatusSchema>
  try {
    input = feedbackStatusSchema.parse(await c.req.json())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '反馈状态无效'), 400)
  }
  const claims = c.get('auth')
  const actor = await currentAuthorizedUser(claims.sub)
  if (!actor) return c.json(errorBody('UNAUTHORIZED', '登录状态无效'), 401)
  const id = c.req.param('id')
  const result = await mutateData<
    | { ok: true; before: { status: FeedbackStatus }; after: { status: FeedbackStatus } }
    | { ok: false }
  >((data) => {
    const row = data.feedback.find((item) => item.id === id)
    if (!row) return { ok: false }
    const before = { status: row.status }
    row.status = input.status
    row.updatedAt = new Date().toISOString()
    return { ok: true, before, after: { status: row.status } }
  })
  if (!result.ok) return c.json(errorBody('FEEDBACK_NOT_FOUND', '反馈不存在'), 404)
  const meta = requestMetadata(c)
  await recordAudit({
    actorUserId: actor.id,
    actorRole: userRole(actor),
    action: 'admin.feedback.status.update',
    resourceType: 'feedback',
    resourceId: id,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    outcome: 'success',
    beforeData: result.before,
    afterData: result.after,
  })
  return c.json({ id, status: input.status })
})

admin.get('/audit', permissionMiddleware('audit.read'), async (c) => {
  let query: z.infer<typeof logQuerySchema>
  try {
    query = logQuerySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '查询参数错误'), 400)
  }
  const data = await readData()
  const rows = data.auditLogs
    .filter((item) => (
      (!query.action || item.action.includes(query.action))
      && (!query.resourceType || item.resourceType.includes(query.resourceType))
      && (query.outcome === 'all' || item.outcome === query.outcome)
    ))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, query.limit)
  return c.json({ auditLogs: rows })
})

admin.get('/events', permissionMiddleware('events.read'), async (c) => {
  let query: z.infer<typeof eventQuerySchema>
  try {
    query = eventQuerySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '查询参数错误'), 400)
  }
  const data = await readData()
  const rows = data.systemEvents
    .filter((item) => (
      (query.level === 'all' || item.level === query.level)
      && (!query.source || item.source.includes(query.source))
    ))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, query.limit)
  return c.json({ systemEvents: rows })
})

export default admin

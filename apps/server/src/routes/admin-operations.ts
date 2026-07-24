import { Hono } from 'hono'
import { z } from 'zod'
import { OFFICIAL_TEMPLATES, getOfficialTemplate } from 'shared'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  mutateData,
  readData,
  type FeatureFlagRecord,
  type TemplateOperationRecord,
} from '../lib/data-store'
import { FEATURE_FLAG_DEFINITIONS, resolveFeatureFlags } from '../lib/feature-flags'
import { recordAudit, requestMetadata } from '../lib/observability'
import {
  operatorMiddleware,
  permissionMiddleware,
  permissionsForRole,
  userRole,
} from '../lib/rbac'
import { operatedTemplate, operatedTemplates } from '../lib/template-operations'
import { errorBody } from '../types'

const templateQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'draft', 'published', 'archived']).default('all'),
})

const templatePatchSchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  expectedVersion: z.number().int().min(0),
}).refine(
  (input) => input.status !== undefined || input.featured !== undefined || input.sortOrder !== undefined,
  '至少提交一个模板运营字段',
)

const flagPatchSchema = z.object({
  enabled: z.boolean().optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  rules: z.object({
    userIds: z.array(z.string().uuid()).max(100).optional(),
    emails: z.array(z.string().trim().toLowerCase().email()).max(100).optional(),
    roles: z.array(z.enum(['user', 'support', 'admin'])).max(3).optional(),
  }).optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  expectedVersion: z.number().int().min(0),
}).superRefine((input, ctx) => {
  if (
    input.startsAt && input.expiresAt
    && Date.parse(input.startsAt) >= Date.parse(input.expiresAt)
  ) {
    ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: '失效时间必须晚于生效时间' })
  }
})

const router = new Hono<AuthEnv>()
router.use('*', authMiddleware)
router.use('*', operatorMiddleware)

async function actor(c: Parameters<typeof requestMetadata>[0]) {
  const claims = c.get('auth')
  const user = (await readData()).users.find((item) => item.id === claims.sub)
  if (!user) throw new Error('AUTHORIZED_USER_NOT_FOUND')
  return user
}

function featureFlagAuditData(record: Partial<FeatureFlagRecord> & { key: string }): Record<string, unknown> {
  return {
    key: record.key,
    enabled: record.enabled,
    rolloutPercent: record.rolloutPercent,
    description: record.description,
    rules: record.rules ? structuredClone(record.rules) : {},
    startsAt: record.startsAt,
    expiresAt: record.expiresAt,
    version: record.version,
    updatedBy: record.updatedBy,
    updatedAt: record.updatedAt,
  }
}

router.get('/access', async (c) => {
  const user = await actor(c)
  return c.json({ role: userRole(user), permissions: permissionsForRole(userRole(user)) })
})

router.get('/templates', permissionMiddleware('templates.read'), async (c) => {
  let query: z.infer<typeof templateQuerySchema>
  try {
    query = templateQuerySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '模板查询参数错误'), 400)
  }
  const normalized = query.q.toLowerCase()
  const data = await readData()
  const rows = operatedTemplates(data, OFFICIAL_TEMPLATES).filter((template) => (
    (query.status === 'all' || template.status === query.status)
    && (!normalized || [template.name, template.slug, template.industry, template.category, template.siteType]
      .some((value) => value.toLowerCase().includes(normalized)))
  ))
  return c.json({
    templates: rows,
    summary: {
      total: rows.length,
      published: rows.filter((item) => item.status === 'published').length,
      draft: rows.filter((item) => item.status === 'draft').length,
      archived: rows.filter((item) => item.status === 'archived').length,
      featured: rows.filter((item) => item.featured).length,
    },
  })
})

router.patch('/templates/:id', permissionMiddleware('templates.publish'), async (c) => {
  let input: z.infer<typeof templatePatchSchema>
  try {
    input = templatePatchSchema.parse(await c.req.json())
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const definition = getOfficialTemplate(c.req.param('id'))
  if (!definition) return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)

  const user = await actor(c)
  const now = new Date().toISOString()
  const result = await mutateData<
    | { ok: true; before: Record<string, unknown>; after: ReturnType<typeof operatedTemplate> }
    | { ok: false; currentVersion: number }
  >((data) => {
    const before = operatedTemplate(data, definition)
    if (before.operationVersion !== input.expectedVersion) {
      return { ok: false, currentVersion: before.operationVersion }
    }
    let operation = data.templateOperations.find((item) => item.templateId === definition.id)
    if (!operation) {
      operation = {
        templateId: definition.id,
        status: before.status,
        featured: before.featured,
        sortOrder: before.sortOrder,
        version: 0,
        updatedBy: user.id,
        updatedAt: now,
      } satisfies TemplateOperationRecord
      data.templateOperations.push(operation)
    }
    if (input.status !== undefined) operation.status = input.status
    if (input.featured !== undefined) operation.featured = input.featured
    if (input.sortOrder !== undefined) operation.sortOrder = input.sortOrder
    operation.version += 1
    operation.updatedBy = user.id
    operation.updatedAt = now
    return {
      ok: true,
      before: {
        status: before.status,
        featured: before.featured,
        sortOrder: before.sortOrder,
        version: before.operationVersion,
      },
      after: operatedTemplate(data, definition),
    }
  })
  if (!result.ok) {
    return c.json(errorBody('VERSION_CONFLICT', `模板已被其他操作更新，当前版本为 ${result.currentVersion}`), 409)
  }

  const meta = requestMetadata(c)
  await recordAudit({
    actorUserId: user.id,
    actorRole: userRole(user),
    action: 'admin.template.operation.update',
    resourceType: 'official_template',
    resourceId: definition.id,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    outcome: 'success',
    beforeData: result.before,
    afterData: {
      status: result.after.status,
      featured: result.after.featured,
      sortOrder: result.after.sortOrder,
      version: result.after.operationVersion,
    },
  })
  return c.json({ template: result.after })
})

router.get('/feature-flags', permissionMiddleware('feature_flags.read'), async (c) => {
  const data = await readData()
  return c.json({ flags: resolveFeatureFlags(data) })
})

router.put('/feature-flags/:key', permissionMiddleware('feature_flags.write'), async (c) => {
  let input: z.infer<typeof flagPatchSchema>
  try {
    input = flagPatchSchema.parse(await c.req.json())
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const definition = FEATURE_FLAG_DEFINITIONS.find((item) => item.key === c.req.param('key'))
  if (!definition) return c.json(errorBody('FEATURE_FLAG_NOT_FOUND', '功能开关不存在'), 404)

  const user = await actor(c)
  const now = new Date().toISOString()
  const result = await mutateData<
    | { ok: true; before: Record<string, unknown>; after: FeatureFlagRecord }
    | { ok: false; currentVersion: number }
  >((data) => {
    let record = data.featureFlags.find((item) => item.key === definition.key)
    const currentVersion = record?.version ?? 0
    if (currentVersion !== input.expectedVersion) return { ok: false, currentVersion }
    const before = featureFlagAuditData(record ?? {
      key: definition.key,
      enabled: definition.defaultEnabled,
      rolloutPercent: 100,
      description: definition.description,
      rules: {},
      version: 0,
    })
    if (!record) {
      record = {
        key: definition.key,
        enabled: definition.defaultEnabled,
        rolloutPercent: 100,
        description: definition.description,
        rules: {},
        version: 0,
        updatedBy: user.id,
        createdAt: now,
        updatedAt: now,
      }
      data.featureFlags.push(record)
    }
    if (input.enabled !== undefined) record.enabled = input.enabled
    if (input.rolloutPercent !== undefined) record.rolloutPercent = input.rolloutPercent
    if (input.description !== undefined) record.description = input.description || definition.description
    if (input.rules !== undefined) record.rules = input.rules
    if (input.startsAt !== undefined) record.startsAt = input.startsAt ?? undefined
    if (input.expiresAt !== undefined) record.expiresAt = input.expiresAt ?? undefined
    record.version += 1
    record.updatedBy = user.id
    record.updatedAt = now
    return { ok: true, before, after: structuredClone(record) }
  })
  if (!result.ok) {
    return c.json(errorBody('VERSION_CONFLICT', `开关已被其他操作更新，当前版本为 ${result.currentVersion}`), 409)
  }

  const meta = requestMetadata(c)
  await recordAudit({
    actorUserId: user.id,
    actorRole: userRole(user),
    action: 'admin.feature_flag.update',
    resourceType: 'feature_flag',
    resourceId: definition.key,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    outcome: 'success',
    beforeData: result.before,
    afterData: featureFlagAuditData(result.after),
  })
  const data = await readData()
  return c.json({ flag: resolveFeatureFlags(data).find((item) => item.key === definition.key) })
})

export default router

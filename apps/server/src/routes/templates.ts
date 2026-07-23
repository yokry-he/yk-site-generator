import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  OFFICIAL_TEMPLATES,
  applyBrandKitToHtml,
  getOfficialTemplate,
  renderOfficialTemplate,
} from 'shared'
import { env } from '../env'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  mutateData,
  readData,
  type ProjectRecord,
  type ProjectVersionRecord,
} from '../lib/data-store'
import { evaluateFeatureFlag } from '../lib/feature-flags'
import { operatedTemplate, operatedTemplates } from '../lib/template-operations'
import { errorBody } from '../types'

const useSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  brandKitId: z.string().uuid().optional(),
  variables: z.record(z.string(), z.string().max(300)).default({}),
})

const templates = new Hono<AuthEnv>()

function publicTemplate(template: ReturnType<typeof operatedTemplate>) {
  const {
    operationVersion: _operationVersion,
    operationUpdatedAt: _operationUpdatedAt,
    operationUpdatedBy: _operationUpdatedBy,
    useCount: _useCount,
    publicationCount: _publicationCount,
    negativeFeedbackCount: _negativeFeedbackCount,
    status: _status,
    sortOrder,
    ...definition
  } = template
  return {
    ...definition,
    sortOrder,
    variableCount: template.variables.length,
  }
}

function anonymousIdentity(c: Parameters<typeof templates.get>[0] extends never ? never : never): string {
  return String(c)
}

function requestIdentity(c: { req: { header(name: string): string | undefined } }): string {
  return c.req.header('x-anonymous-id')
    || c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')
    || c.req.header('user-agent')
    || 'anonymous'
}

templates.get('/', async (c) => {
  const data = await readData()
  if (!evaluateFeatureFlag(data, 'official-templates', { anonymousId: requestIdentity(c) })) {
    return c.json(errorBody('FEATURE_DISABLED', '官方模板中心当前未开放'), 503)
  }
  const visible = operatedTemplates(data, OFFICIAL_TEMPLATES).filter((template) => template.status === 'published')
  const categories = [...new Set(visible.map((template) => template.category))]
  const industries = [...new Set(visible.map((template) => template.industry))]
  const styles = [...new Set(visible.flatMap((template) => template.styleTags))]
  return c.json({
    templates: visible.map(publicTemplate),
    filters: { categories, industries, styles },
  })
})

templates.get('/:id', async (c) => {
  const data = await readData()
  if (!evaluateFeatureFlag(data, 'official-templates', { anonymousId: requestIdentity(c) })) {
    return c.json(errorBody('FEATURE_DISABLED', '官方模板中心当前未开放'), 503)
  }
  const definition = getOfficialTemplate(c.req.param('id'))
  if (!definition) return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)
  const template = operatedTemplate(data, definition)
  if (template.status !== 'published') return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)
  return c.json({
    template: publicTemplate(template),
    previewHtml: renderOfficialTemplate(definition),
  })
})

templates.post('/:id/use', authMiddleware, async (c) => {
  const data = await readData()
  const claims = c.get('auth')
  if (!evaluateFeatureFlag(data, 'official-templates', {
    userId: claims.sub,
    email: claims.email,
    role: data.users.find((item) => item.id === claims.sub)?.role ?? 'user',
  })) {
    return c.json(errorBody('FEATURE_DISABLED', '官方模板中心当前未开放'), 503)
  }

  const definition = getOfficialTemplate(c.req.param('id'))
  if (!definition) return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)
  const template = operatedTemplate(data, definition)
  if (template.status !== 'published') return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)

  let input: z.infer<typeof useSchema>
  try {
    input = useSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  const userId = claims.sub
  const now = new Date().toISOString()
  const baseHtml = renderOfficialTemplate(definition, input.variables)
  if (Buffer.byteLength(baseHtml, 'utf8') > env.MAX_PROJECT_BYTES) {
    return c.json(errorBody('PROJECT_TOO_LARGE', '模板产物超过项目大小上限'), 413)
  }

  const result = await mutateData<
    | { ok: true; project: ProjectRecord; version: ProjectVersionRecord }
    | { ok: false; code: 'BRAND_KIT_NOT_FOUND' | 'TEMPLATE_NOT_AVAILABLE' }
  >((draft) => {
    const currentTemplate = operatedTemplate(draft, definition)
    if (currentTemplate.status !== 'published') return { ok: false, code: 'TEMPLATE_NOT_AVAILABLE' }
    const brandKit = input.brandKitId
      ? draft.brandKits.find((item) => item.id === input.brandKitId && item.userId === userId)
      : undefined
    if (input.brandKitId && !brandKit) return { ok: false, code: 'BRAND_KIT_NOT_FOUND' }

    const html = brandKit ? applyBrandKitToHtml(baseHtml, brandKit) : baseHtml
    const project: ProjectRecord = {
      id: randomUUID(),
      userId,
      title: input.title?.trim() || input.variables.brandName?.trim() || definition.name,
      siteType: definition.siteType,
      requirement: `基于官方模板「${definition.name}」创建`,
      templateId: definition.id,
      createdAt: now,
      updatedAt: now,
    }
    const version: ProjectVersionRecord = {
      id: randomUUID(),
      projectId: project.id,
      userId,
      version: 1,
      html,
      source: 'import',
      instruction: brandKit
        ? `使用官方模板「${definition.name}」并应用品牌套件「${brandKit.name}」`
        : `使用官方模板「${definition.name}」`,
      createdAt: now,
    }
    draft.projects.push(project)
    draft.projectVersions.push(version)
    return { ok: true, project: structuredClone(project), version: structuredClone(version) }
  })

  if (!result.ok) {
    if (result.code === 'TEMPLATE_NOT_AVAILABLE') {
      return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)
    }
    return c.json(errorBody(result.code, '品牌套件不存在'), 404)
  }
  return c.json(
    {
      project: {
        ...result.project,
        latestVersion: {
          id: result.version.id,
          projectId: result.version.projectId,
          userId: result.version.userId,
          version: result.version.version,
          source: result.version.source,
          instruction: result.version.instruction,
          createdAt: result.version.createdAt,
          sizeBytes: Buffer.byteLength(result.version.html, 'utf8'),
        },
      },
    },
    201,
  )
})

export default templates

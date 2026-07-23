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
  type ProjectRecord,
  type ProjectVersionRecord,
} from '../lib/data-store'
import { errorBody } from '../types'

const useSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  brandKitId: z.string().uuid().optional(),
  variables: z.record(z.string(), z.string().max(300)).default({}),
})

const templates = new Hono<AuthEnv>()

function publicTemplate(template: (typeof OFFICIAL_TEMPLATES)[number]) {
  return {
    ...template,
    variableCount: template.variables.length,
  }
}

templates.get('/', (c) => {
  const categories = [...new Set(OFFICIAL_TEMPLATES.map((template) => template.category))]
  const industries = [...new Set(OFFICIAL_TEMPLATES.map((template) => template.industry))]
  const styles = [...new Set(OFFICIAL_TEMPLATES.flatMap((template) => template.styleTags))]
  return c.json({
    templates: OFFICIAL_TEMPLATES.map(publicTemplate),
    filters: { categories, industries, styles },
  })
})

templates.get('/:id', (c) => {
  const template = getOfficialTemplate(c.req.param('id'))
  if (!template) return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)
  return c.json({
    template: publicTemplate(template),
    previewHtml: renderOfficialTemplate(template),
  })
})

templates.post('/:id/use', authMiddleware, async (c) => {
  const template = getOfficialTemplate(c.req.param('id'))
  if (!template) return c.json(errorBody('TEMPLATE_NOT_FOUND', '官方模板不存在'), 404)

  let input: z.infer<typeof useSchema>
  try {
    input = useSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const baseHtml = renderOfficialTemplate(template, input.variables)
  if (Buffer.byteLength(baseHtml, 'utf8') > env.MAX_PROJECT_BYTES) {
    return c.json(errorBody('PROJECT_TOO_LARGE', '模板产物超过项目大小上限'), 413)
  }

  const result = await mutateData<
    | { ok: true; project: ProjectRecord; version: ProjectVersionRecord }
    | { ok: false; code: 'BRAND_KIT_NOT_FOUND' }
  >((data) => {
    const brandKit = input.brandKitId
      ? data.brandKits.find((item) => item.id === input.brandKitId && item.userId === userId)
      : undefined
    if (input.brandKitId && !brandKit) return { ok: false, code: 'BRAND_KIT_NOT_FOUND' }

    const html = brandKit ? applyBrandKitToHtml(baseHtml, brandKit) : baseHtml
    const project: ProjectRecord = {
      id: randomUUID(),
      userId,
      title: input.title?.trim() || input.variables.brandName?.trim() || template.name,
      siteType: template.siteType,
      requirement: `基于官方模板「${template.name}」创建`,
      templateId: template.id,
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
        ? `使用官方模板「${template.name}」并应用品牌套件「${brandKit.name}」`
        : `使用官方模板「${template.name}」`,
      createdAt: now,
    }
    data.projects.push(project)
    data.projectVersions.push(version)
    return { ok: true, project: structuredClone(project), version: structuredClone(version) }
  })

  if (!result.ok) return c.json(errorBody(result.code, '品牌套件不存在'), 404)
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

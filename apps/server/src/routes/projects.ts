import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  mutateData,
  readData,
  type ProjectRecord,
  type ProjectVersionRecord,
  type ProjectVersionSource,
} from '../lib/data-store'
import { authenticatedFeatureEnabled, featureName } from '../lib/feature-flags'
import { removePublishedArtifact } from '../lib/publication-store'
import {
  applyDocumentToVersion,
  siteDocumentChangeSummary,
  siteDocumentFromInput,
  siteDocumentFromVersion,
  siteDocumentInputShape,
  siteDocumentWithinLimit,
  validateHomePage,
  versionDocumentSummary,
} from '../lib/site-project-policy'
import { errorBody } from '../types'

const optionalImage = z.string().max(700_000).refine(
  (value) => value === '' || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(value),
  '封面图片格式不受支持',
)

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  siteType: z.string().trim().min(1).max(40),
  requirement: z.string().trim().max(10_000).default(''),
  ...siteDocumentInputShape,
  source: z.enum(['generate', 'iterate', 'editor', 'import']).default('import'),
  instruction: z.string().max(10_000).optional(),
  model: z.string().max(120).optional(),
  brandKitId: z.string().uuid().optional(),
}).superRefine(validateHomePage)

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  siteType: z.string().trim().min(1).max(40).optional(),
  requirement: z.string().trim().max(10_000).optional(),
  status: z.enum(['active', 'archived', 'trashed']).optional(),
  starred: z.boolean().optional(),
  brandKitId: z.string().uuid().nullable().optional(),
  coverDataUrl: optionalImage.nullable().optional(),
  openedAt: z.string().datetime().optional(),
}).refine((input) => Object.keys(input).length > 0, '至少提交一个修改字段')

const listQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'trashed', 'all']).default('active'),
})

const versionSchema = z.object({
  ...siteDocumentInputShape,
  source: z.enum(['generate', 'iterate', 'editor', 'import']),
  instruction: z.string().max(10_000).optional(),
  model: z.string().max(120).optional(),
  name: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
  parentVersionId: z.string().uuid().optional(),
  changeSummary: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
}).superRefine((input, context) => {
  if (!input.html && !input.pages?.length) {
    context.addIssue({ code: 'custom', message: '必须提供 html 或 pages' })
  }
  validateHomePage(input, context)
})

const versionMetaSchema = z.object({
  name: z.string().trim().max(80).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  starred: z.boolean().optional(),
}).refine((input) => Object.keys(input).length > 0, '至少提交一个版本字段')
const rollbackSchema = z.object({ versionId: z.string().uuid() })

const projects = new Hono<AuthEnv>()
projects.use('*', authMiddleware)

function projectStatus(project: ProjectRecord) {
  return project.status ?? 'active'
}

function publicProject(project: ProjectRecord, latest?: ProjectVersionRecord) {
  return {
    ...project,
    status: projectStatus(project),
    starred: project.starred ?? false,
    latestVersion: latest ? versionSummary(latest) : null,
  }
}

function versionSummary(version: ProjectVersionRecord) {
  const { html: _html, pages: _pages, homePageId: _homePageId, ...rest } = version
  return {
    ...rest,
    ...versionDocumentSummary(version),
    starred: version.starred ?? false,
    changeSummary: version.changeSummary ?? [],
  }
}

projects.get('/', async (c) => {
  let query: z.infer<typeof listQuerySchema>
  try {
    query = listQuerySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '项目筛选参数无效'), 400)
  }
  const userId = c.get('auth').sub
  const data = await readData()
  const rows = data.projects
    .filter((project) => project.userId === userId && (query.status === 'all' || projectStatus(project) === query.status))
    .sort((a, b) => {
      if (Boolean(a.starred) !== Boolean(b.starred)) return a.starred ? -1 : 1
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
    .map((project) => {
      const latest = data.projectVersions
        .filter((version) => version.projectId === project.id && version.userId === userId)
        .sort((a, b) => b.version - a.version)[0]
      return publicProject(project, latest)
    })
  return c.json({ projects: rows })
})

projects.post('/', async (c) => {
  let input: z.infer<typeof createSchema>
  try {
    input = createSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  if (input.source === 'editor' && !(await authenticatedFeatureEnabled('visual-editor', c.get('auth')))) {
    return c.json(errorBody('FEATURE_DISABLED', `${featureName('visual-editor')}当前未开放`), 503)
  }
  const initialDocument = input.html || input.pages?.length ? siteDocumentFromInput(input) : undefined
  if (initialDocument && !siteDocumentWithinLimit(initialDocument)) {
    return c.json(errorBody('PROJECT_TOO_LARGE', '整站项目版本超过大小上限'), 413)
  }

  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const result = await mutateData((data) => {
    if (input.brandKitId && !data.brandKits.some((kit) => kit.id === input.brandKitId && kit.userId === userId)) {
      return { error: 'BRAND_KIT_NOT_FOUND' as const }
    }
    const project: ProjectRecord = {
      id: randomUUID(),
      userId,
      title: input.title,
      siteType: input.siteType,
      requirement: input.requirement,
      brandKitId: input.brandKitId,
      status: 'active',
      starred: false,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    data.projects.push(project)
    let version: ProjectVersionRecord | undefined
    if (initialDocument) {
      version = applyDocumentToVersion({
        id: randomUUID(),
        projectId: project.id,
        userId,
        version: 1,
        html: '',
        source: input.source,
        instruction: input.instruction,
        model: input.model,
        name: '初始版本',
        starred: true,
        changeSummary: siteDocumentChangeSummary(undefined, initialDocument),
        createdAt: now,
      }, initialDocument)
      data.projectVersions.push(version)
    }
    return { project, version }
  })
  if ('error' in result && result.error) return c.json(errorBody(result.error, '品牌套件不存在'), 404)
  return c.json({ project: publicProject(result.project, result.version) }, 201)
})

projects.post('/:id/duplicate', async (c) => {
  const userId = c.get('auth').sub
  const projectId = c.req.param('id')
  const now = new Date().toISOString()
  const result = await mutateData<null | { project: ProjectRecord; latest?: ProjectVersionRecord }>((data) => {
    const source = data.projects.find((item) => item.id === projectId && item.userId === userId)
    if (!source) return null
    const project: ProjectRecord = {
      ...structuredClone(source),
      id: randomUUID(),
      title: `${source.title} 副本`,
      status: 'active',
      starred: false,
      duplicatedFromId: source.id,
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    }
    data.projects.push(project)
    const sourceVersions = data.projectVersions
      .filter((item) => item.projectId === source.id && item.userId === userId)
      .sort((a, b) => a.version - b.version)
    const idMap = new Map<string, string>()
    const versions = sourceVersions.map((sourceVersion) => {
      const id = randomUUID()
      const parentVersionId = sourceVersion.parentVersionId
      idMap.set(sourceVersion.id, id)
      const version: ProjectVersionRecord = {
        ...structuredClone(sourceVersion),
        id,
        projectId: project.id,
        parentVersionId: parentVersionId ? idMap.get(parentVersionId) : undefined,
        createdAt: now,
      }
      data.projectVersions.push(version)
      return version
    })
    return { project: structuredClone(project), latest: versions.at(-1) }
  })
  if (!result) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  return c.json({ project: publicProject(result.project, result.latest) }, 201)
})

projects.get('/:id', async (c) => {
  const userId = c.get('auth').sub
  const projectId = c.req.param('id')
  const now = new Date().toISOString()
  const data = await readData()
  const project = data.projects.find((item) => item.id === projectId && item.userId === userId)
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  const versions = data.projectVersions
    .filter((item) => item.projectId === project.id && item.userId === userId)
    .sort((a, b) => b.version - a.version)
  void mutateData((draft) => {
    const row = draft.projects.find((item) => item.id === projectId && item.userId === userId)
    if (row) row.openedAt = now
  })
  return c.json({
    project: publicProject({ ...project, openedAt: now }, versions[0]),
    versions: versions.map(versionSummary),
  })
})

projects.patch('/:id', async (c) => {
  let input: z.infer<typeof updateSchema>
  try {
    input = updateSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const project = await mutateData<ProjectRecord | null | 'BRAND_KIT_NOT_FOUND'>((data) => {
    const row = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!row) return null
    if (input.brandKitId && !data.brandKits.some((kit) => kit.id === input.brandKitId && kit.userId === userId)) {
      return 'BRAND_KIT_NOT_FOUND'
    }
    if (input.title !== undefined) row.title = input.title
    if (input.siteType !== undefined) row.siteType = input.siteType
    if (input.requirement !== undefined) row.requirement = input.requirement
    if (input.status !== undefined) row.status = input.status
    if (input.starred !== undefined) row.starred = input.starred
    if (input.brandKitId !== undefined) row.brandKitId = input.brandKitId ?? undefined
    if (input.coverDataUrl !== undefined) row.coverDataUrl = input.coverDataUrl || undefined
    if (input.openedAt !== undefined) row.openedAt = input.openedAt
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  if (project === 'BRAND_KIT_NOT_FOUND') return c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  return c.json({ project: { ...project, status: projectStatus(project), starred: project.starred ?? false } })
})

projects.delete('/:id', async (c) => {
  const userId = c.get('auth').sub
  const projectId = c.req.param('id')
  const publications = (await readData()).publications.filter(
    (item) => item.projectId === projectId && item.userId === userId,
  )
  for (const publication of publications) await removePublishedArtifact(publication.slug, publication.pages)

  const deleted = await mutateData((data) => {
    const before = data.projects.length
    data.projects = data.projects.filter((item) => item.id !== projectId || item.userId !== userId)
    if (data.projects.length === before) return false
    data.projectVersions = data.projectVersions.filter(
      (item) => item.projectId !== projectId || item.userId !== userId,
    )
    data.publications = data.publications.filter(
      (item) => item.projectId !== projectId || item.userId !== userId,
    )
    data.feedback = data.feedback.filter((item) => item.projectId !== projectId || item.userId !== userId)
    return true
  })
  if (!deleted) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  return c.json({ ok: true })
})

projects.post('/:id/versions', async (c) => {
  let input: z.infer<typeof versionSchema>
  try {
    input = versionSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  if (input.source === 'editor' && !(await authenticatedFeatureEnabled('visual-editor', c.get('auth')))) {
    return c.json(errorBody('FEATURE_DISABLED', `${featureName('visual-editor')}当前未开放`), 503)
  }
  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const result = await mutateData<{ version?: ProjectVersionRecord; error?: 'PROJECT_NOT_FOUND' | 'PROJECT_TOO_LARGE' }>((data) => {
    const project = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!project) return { error: 'PROJECT_NOT_FOUND' }
    const existingVersions = data.projectVersions.filter((item) => item.projectId === project.id && item.userId === userId)
    const latest = [...existingVersions].sort((a, b) => b.version - a.version)[0]
    const parent = input.parentVersionId
      ? existingVersions.find((item) => item.id === input.parentVersionId)
      : latest

    // Older clients submit only `html`. On a multi-page project this means “replace
    // the home page”, not “discard every other page”. This server-side fallback keeps
    // the whole-site invariant even if a caller has not yet adopted the pages payload.
    let document = siteDocumentFromInput(input)
    if (!input.pages?.length && input.html && parent) {
      const parentDocument = siteDocumentFromVersion(parent)
      document = {
        ...parentDocument,
        pages: parentDocument.pages.map((page) => (
          page.id === parentDocument.homePageId ? { ...page, html: input.html! } : { ...page }
        )),
      }
    }
    if (!siteDocumentWithinLimit(document)) return { error: 'PROJECT_TOO_LARGE' }

    const next = Math.max(0, ...existingVersions.map((item) => item.version)) + 1
    const row = applyDocumentToVersion<ProjectVersionRecord>({
      id: randomUUID(),
      projectId: project.id,
      userId,
      version: next,
      html: '',
      source: input.source as ProjectVersionSource,
      instruction: input.instruction,
      model: input.model,
      name: input.name || `第 ${next} 版`,
      note: input.note,
      parentVersionId: parent?.id,
      starred: false,
      changeSummary: input.changeSummary ?? siteDocumentChangeSummary(parent, document),
      createdAt: now,
    }, document)
    data.projectVersions.push(row)
    project.updatedAt = now
    project.openedAt = now
    return { version: structuredClone(row) }
  })
  if (!result.version) {
    if (result.error === 'PROJECT_TOO_LARGE') return c.json(errorBody(result.error, '整站项目版本超过大小上限'), 413)
    return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  }
  return c.json({ version: versionSummary(result.version) }, 201)
})

projects.patch('/:id/versions/:versionId', async (c) => {
  let input: z.infer<typeof versionMetaSchema>
  try {
    input = versionMetaSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const version = await mutateData<ProjectVersionRecord | null>((data) => {
    const row = data.projectVersions.find(
      (item) => item.id === c.req.param('versionId') && item.projectId === c.req.param('id') && item.userId === userId,
    )
    if (!row) return null
    if (input.name !== undefined) row.name = input.name || undefined
    if (input.note !== undefined) row.note = input.note || undefined
    if (input.starred !== undefined) row.starred = input.starred
    return structuredClone(row)
  })
  if (!version) return c.json(errorBody('VERSION_NOT_FOUND', '项目版本不存在'), 404)
  return c.json({ version: versionSummary(version) })
})

projects.get('/:id/versions/:versionId', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const project = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  const version = data.projectVersions.find(
    (item) => item.id === c.req.param('versionId') && item.projectId === project.id && item.userId === userId,
  )
  if (!version) return c.json(errorBody('VERSION_NOT_FOUND', '项目版本不存在'), 404)
  const document = siteDocumentFromVersion(version)
  return c.json({
    version: {
      ...version,
      ...versionDocumentSummary(version),
      pages: document.pages,
      homePageId: document.homePageId,
      starred: version.starred ?? false,
      changeSummary: version.changeSummary ?? [],
    },
  })
})

projects.post('/:id/rollback', async (c) => {
  let input: z.infer<typeof rollbackSchema>
  try {
    input = rollbackSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const version = await mutateData<ProjectVersionRecord | null>((data) => {
    const project = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!project) return null
    const target = data.projectVersions.find(
      (item) => item.id === input.versionId && item.projectId === project.id && item.userId === userId,
    )
    if (!target) return null
    const next = Math.max(0, ...data.projectVersions.filter((item) => item.projectId === project.id).map((item) => item.version)) + 1
    const row: ProjectVersionRecord = {
      ...structuredClone(target),
      id: randomUUID(),
      version: next,
      source: 'editor',
      name: `回滚至第 ${target.version} 版`,
      note: undefined,
      starred: false,
      parentVersionId: target.id,
      changeSummary: [`基于第 ${target.version} 版创建回滚版本`],
      instruction: `回滚自第 ${target.version} 版`,
      createdAt: now,
    }
    data.projectVersions.push(row)
    project.updatedAt = now
    project.openedAt = now
    return structuredClone(row)
  })
  if (!version) return c.json(errorBody('VERSION_NOT_FOUND', '项目或目标版本不存在'), 404)
  return c.json({ version: versionSummary(version) }, 201)
})

export default projects

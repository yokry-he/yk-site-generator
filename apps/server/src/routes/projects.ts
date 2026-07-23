import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  mutateData,
  readData,
  type ProjectRecord,
  type ProjectVersionRecord,
  type ProjectVersionSource,
} from '../lib/data-store'
import { removePublishedArtifact } from '../lib/publication-store'
import { errorBody } from '../types'

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  siteType: z.string().trim().min(1).max(40),
  requirement: z.string().trim().max(10_000).default(''),
  html: z.string().optional(),
  source: z.enum(['generate', 'iterate', 'editor', 'import']).default('import'),
  instruction: z.string().max(10_000).optional(),
  model: z.string().max(120).optional(),
})
const updateSchema = createSchema.pick({ title: true, siteType: true, requirement: true }).partial()
const versionSchema = z.object({
  html: z.string().min(20),
  source: z.enum(['generate', 'iterate', 'editor', 'import']),
  instruction: z.string().max(10_000).optional(),
  model: z.string().max(120).optional(),
})
const rollbackSchema = z.object({ versionId: z.string().uuid() })

const projects = new Hono<AuthEnv>()
projects.use('*', authMiddleware)

function publicProject(project: ProjectRecord, latest?: ProjectVersionRecord) {
  return {
    ...project,
    latestVersion: latest
      ? {
          id: latest.id,
          version: latest.version,
          source: latest.source,
          model: latest.model,
          createdAt: latest.createdAt,
          sizeBytes: Buffer.byteLength(latest.html, 'utf8'),
        }
      : null,
  }
}

function versionSummary(version: ProjectVersionRecord) {
  const { html: _html, ...rest } = version
  return { ...rest, sizeBytes: Buffer.byteLength(version.html, 'utf8') }
}

function ensureHtmlSize(html?: string): boolean {
  return html === undefined || Buffer.byteLength(html, 'utf8') <= env.MAX_PROJECT_BYTES
}

projects.get('/', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const rows = data.projects
    .filter((project) => project.userId === userId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
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
  if (!ensureHtmlSize(input.html)) return c.json(errorBody('PROJECT_TOO_LARGE', '单个项目版本超过大小上限'), 413)

  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const result = await mutateData((data) => {
    const project: ProjectRecord = {
      id: randomUUID(),
      userId,
      title: input.title,
      siteType: input.siteType,
      requirement: input.requirement,
      createdAt: now,
      updatedAt: now,
    }
    data.projects.push(project)
    let version: ProjectVersionRecord | undefined
    if (input.html) {
      version = {
        id: randomUUID(),
        projectId: project.id,
        userId,
        version: 1,
        html: input.html,
        source: input.source,
        instruction: input.instruction,
        model: input.model,
        createdAt: now,
      }
      data.projectVersions.push(version)
    }
    return { project, version }
  })
  return c.json({ project: publicProject(result.project, result.version) }, 201)
})

projects.get('/:id', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const project = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  const versions = data.projectVersions
    .filter((item) => item.projectId === project.id && item.userId === userId)
    .sort((a, b) => b.version - a.version)
  return c.json({
    project: publicProject(project, versions[0]),
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
  const project = await mutateData<ProjectRecord | null>((data) => {
    const row = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!row) return null
    if (input.title !== undefined) row.title = input.title
    if (input.siteType !== undefined) row.siteType = input.siteType
    if (input.requirement !== undefined) row.requirement = input.requirement
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  return c.json({ project })
})

projects.delete('/:id', async (c) => {
  const userId = c.get('auth').sub
  const projectId = c.req.param('id')
  const publications = (await readData()).publications.filter(
    (item) => item.projectId === projectId && item.userId === userId,
  )
  // 先删除对外产物;任一存储删除失败则保留数据库元数据,避免留下不可追踪的孤儿对象。
  for (const publication of publications) await removePublishedArtifact(publication.slug)

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
  if (!ensureHtmlSize(input.html)) return c.json(errorBody('PROJECT_TOO_LARGE', '单个项目版本超过大小上限'), 413)
  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const version = await mutateData<ProjectVersionRecord | null>((data) => {
    const project = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!project) return null
    const next =
      Math.max(
        0,
        ...data.projectVersions
          .filter((item) => item.projectId === project.id && item.userId === userId)
          .map((item) => item.version),
      ) + 1
    const row: ProjectVersionRecord = {
      id: randomUUID(),
      projectId: project.id,
      userId,
      version: next,
      html: input.html,
      source: input.source as ProjectVersionSource,
      instruction: input.instruction,
      model: input.model,
      createdAt: now,
    }
    data.projectVersions.push(row)
    project.updatedAt = now
    return structuredClone(row)
  })
  if (!version) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  return c.json({ version: versionSummary(version) }, 201)
})

projects.get('/:id/versions/:versionId', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const project = data.projects.find((item) => item.id === c.req.param('id') && item.userId === userId)
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  const version = data.projectVersions.find(
    (item) =>
      item.id === c.req.param('versionId') &&
      item.projectId === project.id &&
      item.userId === userId,
  )
  if (!version) return c.json(errorBody('VERSION_NOT_FOUND', '项目版本不存在'), 404)
  return c.json({ version })
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
    const next =
      Math.max(0, ...data.projectVersions.filter((item) => item.projectId === project.id).map((item) => item.version)) + 1
    const row: ProjectVersionRecord = {
      ...target,
      id: randomUUID(),
      version: next,
      source: 'editor',
      instruction: `回滚自第 ${target.version} 版`,
      createdAt: now,
    }
    data.projectVersions.push(row)
    project.updatedAt = now
    return structuredClone(row)
  })
  if (!version) return c.json(errorBody('VERSION_NOT_FOUND', '项目或目标版本不存在'), 404)
  return c.json({ version: versionSummary(version) }, 201)
})

export default projects

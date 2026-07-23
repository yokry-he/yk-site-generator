import { randomBytes, randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { env } from '../env'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import { mutateData, readData, type PublicationRecord } from '../lib/data-store'
import { featureFlagMiddleware } from '../lib/feature-flags'
import {
  normalizeSlug,
  publicationUrl,
  removePublishedArtifact,
  writePublishedArtifact,
} from '../lib/publication-store'
import { recordPublishUsage } from '../lib/quota'
import { errorBody } from '../types'

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(48).optional(),
  projectId: z.string().uuid().optional(),
  versionId: z.string().uuid().optional(),
  html: z.string().min(20).optional(),
}).refine((value) => Boolean(value.html || value.versionId), {
  message: '必须提供 html 或 versionId',
})
const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['published', 'offline']).optional(),
})
const republishSchema = z.object({
  versionId: z.string().uuid().optional(),
  html: z.string().min(20).optional(),
}).refine((value) => Boolean(value.html || value.versionId), {
  message: '必须提供 html 或 versionId',
})

const publications = new Hono<AuthEnv>()
publications.use('*', authMiddleware)
publications.use('*', featureFlagMiddleware('site-publishing'))

function publicRecord(record: PublicationRecord) {
  const { html: _html, ...meta } = record
  return {
    ...meta,
    sizeBytes: Buffer.byteLength(record.html, 'utf8'),
    url: publicationUrl(record.slug),
    host: `${record.slug}.${env.PUBLISH_BASE_DOMAIN}`,
  }
}

function uniqueSlug(preferred: string, existing: Set<string>): string {
  const base = normalizeSlug(preferred) || `site-${randomBytes(3).toString('hex')}`
  if (!existing.has(base)) return base
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${base.slice(0, 41)}-${randomBytes(3).toString('hex')}`
    if (!existing.has(candidate)) return candidate
  }
  return `${base.slice(0, 34)}-${Date.now().toString(36)}`
}

publications.get('/', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const rows = data.publications
    .filter((item) => item.userId === userId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .map(publicRecord)
  return c.json({ publications: rows })
})

publications.post('/', async (c) => {
  let input: z.infer<typeof createSchema>
  try {
    input = createSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const result = await mutateData<{ record?: PublicationRecord; error?: string }>((data) => {
    let html = input.html
    let projectId = input.projectId
    let versionId = input.versionId
    if (versionId) {
      const version = data.projectVersions.find((item) => item.id === versionId && item.userId === userId)
      if (!version) return { error: 'VERSION_NOT_FOUND' }
      html = version.html
      projectId = version.projectId
    }
    if (projectId && !data.projects.some((item) => item.id === projectId && item.userId === userId)) {
      return { error: 'PROJECT_NOT_FOUND' }
    }
    if (!html) return { error: 'HTML_REQUIRED' }
    if (Buffer.byteLength(html, 'utf8') > env.MAX_PROJECT_BYTES) return { error: 'PUBLICATION_TOO_LARGE' }

    const now = new Date().toISOString()
    const slug = uniqueSlug(input.slug || input.title, new Set(data.publications.map((item) => item.slug)))
    const record: PublicationRecord = {
      id: randomUUID(),
      userId,
      projectId,
      versionId,
      slug,
      title: input.title,
      html,
      status: 'published',
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    }
    data.publications.push(record)
    return { record: structuredClone(record) }
  })
  if (!result.record) {
    const status = result.error === 'PUBLICATION_TOO_LARGE' ? 413 : 404
    return c.json(
      errorBody(
        result.error ?? 'PUBLISH_FAILED',
        result.error === 'PUBLICATION_TOO_LARGE' ? '发布产物超过大小上限' : '项目或版本不存在',
      ),
      status,
    )
  }

  try {
    await writePublishedArtifact(result.record.slug, result.record.html)
  } catch (err) {
    await mutateData((data) => {
      data.publications = data.publications.filter((item) => item.id !== result.record!.id)
    })
    throw err
  }
  await recordPublishUsage({ userId })
  return c.json({ publication: publicRecord(result.record) }, 201)
})

publications.patch('/:id', async (c) => {
  let input: z.infer<typeof updateSchema>
  try {
    input = updateSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const current = (await readData()).publications.find(
    (item) => item.id === c.req.param('id') && item.userId === userId,
  )
  if (!current) return c.json(errorBody('PUBLICATION_NOT_FOUND', '发布记录不存在'), 404)

  // 对外存储先成功,再提交元数据状态,避免“数据库显示在线但对象不存在”。
  if (input.status === 'offline') await removePublishedArtifact(current.slug)
  if (input.status === 'published') await writePublishedArtifact(current.slug, current.html)

  const updated = await mutateData<PublicationRecord | null>((data) => {
    const row = data.publications.find((item) => item.id === current.id && item.userId === userId)
    if (!row) return null
    if (input.title !== undefined) row.title = input.title
    if (input.status !== undefined) row.status = input.status
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  if (!updated) return c.json(errorBody('PUBLICATION_NOT_FOUND', '发布记录不存在'), 404)
  return c.json({ publication: publicRecord(updated) })
})

publications.post('/:id/republish', async (c) => {
  let input: z.infer<typeof republishSchema>
  try {
    input = republishSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const data = await readData()
  const current = data.publications.find(
    (item) => item.id === c.req.param('id') && item.userId === userId,
  )
  if (!current) return c.json(errorBody('PUBLICATION_NOT_FOUND', '发布记录不存在'), 404)

  let html = input.html
  const versionId = input.versionId
  if (versionId) {
    const version = data.projectVersions.find((item) => item.id === versionId && item.userId === userId)
    if (!version || (current.projectId && version.projectId !== current.projectId)) {
      return c.json(errorBody('VERSION_NOT_FOUND', '项目版本不存在或不属于当前项目'), 404)
    }
    html = version.html
  }
  if (!html) return c.json(errorBody('HTML_REQUIRED', '缺少可发布产物'), 400)
  if (Buffer.byteLength(html, 'utf8') > env.MAX_PROJECT_BYTES) {
    return c.json(errorBody('PUBLICATION_TOO_LARGE', '发布产物超过大小上限'), 413)
  }

  // 先写对象存储;失败时数据库仍指向上一版,线上不会进入半提交状态。
  await writePublishedArtifact(current.slug, html)
  const now = new Date().toISOString()
  const updated = await mutateData<PublicationRecord | null>((draft) => {
    const row = draft.publications.find((item) => item.id === current.id && item.userId === userId)
    if (!row) return null
    row.html = html
    row.versionId = versionId ?? row.versionId
    row.status = 'published'
    row.updatedAt = now
    row.publishedAt = now
    return structuredClone(row)
  })
  if (!updated) {
    // 极小概率下记录在对象写入后被并发删除;移除对象避免孤儿。
    await removePublishedArtifact(current.slug)
    return c.json(errorBody('PUBLICATION_NOT_FOUND', '发布记录已被删除'), 404)
  }
  await recordPublishUsage({ userId })
  return c.json({ publication: publicRecord(updated) })
})

publications.delete('/:id', async (c) => {
  const userId = c.get('auth').sub
  const current = (await readData()).publications.find(
    (item) => item.id === c.req.param('id') && item.userId === userId,
  )
  if (!current) return c.json(errorBody('PUBLICATION_NOT_FOUND', '发布记录不存在'), 404)

  // 先清理对外对象,再删除可追踪的元数据。
  await removePublishedArtifact(current.slug)
  const removed = await mutateData((data) => {
    const before = data.publications.length
    data.publications = data.publications.filter(
      (item) => item.id !== current.id || item.userId !== userId,
    )
    return data.publications.length < before
  })
  if (!removed) return c.json(errorBody('PUBLICATION_NOT_FOUND', '发布记录已被删除'), 404)
  return c.json({ ok: true })
})

export default publications

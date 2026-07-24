import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import { mutateData, readData, type FeedbackRecord } from '../lib/data-store'
import { featureFlagMiddleware } from '../lib/feature-flags'
import { errorBody } from '../types'

const categorySchema = z.enum([
  'layout',
  'copy',
  'colors',
  'images',
  'mobile',
  'interaction',
  'missing',
  'error',
  'other',
])

const feedbackSchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
  sentiment: z.enum(['positive', 'negative']),
  categories: z.array(categorySchema).max(5).default([]),
  message: z.string().trim().max(1_000).optional(),
  promptVersion: z.string().trim().max(64).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
})

const querySchema = z.object({
  projectId: z.string().uuid(),
  versionId: z.string().uuid(),
})

const feedback = new Hono<AuthEnv>()
feedback.use('*', authMiddleware)
feedback.use('*', featureFlagMiddleware('quality-feedback'))

feedback.get('/mine', async (c) => {
  let query: z.infer<typeof querySchema>
  try {
    query = querySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '项目或版本参数无效'), 400)
  }
  const userId = c.get('auth').sub
  const data = await readData()
  const row = data.feedback.find(
    (item) => item.userId === userId && item.projectId === query.projectId && item.versionId === query.versionId,
  )
  return c.json({ feedback: row ?? null })
})

feedback.post('/', async (c) => {
  let input: z.infer<typeof feedbackSchema>
  try {
    input = feedbackSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  const userId = c.get('auth').sub
  const data = await readData()
  const project = data.projects.find((item) => item.id === input.projectId && item.userId === userId)
  if (!project) return c.json(errorBody('PROJECT_NOT_FOUND', '项目不存在'), 404)
  const version = data.projectVersions.find(
    (item) => item.id === input.versionId && item.projectId === project.id && item.userId === userId,
  )
  if (!version) return c.json(errorBody('VERSION_NOT_FOUND', '项目版本不存在'), 404)

  const now = new Date().toISOString()
  const result = await mutateData<{ feedback: FeedbackRecord; created: boolean }>((draft) => {
    const existing = draft.feedback.find(
      (item) => item.userId === userId && item.projectId === project.id && item.versionId === version.id,
    )
    if (existing) {
      existing.sentiment = input.sentiment
      existing.categories = [...new Set(input.categories)]
      existing.message = input.message || undefined
      existing.promptVersion = input.promptVersion || undefined
      existing.metadata = input.metadata
      existing.siteType = project.siteType
      existing.model = version.model
      existing.status = 'open'
      existing.updatedAt = now
      return { feedback: structuredClone(existing), created: false }
    }
    const row: FeedbackRecord = {
      id: randomUUID(),
      userId,
      projectId: project.id,
      versionId: version.id,
      sentiment: input.sentiment,
      categories: [...new Set(input.categories)],
      message: input.message || undefined,
      siteType: project.siteType,
      model: version.model,
      promptVersion: input.promptVersion || undefined,
      metadata: input.metadata,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    }
    draft.feedback.push(row)
    return { feedback: structuredClone(row), created: true }
  })
  return c.json(result, result.created ? 201 : 200)
})

export default feedback

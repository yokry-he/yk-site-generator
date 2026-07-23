import { Hono } from 'hono'
import { z } from 'zod'
import { createShare, deleteShare, getShare, shareSummary } from '../lib/share-store'
import { env } from '../env'
import { errorBody } from '../types'

const createSchema = z.object({
  html: z.string().min(20),
  title: z.string().max(120).optional(),
  siteType: z.string().max(40).optional(),
})

const shares = new Hono()

shares.post('/', async (c) => {
  const contentLength = Number(c.req.header('content-length') ?? 0)
  if (contentLength > env.MAX_SHARE_BYTES + 32 * 1024) {
    return c.json(errorBody('SHARE_TOO_LARGE', `分享产物不能超过 ${Math.floor(env.MAX_SHARE_BYTES / 1024 / 1024)}MB`), 413)
  }

  let input: z.infer<typeof createSchema>
  try {
    input = createSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues.map((issue) => issue.message).join(';') : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }

  try {
    const result = await createShare(input)
    const base = env.PUBLIC_BASE_URL.replace(/\/$/, '')
    const path = `/s/${result.share.id}`
    return c.json(
      {
        share: {
          ...result.share,
          path,
          url: base ? `${base}${path}` : path,
        },
        deleteToken: result.deleteToken,
      },
      201,
    )
  } catch (err) {
    if (err instanceof Error && err.message === 'SHARE_TOO_LARGE') {
      return c.json(errorBody('SHARE_TOO_LARGE', `分享产物不能超过 ${Math.floor(env.MAX_SHARE_BYTES / 1024 / 1024)}MB`), 413)
    }
    throw err
  }
})

shares.get('/:id', async (c) => {
  const record = await getShare(c.req.param('id'))
  if (!record) return c.json(errorBody('SHARE_NOT_FOUND', '分享不存在或已过期'), 404)
  return c.json({ share: shareSummary(record) })
})

shares.delete('/:id', async (c) => {
  const token = c.req.header('x-share-delete-token') ?? ''
  if (!token) return c.json(errorBody('SHARE_TOKEN_REQUIRED', '缺少删除令牌'), 401)
  const deleted = await deleteShare(c.req.param('id'), token)
  if (!deleted) return c.json(errorBody('SHARE_DELETE_DENIED', '分享不存在、已过期或删除令牌无效'), 403)
  return c.json({ ok: true })
})

export default shares

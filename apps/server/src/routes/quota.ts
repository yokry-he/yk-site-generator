import { Hono } from 'hono'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import { readData } from '../lib/data-store'
import { getQuotaSummary } from '../lib/quota'

const quota = new Hono<AuthEnv>()
quota.use('*', authMiddleware)

quota.get('/', async (c) => {
  const summary = await getQuotaSummary(c.get('auth').sub)
  return c.json({ quota: summary })
})

quota.get('/usage', async (c) => {
  const userId = c.get('auth').sub
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? 50) || 50))
  const data = await readData()
  const usage = data.usage
    .filter((item) => item.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
  return c.json({ usage, quota: await getQuotaSummary(userId) })
})

export default quota

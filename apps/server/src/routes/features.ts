import { Hono } from 'hono'
import { authenticateBearerHeader } from '../lib/auth'
import { readData } from '../lib/data-store'
import { FEATURE_FLAG_DEFINITIONS, evaluateFeatureFlag } from '../lib/feature-flags'

const features = new Hono()

features.get('/', async (c) => {
  const data = await readData()
  const claims = await authenticateBearerHeader(c.req.header('authorization'))
  const user = claims ? data.users.find((item) => item.id === claims.sub) : undefined
  const anonymousId = c.req.header('x-anonymous-id')
    || c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')
    || c.req.header('user-agent')
    || 'anonymous'
  const context = {
    userId: user?.id,
    email: user?.email,
    role: user?.role ?? 'user' as const,
    anonymousId,
  }
  return c.json({
    features: Object.fromEntries(
      FEATURE_FLAG_DEFINITIONS.map((definition) => [
        definition.key,
        evaluateFeatureFlag(data, definition.key, context),
      ]),
    ),
  })
})

export default features

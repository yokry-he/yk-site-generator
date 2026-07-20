import { Hono } from 'hono'

const health = new Hono()

health.get('/', (c) =>
  c.json({
    ok: true,
    service: 'yk-site-generator',
    time: new Date().toISOString(),
  }),
)

export default health

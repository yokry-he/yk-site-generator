import { serve } from '@hono/node-server'
import { createApp } from './app'
import { env } from './env'

const app = createApp()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[server] yk-site-generator 已启动: http://localhost:${info.port} (env: ${env.NODE_ENV})`)
})

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { env } from './env'
import { errorBody } from './types'
import health from './routes/health'
import generate from './routes/generate'
import providers from './routes/providers'

export function createApp() {
  const app = new Hono()

  // 结构化请求日志
  app.use('*', logger())

  // CORS:仅允许配置的前端来源
  app.use(
    '/api/*',
    cors({
      origin: env.corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  // 路由
  app.route('/api/health', health)
  app.route('/api/generate', generate)
  app.route('/api/providers', providers)

  // 404:统一错误格式
  app.notFound((c) =>
    c.json(errorBody('NOT_FOUND', `路径不存在:${c.req.method} ${c.req.path}`), 404),
  )

  // 全局错误处理:统一错误格式
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json(errorBody(`HTTP_${err.status}`, err.message), err.status)
    }
    console.error('[server] 未捕获异常:', err)
    return c.json(errorBody('INTERNAL_ERROR', '服务器内部错误'), 500)
  })

  return app
}

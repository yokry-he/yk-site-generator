import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'
import { env } from './env'
import { requestTelemetryMiddleware } from './lib/observability'
import { errorBody } from './types'
import health from './routes/health'
import generate from './routes/generate'
import providers from './routes/providers'
import shares from './routes/shares'
import sharePage from './routes/share-page'
import auth from './routes/auth'
import projects from './routes/projects'
import quota from './routes/quota'
import publications from './routes/publications'
import brandKits from './routes/brand-kits'
import templates from './routes/templates'
import onboarding from './routes/onboarding'
import feedback from './routes/feedback'
import adminStorageHealth from './routes/admin-storage-health'
import admin from './routes/admin'
import sitePage, { serveSiteFromHost } from './routes/site-page'

export function createApp() {
  const app = new Hono()

  // 稳定 request id + 慢请求/服务端错误事件。
  app.use('*', requestTelemetryMiddleware)
  // 结构化请求日志
  app.use('*', logger())

  // CORS:仅允许配置的前端来源
  app.use(
    '/api/*',
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Share-Delete-Token', 'X-Request-ID'],
      exposeHeaders: ['Content-Length', 'X-Request-ID'],
      maxAge: 600,
    }),
  )

  // 路由
  app.route('/api/health', health)
  app.route('/api/generate', generate)
  app.route('/api/providers', providers)
  app.route('/api/shares', shares)
  app.route('/api/auth', auth)
  app.route('/api/projects', projects)
  app.route('/api/quota', quota)
  app.route('/api/publications', publications)
  app.route('/api/brand-kits', brandKits)
  app.route('/api/templates', templates)
  app.route('/api/onboarding', onboarding)
  app.route('/api/feedback', feedback)
  // 精确路由先于通用管理路由,向控制台返回当前真实存储状态。
  app.route('/api/admin/health', adminStorageHealth)
  app.route('/api/admin', admin)
  app.route('/s', sharePage)
  app.route('/site', sitePage)

  // 泛域名站点:在平台 API/固定路径之后处理任意 GET,避免抢占正常路由。
  app.get('*', async (c, next) => {
    const response = await serveSiteFromHost(c)
    if (response) return response
    await next()
  })

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

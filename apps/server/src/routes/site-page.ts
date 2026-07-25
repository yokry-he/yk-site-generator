import { Hono, type Context } from 'hono'
import {
  normalizeSiteProject,
  siteProjectPageForPath,
} from 'shared'
import { readData } from '../lib/data-store'

const sites = new Hono()

function offlinePage(title = '站点暂不可用', message = '该站点不存在、已下线或正在重新发布。'): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · SiteForge</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font-family:system-ui}.card{padding:32px;border:1px solid #ffffff1a;border-radius:20px;background:#ffffff0d;text-align:center}.card p{color:#a1a1aa}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p></main></body></html>`
}

function applySiteSecurityHeaders(c: Context): void {
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  c.header(
    'Content-Security-Policy',
    "sandbox allow-scripts allow-forms allow-popups; default-src 'self' data: blob: https:; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src data: https:; connect-src https:; frame-src https:; object-src 'none'; base-uri 'none'",
  )
}

async function renderPublishedSite(c: Context, slug: string, requestPath = '/') {
  const data = await readData()
  const record = data.publications.find(
    (item) => item.slug === slug && item.status === 'published',
  )
  applySiteSecurityHeaders(c)
  if (!record) {
    c.header('Cache-Control', 'private, no-store')
    return c.html(offlinePage(), 404)
  }

  const document = normalizeSiteProject(record, '首页')
  const page = siteProjectPageForPath(document, requestPath)
  if (!page) {
    c.header('Cache-Control', 'private, no-store')
    return c.html(offlinePage('页面不存在', '当前站点中没有这个页面，请返回首页继续浏览。'), 404)
  }

  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  c.header('ETag', `W/"${record.id}-${page.id}-${Date.parse(record.updatedAt)}"`)
  c.header('X-SiteForge-Page', page.path)
  return c.html(page.html)
}

/** `/site/:slug` 兼容路径，用于本地开发与无泛域名环境。 */
sites.get('/:slug', (c) => renderPublishedSite(c, c.req.param('slug'), '/'))
sites.get('/:slug/*', (c) => renderPublishedSite(c, c.req.param('slug'), `/${c.req.param('*') ?? ''}`))

/**
 * 从 Host 提取一级站点子域名。只接受 `<slug>.<baseDomain>`：
 * - 主域名不会命中
 * - 多级嵌套子域名不会命中
 * - 自动剥离端口并统一为小写
 */
export function siteSlugFromHost(host: string | undefined, baseDomain = 'siteforge.local'): string | null {
  if (!host) return null
  const normalizedHost = host.trim().toLowerCase().replace(/:\d+$/, '')
  const normalizedBase = baseDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, '')
  const suffix = `.${normalizedBase}`
  if (!normalizedHost.endsWith(suffix)) return null
  const slug = normalizedHost.slice(0, -suffix.length)
  if (!slug || slug.includes('.')) return null
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) ? slug : null
}

/** 平台通配 GET 的末级处理器：命中站点子域名时返回对应页面，否则交给 404。 */
export async function serveSiteFromHost(c: Context) {
  const baseDomain = process.env.SITE_BASE_DOMAIN?.trim() || 'siteforge.local'
  const slug = siteSlugFromHost(c.req.header('host'), baseDomain)
  if (!slug) return null
  return renderPublishedSite(c, slug, c.req.path || '/')
}

export default sites

import { Hono } from 'hono'
import { readData } from '../lib/data-store'

const sites = new Hono()

function offlinePage(): string {
  return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>站点暂不可用 · SiteForge</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font-family:system-ui}.card{padding:32px;border:1px solid #ffffff1a;border-radius:20px;background:#ffffff0d;text-align:center}.card p{color:#a1a1aa}</style></head><body><main class="card"><h1>站点暂不可用</h1><p>该站点不存在、已下线或正在重新发布。</p></main></body></html>'
}

sites.get('/:slug', async (c) => {
  const data = await readData()
  const record = data.publications.find(
    (item) => item.slug === c.req.param('slug') && item.status === 'published',
  )
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  c.header(
    'Content-Security-Policy',
    "sandbox allow-scripts allow-forms allow-popups; default-src 'self' data: blob: https:; script-src 'unsafe-inline' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src data: https:; connect-src https:; frame-src https:; object-src 'none'; base-uri 'none'",
  )
  if (!record) {
    c.header('Cache-Control', 'private, no-store')
    return c.html(offlinePage(), 404)
  }
  c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  c.header('ETag', `W/"${record.id}-${Date.parse(record.updatedAt)}"`)
  return c.html(record.html)
})

export default sites

import { Hono } from 'hono'
import { getShare } from '../lib/share-store'

const pages = new Hono()

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function notFoundPage(): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>分享已失效 · SiteForge</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fafafa;font-family:ui-sans-serif,system-ui}.card{max-width:30rem;margin:2rem;padding:2rem;border:1px solid #ffffff1a;border-radius:1.25rem;background:#ffffff0d;text-align:center}.muted{color:#a1a1aa;line-height:1.7}a{color:#a78bfa}</style></head><body><main class="card"><h1>分享不存在或已过期</h1><p class="muted">临时分享链接最多保留 7 天。你可以联系创建者重新生成链接。</p><a href="/">返回 SiteForge</a></main></body></html>`
}

pages.get('/:id', async (c) => {
  const record = await getShare(c.req.param('id'))
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'no-referrer')
  c.header('X-Frame-Options', 'DENY')
  c.header('Cache-Control', 'private, no-store, max-age=0')
  c.header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; img-src data:; frame-src 'self'; base-uri 'none'; form-action 'none'",
  )
  if (!record) return c.html(notFoundPage(), 404)

  const expires = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Taipei',
  }).format(new Date(record.expiresAt))
  const title = escapeHtml(record.title)
  const srcdoc = escapeHtml(record.html)
  const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · SiteForge 临时分享</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;background:#09090b;color:#fafafa;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{display:flex;flex-direction:column}.bar{height:44px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 16px;border-bottom:1px solid #ffffff14;background:#111113;color:#d4d4d8;font-size:12px}.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:#fff}.logo{display:grid;place-items:center;width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#8b5cf6,#ec4899)}.meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1a1aa}.frame{min-height:0;flex:1;width:100%;border:0;background:#fff}@media(max-width:640px){.bar{height:auto;min-height:44px;padding:8px 12px}.meta{font-size:10px}}
</style>
</head>
<body>
<header class="bar"><div class="brand"><span class="logo">✦</span><span>SiteForge 临时分享</span></div><div class="meta" title="${title}">${title} · 到期时间 ${escapeHtml(expires)}</div></header>
<iframe class="frame" title="${title}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${srcdoc}"></iframe>
</body>
</html>`
  return c.html(page)
})

export default pages

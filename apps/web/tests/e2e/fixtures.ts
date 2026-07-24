import type { Page, Route } from '@playwright/test'
import { SITEFORGE_TEMPLATES } from 'shared'

export const user = {
  id: '00000000-0000-4000-8000-000000000101',
  email: 'browser@example.com',
  role: 'admin',
  status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z',
}

export const versions = [
  {
    id: '00000000-0000-4000-8000-000000000201', projectId: '00000000-0000-4000-8000-000000000301', userId: user.id,
    version: 2, source: 'editor', name: '移动端优化', note: '优化首屏与 CTA', starred: true, parentVersionId: '00000000-0000-4000-8000-000000000202',
    changeSummary: ['移动 Hero 区块', '调整按钮文案'], createdAt: '2026-07-23T10:00:00.000Z', sizeBytes: 1700,
  },
  {
    id: '00000000-0000-4000-8000-000000000202', projectId: '00000000-0000-4000-8000-000000000301', userId: user.id,
    version: 1, source: 'generate', name: '初始生成', note: '第一版内容', starred: false, changeSummary: ['创建初始页面版本'], createdAt: '2026-07-22T10:00:00.000Z', sizeBytes: 1400,
  },
] as const

const pageHtml = (title: string, mobile = false) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><meta name="description" content="用于浏览器交互测试的稳定页面"><meta property="og:title" content="${title}"><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui;background:#fff;color:#18181b}nav{display:flex;justify-content:space-between;padding:18px 5vw;border-bottom:1px solid #eee}main{max-width:1100px;margin:auto;padding:70px 28px}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:48px;align-items:center}.card{padding:28px;border:1px solid #ddd;border-radius:20px}.actions{display:flex;gap:12px}button,a{min-height:44px;padding:12px 18px}.features{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:54px}@media(max-width:640px){.hero,.features{grid-template-columns:1fr}.hero{gap:24px}h1{font-size:40px}}</style></head><body><nav><strong>Browser Studio</strong><a href="#contact">联系</a></nav><main><section class="hero" data-sf-section-label="Hero"><div><h1>${title}</h1><p>让复杂工作流变得清晰、可控，并能在手机端顺畅完成。</p><div class="actions"><button>免费开始</button><a href="#features">查看能力</a></div></div><div class="card"><img alt="产品界面" loading="lazy" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzhCNUNGNiIvPjwvc3ZnPg==" style="width:100%;object-fit:cover;border-radius:16px"></div></section><section id="features" class="features" data-sf-section-label="能力"><article class="card"><h2>结构编辑</h2><p>拖拽、复制和响应式设置。</p></article><article class="card"><h2>质量检查</h2><p>静态与真实渲染双重检查。</p></article><article class="card"><h2>版本管理</h2><p>保存不可变版本并进行对比。</p></article></section><section id="contact"><h2>联系团队</h2><label>邮箱<input aria-label="邮箱" type="email"></label></section></main></body></html>`

export const versionHtml: Record<string, string> = {
  [versions[0].id]: pageHtml('更成熟的网站工作台', true),
  [versions[1].id]: pageHtml('一句话生成完整网站'),
}

export const project = {
  id: versions[0].projectId,
  userId: user.id,
  title: 'Browser Studio',
  siteType: 'saas',
  requirement: '一个现代 SaaS 产品主页',
  templateId: 'tpl-aurora-saas',
  status: 'active',
  starred: true,
  brandKitId: '00000000-0000-4000-8000-000000000401',
  createdAt: '2026-07-22T09:00:00.000Z',
  updatedAt: '2026-07-23T10:00:00.000Z',
  openedAt: '2026-07-23T10:30:00.000Z',
  latestVersion: versions[0],
}

export const brandKit = {
  id: project.brandKitId,
  userId: user.id,
  name: 'Browser Brand', description: '测试品牌', isDefault: true,
  primary: '#7c3aed', secondary: '#22d3ee', accent: '#f472b6', background: '#ffffff', surface: '#f8fafc', text: '#18181b', muted: '#64748b',
  headingFont: 'modern-sans', bodyFont: 'modern-sans', radius: 16, buttonStyle: 'solid', shadow: 'soft', headingScale: 1, spacingDensity: 'comfortable', contentWidth: 1180, navigationStyle: 'pill', inputStyle: 'soft', imageStyle: 'rounded', iconStyle: 'outline',
  createdAt: '2026-07-20T00:00:00.000Z', updatedAt: '2026-07-23T00:00:00.000Z',
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

export async function mockPublicApi(page: Page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/features') return json(route, { features: { 'official-templates': true, 'brand-kits': true, 'visual-editor': true, 'onboarding-guide': false, 'quality-feedback': true, 'site-publishing': true } })
    if (url.pathname === '/api/auth/refresh') return json(route, { error: { code: 'UNAUTHORIZED' } }, 401)
    if (url.pathname === '/api/templates') return json(route, { templates: SITEFORGE_TEMPLATES, filters: { categories: [...new Set(SITEFORGE_TEMPLATES.map((item) => item.category))], industries: [...new Set(SITEFORGE_TEMPLATES.map((item) => item.industry))], styles: [...new Set(SITEFORGE_TEMPLATES.flatMap((item) => item.styleTags))] } })
    return json(route, {})
  })
}

export async function mockAuthenticatedApi(page: Page) {
  await page.addInitScript(({ token, expires }) => { localStorage.setItem('siteforge:access-token', token); localStorage.setItem('siteforge:access-token-expires', expires) }, { token: 'browser-e2e-token', expires: '2099-01-01T00:00:00.000Z' })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (url.pathname === '/api/features') return json(route, { features: { 'official-templates': true, 'brand-kits': true, 'visual-editor': true, 'onboarding-guide': false, 'quality-feedback': true, 'site-publishing': true } })
    if (url.pathname === '/api/auth/me') return json(route, { user })
    if (url.pathname === '/api/auth/refresh') return json(route, { user, accessToken: 'browser-e2e-token', accessTokenExpiresAt: '2099-01-01T00:00:00.000Z' })
    if (url.pathname === '/api/projects') return json(route, { projects: [project] })
    if (url.pathname === `/api/projects/${project.id}`) return json(route, { project, versions })
    const versionMatch = url.pathname.match(new RegExp(`/api/projects/${project.id}/versions/([^/]+)$`))
    if (versionMatch && method === 'GET') {
      const summary = versions.find((item) => item.id === versionMatch[1]) ?? versions[0]
      return json(route, { version: { ...summary, html: versionHtml[summary.id] } })
    }
    if (url.pathname === `/api/projects/${project.id}/versions` && method === 'POST') return json(route, { version: { ...versions[0], id: '00000000-0000-4000-8000-000000000299', version: 3, name: '浏览器保存版本', createdAt: new Date().toISOString() } }, 201)
    if (url.pathname === '/api/publications') return json(route, { publications: [] })
    if (url.pathname === '/api/brand-kits') return json(route, { brandKits: [brandKit] })
    if (url.pathname === '/api/brand-assets') return json(route, { assets: [] })
    if (url.pathname === '/api/templates') return json(route, { templates: SITEFORGE_TEMPLATES, filters: { categories: [], industries: [], styles: [] } })
    if (url.pathname === '/api/templates/favorites') return json(route, { favoriteTemplateIds: ['tpl-aurora-saas'] })
    if (/\/api\/templates\/[^/]+\/favorite$/.test(url.pathname)) return json(route, { favorite: method !== 'DELETE' })
    if (/\/api\/templates\/[^/]+\/use$/.test(url.pathname)) return json(route, { project }, 201)
    if (url.pathname === '/api/onboarding') return json(route, { progress: null, checklist: {} })
    if (url.pathname.startsWith('/api/feedback')) return json(route, { feedback: null })
    return json(route, {})
  })
}

export type QualitySeverity = 'error' | 'warning' | 'suggestion'
export type QualityCategory = 'content' | 'images' | 'links' | 'responsive' | 'accessibility' | 'seo'

export interface QualityIssue {
  id: string
  rule: string
  category: QualityCategory
  severity: QualitySeverity
  title: string
  description: string
  selector?: string
  elementLabel?: string
  fixable: boolean
}

export interface QualityReport {
  score: number
  issues: QualityIssue[]
  counts: Record<QualitySeverity, number>
  categories: Record<QualityCategory, number>
}

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function serialize(document: Document, original: string): string {
  const doctype = /^\s*<!doctype[^>]*>/i.exec(original)?.[0] ?? '<!DOCTYPE html>'
  return `${doctype}\n${document.documentElement.outerHTML}`
}

function selectorFor(element: Element, index: number): string {
  if (element.id) return `#${CSS.escape(element.id)}`
  const editorId = (element as HTMLElement).dataset.sfEditorId
  if (editorId) return `[data-sf-editor-id="${CSS.escape(editorId)}"]`
  const sectionId = (element as HTMLElement).dataset.sfSectionId
  if (sectionId) return `[data-sf-section-id="${CSS.escape(sectionId)}"]`
  return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`
}

function textLabel(element: Element): string {
  const text = element.getAttribute('alt') || element.getAttribute('aria-label') || element.textContent || element.tagName
  return text.trim().replace(/\s+/g, ' ').slice(0, 60)
}

function issue(input: Omit<QualityIssue, 'id'>): QualityIssue {
  return { ...input, id: `${input.rule}:${input.selector ?? input.title}` }
}

function hasLabel(input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, document: Document): boolean {
  if (input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')) return true
  if (input.id && document.querySelector(`label[for="${CSS.escape(input.id)}"]`)) return true
  return Boolean(input.closest('label'))
}

function isPlaceholder(text: string): boolean {
  return /(lorem ipsum|示例内容|占位|placeholder|your (?:company|brand|name)|品牌名称|点击这里|待补充|xxx)/i.test(text)
}

export function analyzeSiteQuality(html: string): QualityReport {
  const document = parse(html)
  const issues: QualityIssue[] = []
  const title = document.querySelector('title')?.textContent?.trim() ?? ''
  if (!title) issues.push(issue({ rule: 'seo-title', category: 'seo', severity: 'error', title: '缺少页面标题', description: '搜索结果和浏览器标签无法准确描述页面。', selector: 'head', elementLabel: '<title>', fixable: true }))
  else if (title.length < 8 || title.length > 60) issues.push(issue({ rule: 'seo-title-length', category: 'seo', severity: 'warning', title: '页面标题长度不理想', description: '建议控制在 8–60 个字符，并包含品牌或核心主题。', selector: 'head', elementLabel: title, fixable: false }))

  const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() ?? ''
  if (!description) issues.push(issue({ rule: 'seo-description', category: 'seo', severity: 'warning', title: '缺少页面描述', description: '搜索引擎和分享预览缺少简短摘要。', selector: 'head', elementLabel: 'meta description', fixable: true }))
  if (!document.documentElement.lang) issues.push(issue({ rule: 'document-language', category: 'accessibility', severity: 'warning', title: '未声明页面语言', description: '屏幕阅读器无法选择正确的发音规则。', selector: 'html', elementLabel: '<html>', fixable: true }))
  if (!document.querySelector('meta[name="viewport"]')) issues.push(issue({ rule: 'viewport', category: 'responsive', severity: 'error', title: '缺少移动端 viewport', description: '页面在手机上可能被缩小为桌面宽度。', selector: 'head', elementLabel: 'viewport', fixable: true }))

  const h1s = [...document.querySelectorAll('h1')]
  if (!h1s.length) issues.push(issue({ rule: 'missing-h1', category: 'content', severity: 'error', title: '缺少主标题 H1', description: '页面需要一个明确的主标题来表达核心主题。', selector: 'body', elementLabel: 'H1', fixable: false }))
  if (h1s.length > 1) issues.push(issue({ rule: 'multiple-h1', category: 'content', severity: 'warning', title: '存在多个 H1', description: `当前页面发现 ${h1s.length} 个 H1，建议保留一个页面主标题。`, selector: 'h1', elementLabel: `${h1s.length} 个 H1`, fixable: false }))

  const headings = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')]
  headings.forEach((heading, index) => {
    if (!heading.textContent?.trim()) issues.push(issue({ rule: 'empty-heading', category: 'content', severity: 'error', title: '标题内容为空', description: '空标题会破坏页面结构和辅助技术导航。', selector: selectorFor(heading, index), elementLabel: heading.tagName, fixable: false }))
    if (index > 0) {
      const previous = Number(headings[index - 1].tagName.slice(1))
      const current = Number(heading.tagName.slice(1))
      if (current - previous > 1) issues.push(issue({ rule: 'heading-skip', category: 'accessibility', severity: 'warning', title: '标题层级跳跃', description: `${headings[index - 1].tagName} 后直接使用 ${heading.tagName}，建议保持连续层级。`, selector: selectorFor(heading, index), elementLabel: textLabel(heading), fixable: false }))
    }
  })

  const textElements = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,p,li,button,a')]
  textElements.forEach((element, index) => {
    const text = element.textContent?.trim() ?? ''
    if (text && isPlaceholder(text)) issues.push(issue({ rule: 'placeholder-copy', category: 'content', severity: 'warning', title: '仍包含占位文案', description: '发布前请替换示例、占位或测试内容。', selector: selectorFor(element, index), elementLabel: textLabel(element), fixable: false }))
  })

  ;[...document.querySelectorAll<HTMLImageElement>('img')].forEach((image, index) => {
    const selector = selectorFor(image, index)
    if (!image.hasAttribute('alt')) issues.push(issue({ rule: 'image-alt', category: 'images', severity: 'error', title: '图片缺少替代文字', description: '有意义的图片需要 Alt；纯装饰图片应使用空 Alt。', selector, elementLabel: image.src.split('/').at(-1) || '图片', fixable: true }))
    if (!image.getAttribute('src')?.trim()) issues.push(issue({ rule: 'image-src', category: 'images', severity: 'error', title: '图片地址为空', description: '该图片无法显示，请替换或删除。', selector, elementLabel: image.alt || '图片', fixable: false }))
    if (/^http:\/\//i.test(image.src)) issues.push(issue({ rule: 'image-http', category: 'images', severity: 'warning', title: '图片使用非 HTTPS 地址', description: 'HTTPS 页面可能阻止加载不安全图片。', selector, elementLabel: image.alt || image.src, fixable: true }))
    if (!image.loading && index > 0) issues.push(issue({ rule: 'image-loading', category: 'responsive', severity: 'suggestion', title: '非首屏图片未启用懒加载', description: '为非首屏图片增加 loading="lazy" 可以改善加载体验。', selector, elementLabel: image.alt || '图片', fixable: true }))
  })

  ;[...document.querySelectorAll<HTMLAnchorElement>('a')].forEach((link, index) => {
    const href = link.getAttribute('href')?.trim() ?? ''
    const selector = selectorFor(link, index)
    if (!href || href === '#') issues.push(issue({ rule: 'empty-link', category: 'links', severity: 'warning', title: '链接尚未配置', description: '空链接或 # 链接不会将用户带到有效目标。', selector, elementLabel: textLabel(link), fixable: false }))
    if (href.startsWith('#') && href.length > 1 && !document.getElementById(href.slice(1))) issues.push(issue({ rule: 'broken-anchor', category: 'links', severity: 'error', title: '页面锚点不存在', description: `未找到目标 ${href}。`, selector, elementLabel: textLabel(link), fixable: false }))
    if (link.target === '_blank' && !/noopener/.test(link.rel)) issues.push(issue({ rule: 'external-rel', category: 'links', severity: 'warning', title: '新窗口链接缺少安全属性', description: 'target="_blank" 应同时设置 rel="noopener noreferrer"。', selector, elementLabel: textLabel(link), fixable: true }))
    if (!textLabel(link) || /^(更多|点击|这里|link)$/i.test(textLabel(link))) issues.push(issue({ rule: 'link-name', category: 'accessibility', severity: 'suggestion', title: '链接名称不够明确', description: '链接文案应描述目的，例如“查看案例”而不是“点击这里”。', selector, elementLabel: textLabel(link) || '空链接', fixable: false }))
  })

  ;[...document.querySelectorAll<HTMLButtonElement>('button')].forEach((button, index) => {
    if (!textLabel(button)) issues.push(issue({ rule: 'button-name', category: 'accessibility', severity: 'error', title: '按钮缺少可读名称', description: '图标按钮需要 aria-label，普通按钮需要可见文字。', selector: selectorFor(button, index), elementLabel: '按钮', fixable: false }))
  })

  ;[...document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea')].forEach((input, index) => {
    if (input.type === 'hidden') return
    if (!hasLabel(input, document)) issues.push(issue({ rule: 'form-label', category: 'accessibility', severity: 'error', title: '表单字段缺少标签', description: '字段需要可见 label、aria-label 或 aria-labelledby。', selector: selectorFor(input, index), elementLabel: input.name || input.placeholder || input.tagName, fixable: true }))
  })

  ;[...document.querySelectorAll<HTMLElement>('[style]')].forEach((element, index) => {
    const width = element.style.width
    if (/^\d{4,}px$/.test(width)) issues.push(issue({ rule: 'fixed-width', category: 'responsive', severity: 'warning', title: '固定宽度可能超出手机屏幕', description: `元素宽度为 ${width}，建议使用 max-width:100% 或响应式布局。`, selector: selectorFor(element, index), elementLabel: textLabel(element), fixable: true }))
    const fontSize = Number.parseFloat(element.style.fontSize)
    if (element.style.fontSize.endsWith('px') && fontSize > 0 && fontSize < 12) issues.push(issue({ rule: 'small-text', category: 'responsive', severity: 'warning', title: '文字尺寸过小', description: '低于 12px 的文字在移动设备上难以阅读。', selector: selectorFor(element, index), elementLabel: textLabel(element), fixable: true }))
  })

  const main = document.querySelector('main')
  if (!main) issues.push(issue({ rule: 'main-landmark', category: 'accessibility', severity: 'suggestion', title: '缺少 main 主内容区域', description: '使用 main 可以帮助辅助技术快速定位页面主体。', selector: 'body', elementLabel: '<main>', fixable: false }))
  if (!document.querySelector('link[rel="icon"]')) issues.push(issue({ rule: 'favicon', category: 'seo', severity: 'suggestion', title: '缺少网站图标', description: 'Favicon 能提升浏览器标签和收藏夹中的品牌识别。', selector: 'head', elementLabel: 'favicon', fixable: false }))
  if (!document.querySelector('meta[property="og:title"]')) issues.push(issue({ rule: 'og-title', category: 'seo', severity: 'suggestion', title: '缺少社交分享标题', description: '添加 Open Graph 标题可改善链接分享预览。', selector: 'head', elementLabel: 'og:title', fixable: true }))

  const counts = { error: 0, warning: 0, suggestion: 0 }
  const categories: Record<QualityCategory, number> = { content: 0, images: 0, links: 0, responsive: 0, accessibility: 0, seo: 0 }
  for (const item of issues) {
    counts[item.severity] += 1
    categories[item.category] += 1
  }
  const penalty = counts.error * 12 + counts.warning * 5 + counts.suggestion * 2
  return { score: Math.max(0, 100 - penalty), issues, counts, categories }
}

export function applyQualityFix(html: string, target: QualityIssue): string {
  const document = parse(html)
  const element = target.selector ? document.querySelector<HTMLElement>(target.selector) : null
  if (target.rule === 'seo-title') {
    const heading = document.querySelector('h1,h2')?.textContent?.trim() || 'SiteForge 网站'
    const title = document.createElement('title')
    title.textContent = heading.slice(0, 60)
    document.head.appendChild(title)
  } else if (target.rule === 'seo-description') {
    const paragraph = document.querySelector('main p,section p,p')?.textContent?.trim() || '了解这个网站提供的内容、产品与服务。'
    const meta = document.createElement('meta')
    meta.name = 'description'
    meta.content = paragraph.slice(0, 155)
    document.head.appendChild(meta)
  } else if (target.rule === 'document-language') {
    document.documentElement.lang = /[\u4e00-\u9fff]/.test(document.body.textContent ?? '') ? 'zh-CN' : 'en'
  } else if (target.rule === 'viewport') {
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = 'width=device-width, initial-scale=1'
    document.head.appendChild(meta)
  } else if (target.rule === 'image-alt' && element instanceof HTMLImageElement) {
    element.alt = element.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || ''
  } else if (target.rule === 'image-http' && element instanceof HTMLImageElement) {
    element.src = element.src.replace(/^http:\/\//i, 'https://')
  } else if (target.rule === 'image-loading' && element instanceof HTMLImageElement) {
    element.loading = 'lazy'
    element.decoding = 'async'
  } else if (target.rule === 'external-rel' && element instanceof HTMLAnchorElement) {
    element.rel = 'noopener noreferrer'
  } else if (target.rule === 'form-label' && element) {
    element.setAttribute('aria-label', element.getAttribute('placeholder') || element.getAttribute('name') || '输入字段')
  } else if (target.rule === 'fixed-width' && element) {
    element.style.maxWidth = '100%'
    element.style.width = '100%'
  } else if (target.rule === 'small-text' && element) {
    element.style.fontSize = '12px'
  } else if (target.rule === 'og-title') {
    const title = document.querySelector('title')?.textContent || document.querySelector('h1')?.textContent || 'SiteForge 网站'
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'og:title')
    meta.content = title.slice(0, 80)
    document.head.appendChild(meta)
  }
  return serialize(document, html)
}

export function applyAllSafeQualityFixes(html: string, issues: QualityIssue[]): string {
  return issues.filter((item) => item.fixable).reduce((current, item) => applyQualityFix(current, item), html)
}

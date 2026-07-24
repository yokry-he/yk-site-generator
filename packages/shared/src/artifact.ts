import type { ArtifactFile, ArtifactFileTree, ArtifactMeta } from './types'

/* ============ <head> 标准槽位协议与 SEO 注入(SF-1-8) ============ */

/** 标准 head 槽位:基础元信息 + Open Graph + Twitter Card */
export const HEAD_SLOT_NAMES = [
  'charset',
  'title',
  'description',
  'viewport',
  'theme-color',
  'og',
  'twitter',
] as const
export type HeadSlotName = (typeof HEAD_SLOT_NAMES)[number]
export type HeadSlots = Partial<Record<HeadSlotName, string>>

export const HEAD_CHECK_NAMES = [
  'charset',
  'title',
  'description',
  'viewport',
  'themeColor',
  'ogTitle',
  'ogDescription',
  'ogType',
  'twitterCard',
  'twitterTitle',
  'twitterDescription',
] as const
export type HeadCheckName = (typeof HEAD_CHECK_NAMES)[number]
export interface HeadCompletenessReport {
  complete: boolean
  checks: Record<HeadCheckName, boolean>
  missing: HeadCheckName[]
}

const slotBegin = (name: string) => `<!-- @sf:slot:${name} -->`
const SLOT_END = '<!-- /@sf:slot -->'
const SLOT_BLOCK_RE = /<!-- @sf:slot:[\w-]+ -->[\s\S]*?<!-- \/@sf:slot -->/gi

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

function attrValue(tag: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

function metaContent(html: string, attr: 'name' | 'property', expected: string): string | undefined {
  const normalized = expected.toLowerCase()
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attrValue(tag, attr)?.toLowerCase() === normalized) return attrValue(tag, 'content')
  }
  return undefined
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function cleanText(s: string): string {
  return decodeBasicEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function truncateText(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`
}

function firstTagText(html: string, tagName: string): string | undefined {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i'))
  const text = match?.[1] ? cleanText(match[1]) : ''
  return text || undefined
}

/** 从模型产物内容优先推导标题,再回退到 ArtifactMeta.title */
export function deriveSeoTitle(meta: ArtifactMeta, html = ''): string {
  const title = firstTagText(html, 'title') ?? firstTagText(html, 'h1') ?? cleanText(meta.title)
  return truncateText(title || '未命名网站', 70)
}

/** 从原有 description / 首段正文 / 用户需求依次推导摘要 */
export function deriveSeoDescription(meta: ArtifactMeta, html = ''): string {
  const description =
    metaContent(html, 'name', 'description') ?? firstTagText(html, 'p') ?? cleanText(meta.requirement)
  return truncateText(description || deriveSeoTitle(meta, html), 160)
}

/** 根据产物元信息与正文生成标准 SEO/OG/Twitter 槽位 */
export function defaultHeadSlots(meta: ArtifactMeta, html = ''): Record<HeadSlotName, string> {
  const title = deriveSeoTitle(meta, html)
  const desc = deriveSeoDescription(meta, html)
  const themeColor = metaContent(html, 'name', 'theme-color') ?? '#09090b'
  return {
    charset: '<meta charset="UTF-8" />',
    title: `<title>${escapeHtml(title)}</title>`,
    description: `<meta name="description" content="${escapeAttr(desc)}" />`,
    viewport: '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    'theme-color': `<meta name="theme-color" content="${escapeAttr(themeColor)}" />`,
    og: [
      `<meta property="og:title" content="${escapeAttr(title)}" />`,
      `<meta property="og:description" content="${escapeAttr(desc)}" />`,
      '<meta property="og:type" content="website" />',
    ].join('\n'),
    twitter: [
      '<meta name="twitter:card" content="summary" />',
      `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
      `<meta name="twitter:description" content="${escapeAttr(desc)}" />`,
    ].join('\n'),
  }
}

/** 把槽位渲染为带占位注释的结构块 */
export function renderHeadSlotBlock(slots: HeadSlots): string {
  return HEAD_SLOT_NAMES.filter((n) => slots[n])
    .map((n) => `${slotBegin(n)}\n${slots[n]}\n${SLOT_END}`)
    .join('\n')
}

/** 替换 HTML 中已有槽位的内容;只替换已存在的槽位,不新增。 */
export function injectHeadSlots(html: string, slots: HeadSlots): string {
  let out = html
  for (const name of HEAD_SLOT_NAMES) {
    const value = slots[name]
    if (value === undefined) continue
    const re = new RegExp(`(<!-- @sf:slot:${name} -->)[\\s\\S]*?(<!-- \/@sf:slot -->)`)
    if (re.test(out)) out = out.replace(re, `$1\n${value}\n$2`)
  }
  return out
}

const MANAGED_META_NAMES = new Set([
  'description',
  'viewport',
  'theme-color',
  'twitter:card',
  'twitter:title',
  'twitter:description',
])

function stripManagedHeadTags(headContent: string): string {
  let cleaned = headContent.replace(SLOT_BLOCK_RE, '')
  cleaned = cleaned.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
  cleaned = cleaned.replace(/<meta\b[^>]*>/gi, (tag) => {
    const name = attrValue(tag, 'name')?.toLowerCase()
    const property = attrValue(tag, 'property')?.toLowerCase()
    const hasCharset = /\bcharset\s*=/i.test(tag)
    return hasCharset || (name && MANAGED_META_NAMES.has(name)) || property?.startsWith('og:') ? '' : tag
  })
  return cleaned.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n')
}

/**
 * 对任意 HTML 自动注入完整 head 元信息:
 * - 清理模型原有的同类标签,避免 title / description / OG 重复
 * - 无 head 时自动创建
 * - 每次重建全部标准槽位,保证幂等并允许迭代时刷新内容
 */
export function injectSeoHead(html: string, meta: ArtifactMeta, slots?: HeadSlots): string {
  const block = renderHeadSlotBlock({ ...defaultHeadSlots(meta, html), ...slots })
  const headRe = /<head\b([^>]*)>([\s\S]*?)<\/head>/i
  const headMatch = html.match(headRe)
  if (headMatch) {
    const attrs = headMatch[1] ?? ''
    const retained = stripManagedHeadTags(headMatch[2] ?? '')
    const content = retained ? `${block}\n${retained}` : block
    return html.replace(headRe, `<head${attrs}>\n${content}\n</head>`)
  }

  const head = `<head>\n${block}\n</head>`
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (tag) => `${tag}\n${head}`)
  return `${head}\n${html}`
}

function hasMeta(html: string, attr: 'name' | 'property', expected: string): boolean {
  const value = metaContent(html, attr, expected)
  return Boolean(value?.trim())
}

/** 生成评测与发布前检查共用的 head 完整性报告 */
export function analyzeHeadCompleteness(html: string): HeadCompletenessReport {
  const checks: Record<HeadCheckName, boolean> = {
    charset: /<meta\b[^>]*\bcharset\s*=\s*(?:"[^"]+"|'[^']+'|[^\s>]+)[^>]*>/i.test(html),
    title: Boolean(firstTagText(html, 'title')),
    description: hasMeta(html, 'name', 'description'),
    viewport: hasMeta(html, 'name', 'viewport'),
    themeColor: hasMeta(html, 'name', 'theme-color'),
    ogTitle: hasMeta(html, 'property', 'og:title'),
    ogDescription: hasMeta(html, 'property', 'og:description'),
    ogType: hasMeta(html, 'property', 'og:type'),
    twitterCard: hasMeta(html, 'name', 'twitter:card'),
    twitterTitle: hasMeta(html, 'name', 'twitter:title'),
    twitterDescription: hasMeta(html, 'name', 'twitter:description'),
  }
  const missing = HEAD_CHECK_NAMES.filter((name) => !checks[name])
  return { complete: missing.length === 0, checks, missing }
}

/* ============ 文件树 ⇄ 单 HTML 互转 ============ */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function insertBeforeTag(html: string, tag: string, snippet: string): string {
  return html.includes(tag) ? html.replace(tag, `${snippet}\n${tag}`) : `${html}\n${snippet}`
}

/**
 * 文件树 → 单个自包含 HTML:
 * - 本地 CSS/JS 文件内联,并用 data-sf-src 标注原路径(保证可解析回文件树)
 * - <head> 自动注入并刷新标准 SEO/OG/Twitter 槽位
 * - 二进制文件无法内联,以注释形式标注跳过
 */
export function artifactToSingleHtml(
  tree: ArtifactFileTree,
  meta: ArtifactMeta,
  slots?: HeadSlots,
): string {
  const entryFile = tree.files.find((f) => f.path === tree.entry) ?? tree.files[0]
  if (!entryFile) throw new Error('文件树为空,无法生成单 HTML')

  let html = injectSeoHead(entryFile.content, meta, slots)

  // 内联 CSS
  for (const f of tree.files) {
    if (f.path === entryFile.path || f.binary) continue
    if (!f.path.endsWith('.css')) continue
    const tag = `<style data-sf-src="${f.path}">\n${f.content}\n</style>`
    const linkRe = new RegExp(`<link[^>]*href=["']${escapeRegExp(f.path)}["'][^>]*>`, 'i')
    html = linkRe.test(html) ? html.replace(linkRe, tag) : insertBeforeTag(html, '</head>', tag)
  }

  // 内联 JS
  for (const f of tree.files) {
    if (f.path === entryFile.path || f.binary) continue
    if (!f.path.endsWith('.js')) continue
    const tag = `<script data-sf-src="${f.path}">\n${f.content}\n</script>`
    const srcRe = new RegExp(`<script[^>]*src=["']${escapeRegExp(f.path)}["'][^>]*>\\s*</script>`, 'i')
    html = srcRe.test(html) ? html.replace(srcRe, tag) : insertBeforeTag(html, '</body>', tag)
  }

  // 二进制文件标注
  for (const f of tree.files) {
    if (f.binary) html = insertBeforeTag(html, '</body>', `<!-- @sf:binary-skipped:${f.path} -->`)
  }

  return html
}

/** 提取 data-sf-src 标记的内联块,还原为原路径文件 */
function extractTagged(
  html: string,
  files: ArtifactFile[],
  tag: 'style' | 'script',
  restore: (path: string) => string,
): string {
  const re = new RegExp(
    `<${tag}[^>]*data-sf-src=["']([^"']+)["'][^>]*>\\n?([\\s\\S]*?)\\n?</${tag}>`,
    'gi',
  )
  return html.replace(re, (_m, path: string, content: string) => {
    files.push({ path, content })
    return restore(path)
  })
}

/**
 * 单 HTML → 文件树:
 * - data-sf-src 标记的内联块还原为原路径文件,原位换回 link/script 引用
 * - 未标记的内联 <style>/<script> 提取为 styles/inline-N.css、scripts/inline-N.js
 * - 剩余内容为入口 index.html
 */
export function singleHtmlToArtifact(html: string): ArtifactFileTree {
  const files: ArtifactFile[] = []
  let entry = html

  entry = extractTagged(entry, files, 'style', (p) => `<link rel="stylesheet" href="${p}">`)
  entry = extractTagged(entry, files, 'script', (p) => `<script src="${p}"></script>`)

  let cssN = 0
  entry = entry.replace(/<style(?![^>]*data-sf-src)[^>]*>([\s\S]*?)<\/style>/gi, (match, content: string) => {
    if (!content.trim()) return match
    const path = `styles/inline-${++cssN}.css`
    files.push({ path, content: content.replace(/^\n|\n$/g, '') })
    return `<link rel="stylesheet" href="${path}">`
  })

  let jsN = 0
  entry = entry.replace(/<script(?![^>]*(?:data-sf-src|src\s*=))[^>]*>([\s\S]*?)<\/script>/gi, (match, content: string) => {
    if (!content.trim()) return match
    const path = `scripts/inline-${++jsN}.js`
    files.push({ path, content: content.replace(/^\n|\n$/g, '') })
    return `<script src="${path}"></script>`
  })

  files.push({ path: 'index.html', content: entry })
  return { files, entry: 'index.html' }
}

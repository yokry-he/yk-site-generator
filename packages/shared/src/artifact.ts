import type { ArtifactFile, ArtifactFileTree, ArtifactMeta } from './types'

/* ============ <head> 标准槽位协议 ============ */

/** 槽位名称:title / description / viewport / theme-color / og(SF-1-8 注入器的替换目标) */
export const HEAD_SLOT_NAMES = ['title', 'description', 'viewport', 'theme-color', 'og'] as const
export type HeadSlotName = (typeof HEAD_SLOT_NAMES)[number]
export type HeadSlots = Partial<Record<HeadSlotName, string>>

const slotBegin = (name: string) => `<!-- @sf:slot:${name} -->`
const SLOT_END = '<!-- /@sf:slot -->'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

/** 根据产物元信息生成默认槽位内容 */
export function defaultHeadSlots(meta: ArtifactMeta): Record<HeadSlotName, string> {
  const desc = meta.requirement.replace(/\s+/g, ' ').slice(0, 80)
  return {
    title: `<title>${escapeHtml(meta.title)}</title>`,
    description: `<meta name="description" content="${escapeAttr(desc)}" />`,
    viewport: '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    'theme-color': '<meta name="theme-color" content="#09090b" />',
    og: [
      `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
      `<meta property="og:description" content="${escapeAttr(desc)}" />`,
      '<meta property="og:type" content="website" />',
    ].join('\n'),
  }
}

/** 把槽位渲染为带占位注释的结构块 */
export function renderHeadSlotBlock(slots: HeadSlots): string {
  return HEAD_SLOT_NAMES.filter((n) => slots[n])
    .map((n) => `${slotBegin(n)}\n${slots[n]}\n${SLOT_END}`)
    .join('\n')
}

/**
 * 替换 HTML 中已有槽位的内容(SF-1-8 SEO/OG 注入器的落点)。
 * 只替换已存在的槽位,不新增。
 */
export function injectHeadSlots(html: string, slots: HeadSlots): string {
  let out = html
  for (const name of HEAD_SLOT_NAMES) {
    const value = slots[name]
    if (value === undefined) continue
    const re = new RegExp(`(<!-- @sf:slot:${name} -->)[\\s\\S]*?(<!-- /@sf:slot -->)`)
    if (re.test(out)) out = out.replace(re, `$1\n${value}\n$2`)
  }
  return out
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
 * - <head> 注入标准槽位(幂等:已存在槽位则不重复注入)
 * - 二进制文件无法内联,以注释形式标注跳过
 */
export function artifactToSingleHtml(
  tree: ArtifactFileTree,
  meta: ArtifactMeta,
  slots?: HeadSlots,
): string {
  const entryFile = tree.files.find((f) => f.path === tree.entry) ?? tree.files[0]
  if (!entryFile) throw new Error('文件树为空,无法生成单 HTML')

  let html = entryFile.content

  // head 槽位(幂等)
  if (!html.includes('@sf:slot:')) {
    const block = renderHeadSlotBlock({ ...defaultHeadSlots(meta), ...slots })
    if (block) {
      html = html.includes('<head>') ? html.replace('<head>', `<head>\n${block}`) : `${block}\n${html}`
    }
  }

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

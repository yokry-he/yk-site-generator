export type VersionChangeKind = 'added' | 'removed' | 'changed' | 'moved' | 'metadata'
export interface VersionChange {
  id: string
  kind: VersionChangeKind
  category: 'sections' | 'content' | 'images' | 'links' | 'seo' | 'style'
  title: string
  description: string
  before?: string
  after?: string
}
export interface VersionDiffReport {
  score: number
  changes: VersionChange[]
  counts: Record<VersionChangeKind, number>
  summary: string[]
}

interface Snapshot {
  sections: Array<{ key: string; label: string; text: string; index: number }>
  images: string[]
  links: string[]
  title: string
  description: string
  colors: string[]
  fonts: string[]
  textLength: number
}

function parse(html: string): Document { return new DOMParser().parseFromString(html, 'text/html') }
function clean(value: string): string { return value.replace(/\s+/g, ' ').trim() }
function snapshot(html: string): Snapshot {
  const document = parse(html)
  const candidates = [...document.querySelectorAll<HTMLElement>('[data-sf-section-id],body>header,body>main,body>section,body>article,body>footer,main>section')]
  const seen = new Set<HTMLElement>()
  const sections = candidates.filter((section) => { if (seen.has(section)) return false; if ([...seen].some((item) => item.contains(section))) return false; seen.add(section); return true }).map((section, index) => {
    const label = section.dataset.sfSectionLabel || section.querySelector('h1,h2,h3')?.textContent || section.getAttribute('aria-label') || section.tagName
    return { key: section.dataset.sfSectionId || clean(label).slice(0, 60) || `${section.tagName}-${index}`, label: clean(label).slice(0, 70), text: clean(section.textContent || '').slice(0, 1200), index }
  })
  const images = [...document.images].map((image) => `${image.getAttribute('src') || ''}|${image.getAttribute('alt') || ''}`)
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a')].map((link) => `${clean(link.textContent || '')}|${link.getAttribute('href') || ''}`)
  const styleText = [...document.querySelectorAll('style')].map((style) => style.textContent || '').join('\n') + [...document.querySelectorAll<HTMLElement>('[style]')].map((element) => element.getAttribute('style') || '').join('\n')
  const colors = [...new Set(styleText.match(/#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)/gi) ?? [])].sort()
  const fonts = [...new Set([...styleText.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((match) => clean(match[1])))].sort()
  return {
    sections, images, links, colors, fonts,
    title: clean(document.title),
    description: clean(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content || ''),
    textLength: clean(document.body.textContent || '').length,
  }
}

function listDelta(before: string[], after: string[], category: VersionChange['category'], noun: string): VersionChange[] {
  const changes: VersionChange[] = []
  for (const value of after.filter((item) => !before.includes(item))) changes.push({ id: `${category}:add:${value}`, kind: 'added', category, title: `新增${noun}`, description: value.slice(0, 140), after: value })
  for (const value of before.filter((item) => !after.includes(item))) changes.push({ id: `${category}:remove:${value}`, kind: 'removed', category, title: `移除${noun}`, description: value.slice(0, 140), before: value })
  return changes
}

export function analyzeVersionDiff(beforeHtml: string, afterHtml: string): VersionDiffReport {
  const before = snapshot(beforeHtml)
  const after = snapshot(afterHtml)
  const changes: VersionChange[] = []
  const beforeByKey = new Map(before.sections.map((section) => [section.key, section]))
  const afterByKey = new Map(after.sections.map((section) => [section.key, section]))
  for (const section of after.sections) {
    const previous = beforeByKey.get(section.key)
    if (!previous) changes.push({ id: `section:add:${section.key}`, kind: 'added', category: 'sections', title: `新增区块：${section.label}`, description: section.text.slice(0, 160), after: section.text })
    else {
      if (previous.text !== section.text) changes.push({ id: `section:change:${section.key}`, kind: 'changed', category: 'content', title: `内容变化：${section.label}`, description: `文字长度 ${previous.text.length} → ${section.text.length}`, before: previous.text, after: section.text })
      if (previous.index !== section.index) changes.push({ id: `section:move:${section.key}`, kind: 'moved', category: 'sections', title: `移动区块：${section.label}`, description: `位置 ${previous.index + 1} → ${section.index + 1}` })
    }
  }
  for (const section of before.sections.filter((section) => !afterByKey.has(section.key))) changes.push({ id: `section:remove:${section.key}`, kind: 'removed', category: 'sections', title: `移除区块：${section.label}`, description: section.text.slice(0, 160), before: section.text })
  changes.push(...listDelta(before.images, after.images, 'images', '图片'))
  changes.push(...listDelta(before.links, after.links, 'links', '链接'))
  if (before.title !== after.title) changes.push({ id: 'seo:title', kind: 'metadata', category: 'seo', title: '页面标题变化', description: `${before.title || '未设置'} → ${after.title || '未设置'}`, before: before.title, after: after.title })
  if (before.description !== after.description) changes.push({ id: 'seo:description', kind: 'metadata', category: 'seo', title: '页面描述变化', description: '搜索摘要内容发生变化。', before: before.description, after: after.description })
  if (before.colors.join('|') !== after.colors.join('|')) changes.push({ id: 'style:colors', kind: 'changed', category: 'style', title: '颜色系统变化', description: `颜色值 ${before.colors.length} → ${after.colors.length}`, before: before.colors.join(', '), after: after.colors.join(', ') })
  if (before.fonts.join('|') !== after.fonts.join('|')) changes.push({ id: 'style:fonts', kind: 'changed', category: 'style', title: '字体设置变化', description: `${before.fonts.join(', ') || '默认'} → ${after.fonts.join(', ') || '默认'}` })
  if (Math.abs(after.textLength - before.textLength) > 20) changes.push({ id: 'content:length', kind: 'changed', category: 'content', title: '整体文案长度变化', description: `${before.textLength} → ${after.textLength} 个字符` })
  const counts = { added: 0, removed: 0, changed: 0, moved: 0, metadata: 0 }
  for (const change of changes) counts[change.kind] += 1
  const summary = [counts.added ? `新增 ${counts.added} 项` : '', counts.removed ? `移除 ${counts.removed} 项` : '', counts.changed ? `修改 ${counts.changed} 项` : '', counts.moved ? `移动 ${counts.moved} 个区块` : '', counts.metadata ? `元数据 ${counts.metadata} 项` : ''].filter(Boolean)
  return { score: Math.min(100, changes.length * 7 + counts.removed * 4), changes, counts, summary: summary.length ? summary : ['两个版本未发现明显结构差异'] }
}

export type ResponsiveBreakpoint = 'desktop' | 'tablet' | 'mobile'

export interface EditorSelection {
  id: string
  tag: string
  text: string
  src?: string
  alt?: string
  href?: string
  target?: string
  sectionId?: string
  style: Partial<ElementStylePatch>
}

export interface EditorSection {
  id: string
  label: string
  tag: string
  index: number
  hidden: boolean
  locked: boolean
  elementCount: number
}

export interface EditorPatch {
  text?: string
  src?: string
  alt?: string
  href?: string
  target?: '_self' | '_blank'
  ariaLabel?: string
}

export interface ElementStylePatch {
  fontSize?: string
  fontWeight?: string
  lineHeight?: string
  letterSpacing?: string
  textAlign?: string
  color?: string
  backgroundColor?: string
  width?: string
  maxWidth?: string
  minHeight?: string
  padding?: string
  margin?: string
  borderRadius?: string
  boxShadow?: string
  display?: string
  gap?: string
  gridTemplateColumns?: string
  justifyContent?: string
  alignItems?: string
  objectFit?: string
  objectPosition?: string
}

export interface SectionPatch {
  label?: string
  hidden?: boolean
  locked?: boolean
  style?: Partial<ElementStylePatch>
}

export interface ThemePatch {
  accent?: string
  background?: string
  text?: string
  fontFamily?: string
}

export interface SectionPreset {
  id: string
  name: string
  category: 'content' | 'social-proof' | 'conversion' | 'navigation'
  description: string
  html: string
}

const EDITABLE_SELECTOR = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button', 'span', 'li', 'label',
  'blockquote', 'figcaption', 'img',
].join(',')

const SECTION_SELECTOR = [
  'body > header', 'body > nav', 'body > main', 'body > section', 'body > article', 'body > footer',
  'main > header', 'main > section', 'main > article', 'main > footer',
].join(',')

const STYLE_KEYS: Array<keyof ElementStylePatch> = [
  'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'color', 'backgroundColor',
  'width', 'maxWidth', 'minHeight', 'padding', 'margin', 'borderRadius', 'boxShadow', 'display', 'gap',
  'gridTemplateColumns', 'justifyContent', 'alignItems', 'objectFit', 'objectPosition',
]

export const SECTION_PRESETS: SectionPreset[] = [
  {
    id: 'hero-centered', name: '居中首屏', category: 'conversion', description: '标题、介绍和双按钮的高转化首屏。',
    html: `<section style="padding:96px 24px;text-align:center"><div style="max-width:860px;margin:0 auto"><p style="font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.65">New section</p><h2 style="font-size:clamp(2.4rem,7vw,5rem);line-height:1.05;margin:18px 0">用清晰的一句话表达核心价值</h2><p style="max-width:680px;margin:0 auto 30px;font-size:1.1rem;line-height:1.8;opacity:.75">补充一段让目标用户快速理解产品、服务或内容价值的介绍。</p><div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap"><a href="#" style="padding:14px 22px;border-radius:999px;background:var(--primary,#7c3aed);color:#fff;text-decoration:none">主要行动</a><a href="#" style="padding:14px 22px;border-radius:999px;border:1px solid currentColor;text-decoration:none;color:inherit">了解更多</a></div></div></section>`,
  },
  {
    id: 'features-grid', name: '功能卡片', category: 'content', description: '三列功能价值卡片，移动端自动折行。',
    html: `<section style="padding:80px 24px"><div style="max-width:1120px;margin:0 auto"><div style="max-width:680px"><p style="font-weight:700;opacity:.65">核心能力</p><h2 style="font-size:clamp(2rem,5vw,3.6rem);margin:12px 0">让优势一目了然</h2><p style="line-height:1.8;opacity:.72">用简短、具体的描述说明用户为什么应该选择你。</p></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:36px"><article style="padding:26px;border:1px solid rgba(127,127,127,.2);border-radius:20px"><h3>能力一</h3><p style="line-height:1.7;opacity:.7">说明这一能力解决的问题和带来的结果。</p></article><article style="padding:26px;border:1px solid rgba(127,127,127,.2);border-radius:20px"><h3>能力二</h3><p style="line-height:1.7;opacity:.7">说明这一能力解决的问题和带来的结果。</p></article><article style="padding:26px;border:1px solid rgba(127,127,127,.2);border-radius:20px"><h3>能力三</h3><p style="line-height:1.7;opacity:.7">说明这一能力解决的问题和带来的结果。</p></article></div></div></section>`,
  },
  {
    id: 'metrics', name: '数据指标', category: 'social-proof', description: '四项关键指标或业务成果。',
    html: `<section style="padding:64px 24px"><div style="max-width:1120px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px"><div style="padding:24px;border-radius:18px;background:rgba(127,127,127,.08)"><strong style="font-size:2.3rem">98%</strong><p style="opacity:.65">用户满意度</p></div><div style="padding:24px;border-radius:18px;background:rgba(127,127,127,.08)"><strong style="font-size:2.3rem">3×</strong><p style="opacity:.65">效率提升</p></div><div style="padding:24px;border-radius:18px;background:rgba(127,127,127,.08)"><strong style="font-size:2.3rem">24h</strong><p style="opacity:.65">快速响应</p></div><div style="padding:24px;border-radius:18px;background:rgba(127,127,127,.08)"><strong style="font-size:2.3rem">10k+</strong><p style="opacity:.65">服务用户</p></div></div></section>`,
  },
  {
    id: 'testimonial', name: '客户评价', category: 'social-proof', description: '突出一条有说服力的用户评价。',
    html: `<section style="padding:88px 24px"><figure style="max-width:900px;margin:0 auto;text-align:center"><blockquote style="font-size:clamp(1.6rem,4vw,3rem);line-height:1.35;margin:0">“这段评价应具体描述使用后的变化，而不是只有笼统的赞美。”</blockquote><figcaption style="margin-top:26px;opacity:.65">客户姓名 · 职位或公司</figcaption></figure></section>`,
  },
  {
    id: 'faq', name: '常见问题', category: 'content', description: '可编辑的 FAQ 列表。',
    html: `<section style="padding:80px 24px"><div style="max-width:820px;margin:0 auto"><h2 style="font-size:clamp(2rem,5vw,3.4rem)">常见问题</h2><div style="margin-top:28px;display:grid;gap:12px"><details open style="padding:20px;border:1px solid rgba(127,127,127,.2);border-radius:16px"><summary style="font-weight:700;cursor:pointer">这个产品适合谁？</summary><p style="line-height:1.8;opacity:.72">在这里说明最适合的用户和典型使用场景。</p></details><details style="padding:20px;border:1px solid rgba(127,127,127,.2);border-radius:16px"><summary style="font-weight:700;cursor:pointer">如何开始使用？</summary><p style="line-height:1.8;opacity:.72">用三到四句话说明最短的开始路径。</p></details><details style="padding:20px;border:1px solid rgba(127,127,127,.2);border-radius:16px"><summary style="font-weight:700;cursor:pointer">可以获得哪些支持？</summary><p style="line-height:1.8;opacity:.72">说明服务范围、响应方式和可获得的帮助。</p></details></div></div></section>`,
  },
  {
    id: 'cta', name: '行动号召', category: 'conversion', description: '页面尾部的明确转化区块。',
    html: `<section style="padding:80px 24px"><div style="max-width:1040px;margin:0 auto;padding:48px;border-radius:28px;background:var(--primary,#7c3aed);color:#fff;text-align:center"><h2 style="font-size:clamp(2rem,5vw,3.6rem);margin:0">准备好开始了吗？</h2><p style="max-width:620px;margin:16px auto 28px;line-height:1.8;opacity:.82">用一句话降低行动门槛，并说明点击后会发生什么。</p><a href="#" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#fff;color:#111;text-decoration:none;font-weight:700">立即开始</a></div></section>`,
  },
  {
    id: 'footer', name: '简洁页脚', category: 'navigation', description: '品牌、导航和版权信息。',
    html: `<footer style="padding:48px 24px;border-top:1px solid rgba(127,127,127,.18)"><div style="max-width:1120px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap"><div><strong>品牌名称</strong><p style="opacity:.6">一句简短的品牌描述。</p></div><nav style="display:flex;gap:18px;flex-wrap:wrap"><a href="#" style="color:inherit">关于</a><a href="#" style="color:inherit">服务</a><a href="#" style="color:inherit">联系</a></nav><small style="opacity:.55">© 2026 Brand</small></div></footer>`,
  },
]

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function serialize(document: Document, original: string): string {
  const doctype = /^\s*<!doctype[^>]*>/i.exec(original)?.[0] ?? '<!DOCTYPE html>'
  return `${doctype}\n${document.documentElement.outerHTML}`
}

function safeColor(value: string | undefined): string | undefined {
  if (!value) return undefined
  return /^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : undefined
}

function safeStyleValue(key: keyof ElementStylePatch, value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().replace(/[{}<>]/g, '')
  if (!normalized || normalized.length > 120) return undefined
  if (key === 'color' || key === 'backgroundColor') {
    return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|transparent|currentColor)$/i.test(normalized)
      ? normalized
      : undefined
  }
  if (key === 'textAlign') return ['left', 'center', 'right', 'justify', 'start', 'end'].includes(normalized) ? normalized : undefined
  if (key === 'display') return ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'].includes(normalized) ? normalized : undefined
  if (key === 'justifyContent') return ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'].includes(normalized) ? normalized : undefined
  if (key === 'alignItems') return ['start', 'center', 'end', 'stretch', 'baseline'].includes(normalized) ? normalized : undefined
  if (key === 'objectFit') return ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(normalized) ? normalized : undefined
  if (key === 'fontWeight') return /^(normal|bold|[1-9]00)$/.test(normalized) ? normalized : undefined
  if (key === 'boxShadow') return /^[\w\s(),.%#-]+$/.test(normalized) ? normalized : undefined
  if (key === 'gridTemplateColumns') return /^(repeat\([\w\s,().%-]+\)|[\w\s.%-]+)$/.test(normalized) ? normalized : undefined
  return /^[\w\s.,()/%+-]+$/.test(normalized) ? normalized : undefined
}

function sectionCandidates(document: Document): HTMLElement[] {
  const seen = new Set<HTMLElement>()
  const candidates: HTMLElement[] = []
  for (const element of document.querySelectorAll<HTMLElement>(SECTION_SELECTOR)) {
    if (seen.has(element)) continue
    const nestedInSelected = candidates.some((candidate) => candidate !== element && candidate.contains(element) && candidate.tagName !== 'MAIN')
    if (nestedInSelected) continue
    seen.add(element)
    candidates.push(element)
  }
  if (!candidates.length) {
    for (const child of document.body.children) {
      if (child instanceof HTMLElement && child.tagName !== 'SCRIPT' && child.tagName !== 'STYLE') candidates.push(child)
    }
  }
  return candidates
}

function inferSectionLabel(element: HTMLElement, index: number): string {
  const explicit = element.dataset.sfSectionLabel || element.getAttribute('aria-label') || element.id
  if (explicit) return explicit.replace(/[-_]/g, ' ').trim().slice(0, 48)
  const heading = element.querySelector('h1,h2,h3')?.textContent?.trim()
  if (heading) return heading.slice(0, 48)
  const map: Record<string, string> = { HEADER: '页头', NAV: '导航', MAIN: '主要内容', FOOTER: '页脚', ARTICLE: '内容区块', SECTION: '页面区块' }
  return `${map[element.tagName] ?? '区块'} ${index + 1}`
}

function ensureStyleId(element: HTMLElement): string {
  if (!element.dataset.sfStyleId) element.dataset.sfStyleId = `style-${crypto.randomUUID()}`
  return element.dataset.sfStyleId
}

function refreshResponsiveStyle(document: Document) {
  document.getElementById('siteforge-responsive-overrides')?.remove()
  const rules: Record<'tablet' | 'mobile', string[]> = { tablet: [], mobile: [] }
  for (const element of document.querySelectorAll<HTMLElement>('[data-sf-responsive]')) {
    let parsed: Partial<Record<'tablet' | 'mobile', ElementStylePatch>> = {}
    try { parsed = JSON.parse(element.dataset.sfResponsive ?? '{}') as typeof parsed } catch { continue }
    const styleId = ensureStyleId(element)
    for (const breakpoint of ['tablet', 'mobile'] as const) {
      const patch = parsed[breakpoint]
      if (!patch) continue
      const declarations = STYLE_KEYS.map((key) => {
        const value = safeStyleValue(key, patch[key])
        return value ? `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value}!important` : ''
      }).filter(Boolean).join(';')
      if (declarations) rules[breakpoint].push(`[data-sf-style-id="${styleId}"]{${declarations}}`)
    }
  }
  if (!rules.tablet.length && !rules.mobile.length) return
  const style = document.createElement('style')
  style.id = 'siteforge-responsive-overrides'
  style.textContent = `${rules.tablet.length ? `@media(max-width:900px){${rules.tablet.join('')}}` : ''}${rules.mobile.length ? `@media(max-width:640px){${rules.mobile.join('')}}` : ''}`
  document.head.appendChild(style)
}

function readStyle(element: HTMLElement): Partial<ElementStylePatch> {
  const output: Partial<ElementStylePatch> = {}
  for (const key of STYLE_KEYS) {
    const value = element.style[key]
    if (value) output[key] = value
  }
  return output
}

/** 为区块和可编辑节点写入稳定 id；编辑标记仅存在于编辑会话。 */
export function prepareEditableHtml(html: string): string {
  const document = parse(html)
  let sectionIndex = 0
  for (const section of sectionCandidates(document)) {
    sectionIndex += 1
    if (!section.dataset.sfSectionId) section.dataset.sfSectionId = `section-${sectionIndex}-${crypto.randomUUID().slice(0, 8)}`
    if (!section.dataset.sfSectionLabel) section.dataset.sfSectionLabel = inferSectionLabel(section, sectionIndex - 1)
  }
  let index = 0
  for (const element of document.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)) {
    if (element.closest('#siteforge-editor-bridge')) continue
    if (element.tagName !== 'IMG' && !element.textContent?.trim()) continue
    index += 1
    if (!element.dataset.sfEditorId) element.dataset.sfEditorId = `sf-${index}-${crypto.randomUUID().slice(0, 6)}`
  }
  refreshResponsiveStyle(document)
  return serialize(document, html)
}

export function extractEditorSections(preparedHtml: string): EditorSection[] {
  const document = parse(preparedHtml)
  return [...document.querySelectorAll<HTMLElement>('[data-sf-section-id]')].map((section, index) => ({
    id: section.dataset.sfSectionId!,
    label: section.dataset.sfSectionLabel || inferSectionLabel(section, index),
    tag: section.tagName.toLowerCase(),
    index,
    hidden: section.hasAttribute('hidden'),
    locked: section.dataset.sfLocked === 'true',
    elementCount: section.querySelectorAll(EDITABLE_SELECTOR).length,
  }))
}

/** 注入仅在编辑预览中运行的选择桥接脚本。 */
export function buildEditorPreview(preparedHtml: string): string {
  const document = parse(preparedHtml)
  document.getElementById('siteforge-editor-bridge')?.remove()
  document.getElementById('siteforge-editor-bridge-style')?.remove()

  const style = document.createElement('style')
  style.id = 'siteforge-editor-bridge-style'
  style.textContent = `
[data-sf-editor-id]{cursor:pointer;transition:outline-color .12s ease,box-shadow .12s ease}
[data-sf-editor-id].sf-editor-hover{outline:2px dashed #8b5cf6!important;outline-offset:3px!important}
[data-sf-editor-id].sf-editor-selected{outline:2px solid #7c3aed!important;outline-offset:3px!important;box-shadow:0 0 0 5px rgba(124,58,237,.16)!important}
[data-sf-section-id]{position:relative;transition:box-shadow .16s ease,opacity .16s ease}
[data-sf-section-id].sf-section-selected{box-shadow:inset 0 0 0 2px rgba(14,165,233,.8),0 0 0 4px rgba(14,165,233,.12)!important}
[data-sf-section-id][hidden]{display:block!important;opacity:.32!important;filter:grayscale(.6)}
[data-sf-section-id][hidden]::before{content:'已隐藏区块';position:absolute;z-index:2147483647;top:8px;right:8px;padding:5px 8px;border-radius:999px;background:#111827;color:#fff;font:600 11px/1 system-ui}
`
  document.head.appendChild(style)

  const script = document.createElement('script')
  script.id = 'siteforge-editor-bridge'
  script.textContent = `(() => {
    const editable='[data-sf-editor-id]';const sections='[data-sf-section-id]';let selected=null;let selectedSection=null;
    const clear=()=>{selected?.classList.remove('sf-editor-selected');selectedSection?.classList.remove('sf-section-selected')};
    const sendElement=(el)=>parent.postMessage({source:'siteforge-editor',type:'select-element',payload:{
      id:el.dataset.sfEditorId,tag:el.tagName.toLowerCase(),text:el.tagName==='IMG'?'':(el.textContent||''),
      src:el.getAttribute('src')||undefined,alt:el.getAttribute('alt')||undefined,href:el.getAttribute('href')||undefined,
      target:el.getAttribute('target')||undefined,sectionId:el.closest(sections)?.dataset.sfSectionId,style:Object.fromEntries([...el.style].map(key=>[key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),el.style.getPropertyValue(key)]))
    }},'*');
    const sendSection=(el)=>parent.postMessage({source:'siteforge-editor',type:'select-section',payload:{id:el.dataset.sfSectionId}},'*');
    document.addEventListener('mouseover',(event)=>{const el=event.target.closest?.(editable);if(el)el.classList.add('sf-editor-hover')});
    document.addEventListener('mouseout',(event)=>{const el=event.target.closest?.(editable);if(el)el.classList.remove('sf-editor-hover')});
    document.addEventListener('click',(event)=>{const el=event.target.closest?.(editable);const section=event.target.closest?.(sections);if(!el&&!section)return;event.preventDefault();event.stopPropagation();clear();if(el){selected=el;selectedSection=section;el.classList.add('sf-editor-selected');section?.classList.add('sf-section-selected');sendElement(el)}else{selectedSection=section;section.classList.add('sf-section-selected');sendSection(section)}},true);
    document.addEventListener('submit',(event)=>event.preventDefault(),true);
    window.addEventListener('message',(event)=>{const msg=event.data;if(msg?.source!=='siteforge-editor-parent')return;clear();if(msg.type==='focus-section'){const section=document.querySelector('[data-sf-section-id="'+CSS.escape(msg.id)+'"]');if(section){selectedSection=section;section.classList.add('sf-section-selected');section.scrollIntoView({behavior:'smooth',block:'center'})}}if(msg.type==='focus-element'){const el=document.querySelector('[data-sf-editor-id="'+CSS.escape(msg.id)+'"]');if(el){selected=el;selectedSection=el.closest(sections);el.classList.add('sf-editor-selected');selectedSection?.classList.add('sf-section-selected');el.scrollIntoView({behavior:'smooth',block:'center'})}}});
    parent.postMessage({source:'siteforge-editor',type:'ready'},'*');
  })();`
  document.body.appendChild(script)
  return serialize(document, preparedHtml)
}

export function updateEditableElement(preparedHtml: string, id: string, patch: EditorPatch): string {
  const document = parse(preparedHtml)
  const element = document.querySelector<HTMLElement>(`[data-sf-editor-id="${CSS.escape(id)}"]`)
  if (!element || element.closest<HTMLElement>('[data-sf-locked="true"]')) return preparedHtml
  if (patch.text !== undefined && element.tagName !== 'IMG') element.textContent = patch.text
  if (element.tagName === 'IMG') {
    if (patch.src !== undefined) element.setAttribute('src', patch.src.trim())
    if (patch.alt !== undefined) element.setAttribute('alt', patch.alt)
  }
  if (element.tagName === 'A') {
    if (patch.href !== undefined) element.setAttribute('href', patch.href.trim() || '#')
    if (patch.target !== undefined) {
      element.setAttribute('target', patch.target)
      if (patch.target === '_blank') element.setAttribute('rel', 'noopener noreferrer')
      else element.removeAttribute('rel')
    }
  }
  if (patch.ariaLabel !== undefined) {
    if (patch.ariaLabel.trim()) element.setAttribute('aria-label', patch.ariaLabel.trim())
    else element.removeAttribute('aria-label')
  }
  return serialize(document, preparedHtml)
}

export function updateElementStyle(
  preparedHtml: string,
  id: string,
  patch: Partial<ElementStylePatch>,
  breakpoint: ResponsiveBreakpoint = 'desktop',
): string {
  const document = parse(preparedHtml)
  const element = document.querySelector<HTMLElement>(`[data-sf-editor-id="${CSS.escape(id)}"]`)
  if (!element || element.closest<HTMLElement>('[data-sf-locked="true"]')) return preparedHtml
  if (breakpoint === 'desktop') {
    for (const key of STYLE_KEYS) {
      if (!(key in patch)) continue
      const value = safeStyleValue(key, patch[key])
      if (value) element.style[key] = value
      else element.style.removeProperty(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))
    }
  } else {
    let responsive: Partial<Record<'tablet' | 'mobile', ElementStylePatch>> = {}
    try { responsive = JSON.parse(element.dataset.sfResponsive ?? '{}') as typeof responsive } catch { responsive = {} }
    responsive[breakpoint] = { ...(responsive[breakpoint] ?? {}), ...patch }
    element.dataset.sfResponsive = JSON.stringify(responsive)
    ensureStyleId(element)
  }
  refreshResponsiveStyle(document)
  return serialize(document, preparedHtml)
}

export function updateEditorSection(preparedHtml: string, id: string, patch: SectionPatch): string {
  const document = parse(preparedHtml)
  const section = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(id)}"]`)
  if (!section) return preparedHtml
  if (patch.label !== undefined) section.dataset.sfSectionLabel = patch.label.trim() || inferSectionLabel(section, 0)
  if (patch.hidden !== undefined) patch.hidden ? section.setAttribute('hidden', '') : section.removeAttribute('hidden')
  if (patch.locked !== undefined) section.dataset.sfLocked = String(patch.locked)
  if (patch.style && section.dataset.sfLocked !== 'true') {
    for (const key of STYLE_KEYS) {
      if (!(key in patch.style)) continue
      const value = safeStyleValue(key, patch.style[key])
      if (value) section.style[key] = value
      else section.style.removeProperty(key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))
    }
  }
  return serialize(document, preparedHtml)
}

export function moveEditorSection(preparedHtml: string, id: string, direction: -1 | 1): string {
  const document = parse(preparedHtml)
  const section = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(id)}"]`)
  if (!section || section.dataset.sfLocked === 'true') return preparedHtml
  const siblings = [...section.parentElement!.children].filter((item): item is HTMLElement => item instanceof HTMLElement && Boolean(item.dataset.sfSectionId))
  const index = siblings.indexOf(section)
  const target = siblings[index + direction]
  if (!target) return preparedHtml
  if (direction < 0) section.parentElement!.insertBefore(section, target)
  else section.parentElement!.insertBefore(target, section)
  return serialize(document, preparedHtml)
}

export function duplicateEditorSection(preparedHtml: string, id: string): string {
  const document = parse(preparedHtml)
  const section = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(id)}"]`)
  if (!section || section.dataset.sfLocked === 'true') return preparedHtml
  const clone = section.cloneNode(true) as HTMLElement
  delete clone.dataset.sfSectionId
  clone.dataset.sfSectionLabel = `${section.dataset.sfSectionLabel || '区块'} 副本`
  for (const element of clone.querySelectorAll<HTMLElement>('[data-sf-editor-id],[data-sf-style-id]')) {
    delete element.dataset.sfEditorId
    delete element.dataset.sfStyleId
  }
  section.after(clone)
  return prepareEditableHtml(serialize(document, preparedHtml))
}

export function deleteEditorSection(preparedHtml: string, id: string): string {
  const document = parse(preparedHtml)
  const section = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(id)}"]`)
  if (!section || section.dataset.sfLocked === 'true') return preparedHtml
  section.remove()
  return serialize(document, preparedHtml)
}

export function insertEditorSection(preparedHtml: string, presetId: string, afterSectionId?: string): string {
  const preset = SECTION_PRESETS.find((item) => item.id === presetId)
  if (!preset) return preparedHtml
  const document = parse(preparedHtml)
  const fragment = document.createRange().createContextualFragment(preset.html)
  const section = fragment.firstElementChild as HTMLElement | null
  if (!section) return preparedHtml
  const after = afterSectionId
    ? document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(afterSectionId)}"]`)
    : null
  if (after) after.after(section)
  else document.body.appendChild(section)
  return prepareEditableHtml(serialize(document, preparedHtml))
}

export function elementStyleAtBreakpoint(preparedHtml: string, id: string, breakpoint: ResponsiveBreakpoint): Partial<ElementStylePatch> {
  const document = parse(preparedHtml)
  const element = document.querySelector<HTMLElement>(`[data-sf-editor-id="${CSS.escape(id)}"]`)
  if (!element) return {}
  if (breakpoint === 'desktop') return readStyle(element)
  try {
    const responsive = JSON.parse(element.dataset.sfResponsive ?? '{}') as Partial<Record<'tablet' | 'mobile', ElementStylePatch>>
    return responsive[breakpoint] ?? {}
  } catch {
    return {}
  }
}

export function applyThemeOverrides(preparedHtml: string, patch: ThemePatch): string {
  const document = parse(preparedHtml)
  let style = document.getElementById('siteforge-theme-overrides') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'siteforge-theme-overrides'
    document.head.appendChild(style)
  }
  const accent = safeColor(patch.accent)
  const background = safeColor(patch.background)
  const text = safeColor(patch.text)
  const font = patch.fontFamily?.replace(/[{};]/g, '').trim()
  style.textContent = [
    ':root{',
    accent ? `--sf-accent:${accent};--accent:${accent};--primary:${accent};--brand:${accent};` : '',
    background ? `--sf-background:${background};--bg:${background};--background:${background};` : '',
    text ? `--sf-text:${text};--text:${text};--foreground:${text};` : '',
    '}',
    `body{${background ? `background:${background}!important;` : ''}${text ? `color:${text}!important;` : ''}${font ? `font-family:${font}!important;` : ''}}`,
    accent ? `a,button{--accent:${accent};}` : '',
  ].join('')
  return serialize(document, preparedHtml)
}

/** 移除编辑桥接与临时标记，保留响应式样式、隐藏状态和用户修改。 */
export function cleanEditedHtml(preparedHtml: string): string {
  const document = parse(preparedHtml)
  document.getElementById('siteforge-editor-bridge')?.remove()
  document.getElementById('siteforge-editor-bridge-style')?.remove()
  for (const element of document.querySelectorAll<HTMLElement>('[data-sf-editor-id]')) {
    delete element.dataset.sfEditorId
    element.classList.remove('sf-editor-hover', 'sf-editor-selected')
    if (element.classList.length === 0) element.removeAttribute('class')
  }
  for (const section of document.querySelectorAll<HTMLElement>('[data-sf-section-id]')) {
    section.classList.remove('sf-section-selected')
    if (section.classList.length === 0) section.removeAttribute('class')
    delete section.dataset.sfLocked
  }
  refreshResponsiveStyle(document)
  return serialize(document, preparedHtml)
}

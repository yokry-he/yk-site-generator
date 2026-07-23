export interface EditorSelection {
  id: string
  tag: string
  text: string
  src?: string
  alt?: string
  href?: string
}

export interface EditorPatch {
  text?: string
  src?: string
  alt?: string
  href?: string
}

export interface ThemePatch {
  accent?: string
  background?: string
  text?: string
  fontFamily?: string
}

const EDITABLE_SELECTOR = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button', 'span', 'li', 'label',
  'blockquote', 'figcaption', 'img',
].join(',')

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

/** 为可编辑节点写入稳定 id;该标记仅存在于编辑会话中。 */
export function prepareEditableHtml(html: string): string {
  const document = parse(html)
  let index = 0
  for (const element of document.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)) {
    if (element.dataset.sfEditorId) continue
    if (element.tagName !== 'IMG' && !element.textContent?.trim()) continue
    index += 1
    element.dataset.sfEditorId = `sf-${index}`
  }
  return serialize(document, html)
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
`
  document.head.appendChild(style)

  const script = document.createElement('script')
  script.id = 'siteforge-editor-bridge'
  script.textContent = `(() => {
    const selector='[data-sf-editor-id]';
    let selected=null;
    const send=(el)=>parent.postMessage({source:'siteforge-editor',type:'select',payload:{
      id:el.dataset.sfEditorId,tag:el.tagName.toLowerCase(),text:el.tagName==='IMG'?'':(el.textContent||''),
      src:el.getAttribute('src')||undefined,alt:el.getAttribute('alt')||undefined,href:el.getAttribute('href')||undefined
    }},'*');
    document.addEventListener('mouseover',(event)=>{const el=event.target.closest?.(selector);if(el)el.classList.add('sf-editor-hover')});
    document.addEventListener('mouseout',(event)=>{const el=event.target.closest?.(selector);if(el)el.classList.remove('sf-editor-hover')});
    document.addEventListener('click',(event)=>{
      const el=event.target.closest?.(selector);if(!el)return;
      event.preventDefault();event.stopPropagation();
      selected?.classList.remove('sf-editor-selected');selected=el;el.classList.add('sf-editor-selected');send(el);
    },true);
    document.addEventListener('submit',(event)=>event.preventDefault(),true);
    parent.postMessage({source:'siteforge-editor',type:'ready'},'*');
  })();`
  document.body.appendChild(script)
  return serialize(document, preparedHtml)
}

export function updateEditableElement(preparedHtml: string, id: string, patch: EditorPatch): string {
  const document = parse(preparedHtml)
  const element = document.querySelector<HTMLElement>(`[data-sf-editor-id="${CSS.escape(id)}"]`)
  if (!element) return preparedHtml
  if (patch.text !== undefined && element.tagName !== 'IMG') element.textContent = patch.text
  if (element.tagName === 'IMG') {
    if (patch.src !== undefined) element.setAttribute('src', patch.src.trim())
    if (patch.alt !== undefined) element.setAttribute('alt', patch.alt)
  }
  if (element.tagName === 'A' && patch.href !== undefined) element.setAttribute('href', patch.href.trim() || '#')
  return serialize(document, preparedHtml)
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

/** 移除编辑桥接与临时标记,保留用户主题覆盖和内容修改。 */
export function cleanEditedHtml(preparedHtml: string): string {
  const document = parse(preparedHtml)
  document.getElementById('siteforge-editor-bridge')?.remove()
  document.getElementById('siteforge-editor-bridge-style')?.remove()
  for (const element of document.querySelectorAll<HTMLElement>('[data-sf-editor-id]')) {
    delete element.dataset.sfEditorId
    element.classList.remove('sf-editor-hover', 'sf-editor-selected')
    if (element.classList.length === 0) element.removeAttribute('class')
  }
  return serialize(document, preparedHtml)
}

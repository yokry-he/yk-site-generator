import { runtimeAuditBridgeSource } from './runtimeQuality'

export type DropPosition = 'before' | 'after'
export interface SectionLayoutVariant {
  id: string
  label: string
  description: string
}

export const SECTION_LAYOUT_VARIANTS: SectionLayoutVariant[] = [
  { id: 'default', label: '保持当前', description: '保留当前结构，只应用后续样式。' },
  { id: 'centered', label: '居中叙事', description: '内容居中并限制阅读宽度。' },
  { id: 'split', label: '左右双栏', description: '将主要子元素排列为响应式双栏。' },
  { id: 'cards', label: '自适应卡片', description: '将内部内容转换为自动换列卡片网格。' },
]

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}
function serialize(document: Document, original: string): string {
  const doctype = /^\s*<!doctype[^>]*>/i.exec(original)?.[0] ?? '<!DOCTYPE html>'
  return `${doctype}\n${document.documentElement.outerHTML}`
}

export function reorderEditorSection(html: string, sourceId: string, targetId: string, position: DropPosition): string {
  if (!sourceId || sourceId === targetId) return html
  const document = parse(html)
  const source = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(sourceId)}"]`)
  const target = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(targetId)}"]`)
  if (!source || !target || source.parentElement !== target.parentElement || source.dataset.sfLocked === 'true') return html
  if (position === 'before') target.before(source)
  else target.after(source)
  return serialize(document, html)
}

export function applySectionLayoutVariant(html: string, sectionId: string, variantId: string): string {
  const document = parse(html)
  const section = document.querySelector<HTMLElement>(`[data-sf-section-id="${CSS.escape(sectionId)}"]`)
  if (!section || section.dataset.sfLocked === 'true') return html
  section.dataset.sfLayoutVariant = variantId
  section.style.removeProperty('text-align')
  const direct = [...section.children].filter((item): item is HTMLElement => item instanceof HTMLElement)
  if (variantId === 'centered') {
    section.style.textAlign = 'center'
    for (const child of direct) { child.style.maxWidth = '820px'; child.style.marginLeft = 'auto'; child.style.marginRight = 'auto' }
  } else if (variantId === 'split') {
    section.style.display = 'grid'
    section.style.gridTemplateColumns = 'repeat(auto-fit,minmax(280px,1fr))'
    section.style.gap = '32px'
    section.style.alignItems = 'center'
  } else if (variantId === 'cards') {
    section.style.display = 'grid'
    section.style.gridTemplateColumns = 'repeat(auto-fit,minmax(220px,1fr))'
    section.style.gap = '18px'
    for (const child of direct) {
      child.style.padding = child.style.padding || '24px'
      child.style.border = child.style.border || '1px solid rgba(127,127,127,.18)'
      child.style.borderRadius = child.style.borderRadius || '20px'
    }
  } else {
    section.style.removeProperty('display')
    section.style.removeProperty('grid-template-columns')
    section.style.removeProperty('gap')
    section.style.removeProperty('align-items')
  }
  return serialize(document, html)
}

export function buildAdvancedEditorPreview(html: string): string {
  const document = parse(html)
  document.getElementById('siteforge-editor-advanced')?.remove()
  document.getElementById('siteforge-editor-advanced-style')?.remove()

  const style = document.createElement('style')
  style.id = 'siteforge-editor-advanced-style'
  style.textContent = `
[data-sf-section-id][draggable="true"]{cursor:grab}
[data-sf-section-id].sf-drop-before{box-shadow:inset 0 4px 0 #22d3ee!important}
[data-sf-section-id].sf-drop-after{box-shadow:inset 0 -4px 0 #22d3ee!important}
[data-sf-editor-id][contenteditable="true"]{cursor:text!important;outline:2px solid #22d3ee!important;outline-offset:3px!important;background:rgba(34,211,238,.08)!important}
@media(max-width:640px){[data-sf-layout-variant="split"]{grid-template-columns:1fr!important}}
`
  document.head.appendChild(style)

  const script = document.createElement('script')
  script.id = 'siteforge-editor-advanced'
  script.textContent = `(() => {
    ${runtimeAuditBridgeSource()}
    const editable='[data-sf-editor-id]'; const sectionSelector='[data-sf-section-id]'; let original=''; let dragging='';
    const sections=[...document.querySelectorAll(sectionSelector)];
    sections.forEach((section)=>{if(section.dataset.sfLocked!=='true')section.draggable=true;});
    const clearDrop=()=>sections.forEach((section)=>section.classList.remove('sf-drop-before','sf-drop-after'));
    document.addEventListener('dragstart',(event)=>{const section=event.target.closest?.(sectionSelector);if(!section||section.dataset.sfLocked==='true'){event.preventDefault();return;}dragging=section.dataset.sfSectionId;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragging);});
    document.addEventListener('dragover',(event)=>{const target=event.target.closest?.(sectionSelector);if(!target||!dragging||target.dataset.sfSectionId===dragging)return;event.preventDefault();clearDrop();const rect=target.getBoundingClientRect();target.classList.add(event.clientY<rect.top+rect.height/2?'sf-drop-before':'sf-drop-after');});
    document.addEventListener('drop',(event)=>{const target=event.target.closest?.(sectionSelector);if(!target||!dragging)return;event.preventDefault();const rect=target.getBoundingClientRect();parent.postMessage({source:'siteforge-editor',type:'reorder-section',payload:{sourceId:dragging,targetId:target.dataset.sfSectionId,position:event.clientY<rect.top+rect.height/2?'before':'after'}},'*');dragging='';clearDrop();});
    document.addEventListener('dragend',()=>{dragging='';clearDrop();});
    document.addEventListener('dblclick',(event)=>{const el=event.target.closest?.(editable);if(!el||el.tagName==='IMG'||el.closest('[data-sf-locked="true"]'))return;event.preventDefault();event.stopPropagation();original=el.textContent||'';el.contentEditable='true';el.setAttribute('role','textbox');el.focus();const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);},true);
    document.addEventListener('paste',(event)=>{const el=event.target.closest?.('[contenteditable="true"]');if(!el)return;event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));},true);
    document.addEventListener('keydown',(event)=>{const el=event.target.closest?.('[contenteditable="true"]');if(!el)return;if(event.key==='Escape'){event.preventDefault();el.textContent=original;el.blur();}if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();el.blur();}},true);
    document.addEventListener('focusout',(event)=>{const el=event.target.closest?.('[contenteditable="true"]');if(!el)return;el.contentEditable='false';el.removeAttribute('role');parent.postMessage({source:'siteforge-editor',type:'inline-edit',payload:{id:el.dataset.sfEditorId,text:el.textContent||''}},'*');},true);
    addEventListener('message',(event)=>{const msg=event.data;if(msg?.source!=='siteforge-editor-parent')return;if(msg.type==='focus-selector'&&msg.selector){const el=document.querySelector(msg.selector);el?.scrollIntoView({behavior:'smooth',block:'center'});el?.animate([{outline:'3px solid #ef4444',outlineOffset:'4px'},{outline:'0 solid transparent',outlineOffset:'10px'}],{duration:1800,easing:'ease-out'});}});
  })();`
  document.body.appendChild(script)
  return serialize(document, html)
}

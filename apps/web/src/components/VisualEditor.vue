<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Blocks,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image,
  Images,
  Layers3,
  Link2,
  Loader2,
  Lock,
  Monitor,
  Palette,
  PanelBottomOpen,
  Plus,
  Redo2,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
  Undo2,
  Unlock,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import { artifactToSingleHtml, parseModelOutput, type ArtifactMeta } from 'shared'
import AppDialog from './ui/AppDialog.vue'
import BrandAssetPicker from './BrandAssetPicker.vue'
import RuntimeQualityPanel from './RuntimeQualityPanel.vue'
import SiteQualityPanel from './SiteQualityPanel.vue'
import { confirmDialog } from '../composables/useConfirmDialog'
import { useGenerateStream } from '../composables/useGenerateStream'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'
import { useToast } from '../composables/useToast'
import {
  SECTION_PRESETS,
  applyThemeOverrides,
  buildEditorPreview,
  cleanEditedHtml,
  deleteEditorSection,
  duplicateEditorSection,
  elementStyleAtBreakpoint,
  extractEditorSections,
  insertEditorSection,
  moveEditorSection,
  prepareEditableHtml,
  updateEditableElement,
  updateEditorSection,
  updateElementStyle,
  type EditorSection,
  type EditorSelection,
  type ElementStylePatch,
  type ResponsiveBreakpoint,
} from '../lib/visualEditor'
import {
  SECTION_LAYOUT_VARIANTS,
  applySectionLayoutVariant,
  buildAdvancedEditorPreview,
  reorderEditorSection,
  type DropPosition,
} from '../lib/visualEditorAdvanced'
import { applyAllSafeQualityFixes, applyQualityFix, type QualityIssue } from '../lib/siteQuality'
import { runRuntimeAudit, type RuntimeQualityReport } from '../lib/runtimeQuality'
import type { BrandAsset } from '../lib/brandAssets'

const props = defineProps<{ open: boolean; html: string; title?: string; draftKey?: string; siteType?: string; brandKitId?: string }>()
const emit = defineEmits<{ (event: 'close'): void; (event: 'save', html: string): void }>()

const PANELS = [
  { id: 'structure' as const, label: '结构', icon: Layers3 },
  { id: 'content' as const, label: '内容', icon: Type },
  { id: 'style' as const, label: '样式', icon: Palette },
  { id: 'quality' as const, label: '质量', icon: ShieldCheck },
  { id: 'ai' as const, label: 'AI', icon: Sparkles },
]
const VIEWPORTS: Array<{ id: ResponsiveBreakpoint; label: string; icon: typeof Monitor }> = [
  { id: 'desktop', label: '桌面', icon: Monitor },
  { id: 'tablet', label: '平板', icon: Tablet },
  { id: 'mobile', label: '手机', icon: Smartphone },
]
const AI_PRESETS = [
  '让当前选择的层级更清晰，但保持原有内容',
  '优化移动端布局和文字尺寸，不改变品牌风格',
  '重写当前选择的文案，让表达更专业、更具体',
  '增强 CTA 转化路径，减少模糊按钮文案',
  '修复当前选择范围内的无障碍与质量问题',
]
const AI_SCOPES = [
  { id: 'page' as const, label: '整个页面' },
  { id: 'section' as const, label: '当前区块' },
  { id: 'element' as const, label: '当前元素' },
  { id: 'mobile' as const, label: '仅优化移动端' },
  { id: 'quality' as const, label: '仅修复质量问题' },
]

type SheetState = 'collapsed' | 'half' | 'full'
type AiScope = (typeof AI_SCOPES)[number]['id']
interface AiCandidate { id: string; html: string; instruction: string; scope: AiScope; createdAt: string }

const iframeRef = ref<HTMLIFrameElement>()
const draft = ref('')
const sourceFingerprint = ref('')
const selected = ref<EditorSelection | null>(null)
const selectedSectionId = ref('')
const activePanel = ref<(typeof PANELS)[number]['id']>('structure')
const viewport = ref<ResponsiveBreakpoint>('desktop')
const textValue = ref('')
const imageSrc = ref('')
const imageAlt = ref('')
const linkHref = ref('')
const linkTarget = ref<'_self' | '_blank'>('_self')
const ariaLabel = ref('')
const styleDraft = ref<Partial<ElementStylePatch>>({})
const sectionLabel = ref('')
const sectionStyle = ref<Partial<ElementStylePatch>>({})
const sectionVariant = ref('default')
const accent = ref('#8b5cf6')
const background = ref('#ffffff')
const foreground = ref('#18181b')
const fontFamily = ref('system-ui, sans-serif')
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
const dirty = ref(false)
const previewKey = ref(0)
const addSectionOpen = ref(false)
const sheetState = ref<SheetState>('collapsed')
const saveState = ref<'saved' | 'dirty' | 'saving' | 'draft'>('saved')
const ignoredQualityRules = ref<string[]>([])
const runtimeReport = ref<RuntimeQualityReport | null>(null)
const runtimeLoading = ref(false)
const runtimeError = ref('')
const assetPickerOpen = ref(false)
const dragSectionId = ref('')
const aiInstruction = ref('')
const aiScope = ref<AiScope>('page')
const aiCandidates = ref<AiCandidate[]>([])
const aiHistory = ref<Array<{ instruction: string; scope: AiScope; createdAt: string; applied: boolean }>>([])
const aiProcessedLength = ref(0)
const aiStream = useGenerateStream()
const { activeProvider, activeConnection } = useModelConfig()
const { show: showModelSettings } = useModelDialog()
const toast = useToast()
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let sheetStartY = 0
let sheetStartState: SheetState = 'collapsed'

const sections = computed(() => draft.value ? extractEditorSections(draft.value) : [])
const selectedSection = computed(() => sections.value.find((section) => section.id === selectedSectionId.value) ?? null)
const previewHtml = computed(() => draft.value ? buildAdvancedEditorPreview(buildEditorPreview(draft.value)) : '')
const viewportClass = computed(() => viewport.value === 'mobile' ? 'max-w-[390px]' : viewport.value === 'tablet' ? 'max-w-[820px]' : 'max-w-none')
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const storageKey = computed(() => `siteforge:editor-draft:${props.draftKey || props.title || 'session'}`)
const aiHistoryKey = computed(() => `siteforge:editor-ai-history:${props.draftKey || props.title || 'session'}`)
const saveLabel = computed(() => ({ saved: '已保存', dirty: '有未保存修改', saving: '保存中', draft: '草稿已自动保存' })[saveState.value])
const aiBusy = computed(() => aiStream.isActive.value)
const desktopStyle = computed(() => selected.value ? elementStyleAtBreakpoint(draft.value, selected.value.id, 'desktop') : {})
const currentOverrideCount = computed(() => Object.keys(styleDraft.value).filter((key) => Boolean(styleDraft.value[key as keyof ElementStylePatch])).length)
const sheetClass = computed(() => ({ collapsed: 'translate-y-[calc(100%-54px)] max-h-[78vh]', half: 'translate-y-0 h-[52vh]', full: 'translate-y-0 h-[88vh]' })[sheetState.value])

function fingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += Math.max(1, Math.floor(value.length / 5000))) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619) }
  return `${value.length}:${(hash >>> 0).toString(36)}`
}
function restoreDraft(prepared: string): string {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey.value) ?? 'null') as null | { source: string; html: string }
    if (stored?.source === sourceFingerprint.value && stored.html) { saveState.value = 'draft'; dirty.value = true; toast.info('已恢复本地编辑草稿', '可以继续修改，原云端版本未被覆盖。'); return stored.html }
  } catch { localStorage.removeItem(storageKey.value) }
  return prepared
}
function loadAiHistory() {
  try { aiHistory.value = JSON.parse(localStorage.getItem(aiHistoryKey.value) ?? '[]') as typeof aiHistory.value } catch { aiHistory.value = [] }
}
function persistAiHistory() { localStorage.setItem(aiHistoryKey.value, JSON.stringify(aiHistory.value.slice(0, 30))) }
function reset() {
  const prepared = prepareEditableHtml(props.html)
  sourceFingerprint.value = fingerprint(props.html)
  draft.value = restoreDraft(prepared)
  selected.value = null
  selectedSectionId.value = extractEditorSections(draft.value)[0]?.id ?? ''
  textValue.value = ''; imageSrc.value = ''; imageAlt.value = ''; linkHref.value = ''; linkTarget.value = '_self'; ariaLabel.value = ''
  styleDraft.value = {}; sectionStyle.value = {}; sectionVariant.value = 'default'; undoStack.value = []; redoStack.value = []
  runtimeReport.value = null; runtimeError.value = ''; aiCandidates.value = []; aiProcessedLength.value = 0
  if (saveState.value !== 'draft') { dirty.value = false; saveState.value = 'saved' }
  loadAiHistory(); previewKey.value += 1
}
function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    if (!dirty.value || !draft.value) return
    localStorage.setItem(storageKey.value, JSON.stringify({ source: sourceFingerprint.value, html: draft.value, savedAt: new Date().toISOString() }))
    saveState.value = 'draft'
  }, 550)
}
function commit(next: string) {
  if (!next || next === draft.value) return
  undoStack.value.push(draft.value); if (undoStack.value.length > 60) undoStack.value.shift()
  redoStack.value = []; draft.value = next; dirty.value = true; saveState.value = 'dirty'; runtimeReport.value = null; previewKey.value += 1; scheduleAutosave()
}
function undo() { const previous = undoStack.value.pop(); if (!previous) return; redoStack.value.push(draft.value); draft.value = previous; selected.value = null; dirty.value = true; saveState.value = 'dirty'; previewKey.value += 1; scheduleAutosave() }
function redo() { const next = redoStack.value.pop(); if (!next) return; undoStack.value.push(draft.value); draft.value = next; selected.value = null; dirty.value = true; saveState.value = 'dirty'; previewKey.value += 1; scheduleAutosave() }

function syncSelection(payload: EditorSelection) {
  selected.value = payload; selectedSectionId.value = payload.sectionId ?? selectedSectionId.value
  textValue.value = payload.text ?? ''; imageSrc.value = payload.src ?? ''; imageAlt.value = payload.alt ?? ''; linkHref.value = payload.href ?? ''; linkTarget.value = payload.target === '_blank' ? '_blank' : '_self'; ariaLabel.value = ''
  styleDraft.value = elementStyleAtBreakpoint(draft.value, payload.id, viewport.value); activePanel.value = 'content'; sheetState.value = 'half'
}
function onMessage(event: MessageEvent) {
  if (!props.open || event.source !== iframeRef.value?.contentWindow) return
  const message = event.data as { source?: string; type?: string; payload?: Record<string, unknown> }
  if (message?.source !== 'siteforge-editor' || !message.payload) return
  if (message.type === 'select-element') syncSelection(message.payload as unknown as EditorSelection)
  if (message.type === 'select-section') {
    selectedSectionId.value = String(message.payload.id ?? ''); selected.value = null
    const section = sections.value.find((item) => item.id === selectedSectionId.value); sectionLabel.value = section?.label ?? ''; sectionVariant.value = 'default'; activePanel.value = 'structure'; sheetState.value = 'half'
  }
  if (message.type === 'inline-edit') {
    const id = String(message.payload.id ?? ''); const text = String(message.payload.text ?? '')
    commit(updateEditableElement(draft.value, id, { text }))
    if (selected.value?.id === id) { textValue.value = text; selected.value = { ...selected.value, text } }
    toast.success('原位文字已更新', '修改已加入当前草稿，可继续撤销或保存。')
  }
  if (message.type === 'reorder-section') {
    commit(reorderEditorSection(draft.value, String(message.payload.sourceId ?? ''), String(message.payload.targetId ?? ''), message.payload.position === 'before' ? 'before' : 'after'))
  }
}
function focusSection(section: EditorSection) { selectedSectionId.value = section.id; selected.value = null; sectionLabel.value = section.label; sectionVariant.value = 'default'; iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-editor-parent', type: 'focus-section', id: section.id }, '*') }
function applyContent() {
  const current = selected.value; if (!current) return
  commit(updateEditableElement(draft.value, current.id, { text: current.tag === 'img' ? undefined : textValue.value, src: current.tag === 'img' ? imageSrc.value : undefined, alt: current.tag === 'img' ? imageAlt.value : undefined, href: current.tag === 'a' ? linkHref.value : undefined, target: current.tag === 'a' ? linkTarget.value : undefined, ariaLabel: ariaLabel.value }))
  selected.value = { ...current, text: textValue.value, src: imageSrc.value || undefined, alt: imageAlt.value || undefined, href: linkHref.value || undefined, target: linkTarget.value }
}
function applyElementStyles() { if (selected.value) commit(updateElementStyle(draft.value, selected.value.id, styleDraft.value, viewport.value)) }
function clearBreakpointStyles() {
  if (!selected.value) return
  const current = elementStyleAtBreakpoint(draft.value, selected.value.id, viewport.value)
  commit(updateElementStyle(draft.value, selected.value.id, Object.fromEntries(Object.keys(current).map((key) => [key, ''])) as Partial<ElementStylePatch>, viewport.value)); styleDraft.value = {}
}
function applySection() {
  if (!selectedSection.value) return
  let next = updateEditorSection(draft.value, selectedSection.value.id, { label: sectionLabel.value, style: sectionStyle.value })
  next = applySectionLayoutVariant(next, selectedSection.value.id, sectionVariant.value)
  commit(next)
}
async function sectionAction(action: 'up' | 'down' | 'duplicate' | 'hide' | 'lock' | 'delete') {
  const section = selectedSection.value; if (!section) return
  if (action === 'delete' && !(await confirmDialog({ title: `删除区块「${section.label}」？`, description: '删除后可以立即使用撤销恢复；保存版本前不会影响云端内容。', confirmLabel: '删除区块', tone: 'danger' }))) return
  if (action === 'up') commit(moveEditorSection(draft.value, section.id, -1))
  if (action === 'down') commit(moveEditorSection(draft.value, section.id, 1))
  if (action === 'duplicate') commit(duplicateEditorSection(draft.value, section.id))
  if (action === 'hide') commit(updateEditorSection(draft.value, section.id, { hidden: !section.hidden }))
  if (action === 'lock') commit(updateEditorSection(draft.value, section.id, { locked: !section.locked }))
  if (action === 'delete') { commit(deleteEditorSection(draft.value, section.id)); selectedSectionId.value = extractEditorSections(draft.value)[0]?.id ?? '' }
}
function onSectionDragStart(section: EditorSection, event: DragEvent) { if (section.locked) { event.preventDefault(); return } dragSectionId.value = section.id; event.dataTransfer?.setData('text/plain', section.id) }
function onSectionDrop(target: EditorSection, position: DropPosition) { if (dragSectionId.value) commit(reorderEditorSection(draft.value, dragSectionId.value, target.id, position)); dragSectionId.value = '' }
function insertPreset(id: string) { commit(insertEditorSection(draft.value, id, selectedSectionId.value || undefined)); addSectionOpen.value = false; void nextTick(() => { const next = extractEditorSections(draft.value).at(-1); if (next) focusSection(next) }) }
function applyTheme() { commit(applyThemeOverrides(draft.value, { accent: accent.value, background: background.value, text: foreground.value, fontFamily: fontFamily.value })) }
function applyIssue(target: QualityIssue) { commit(prepareEditableHtml(applyQualityFix(cleanEditedHtml(draft.value), target))); toast.success('问题已自动修复', target.title) }
function applyAllIssues(issues: QualityIssue[]) { commit(prepareEditableHtml(applyAllSafeQualityFixes(cleanEditedHtml(draft.value), issues))); toast.success('安全修复已完成', `已处理 ${issues.length} 项问题。`) }
function focusIssue(target: QualityIssue) { if (target.selector) iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-editor-parent', type: 'focus-selector', selector: target.selector }, '*'); else toast.info('这是页面级问题', '可根据说明在内容或样式面板中处理。') }
function ignoreRule(rule: string) { if (!ignoredQualityRules.value.includes(rule)) ignoredQualityRules.value.push(rule) }
async function runAudit() {
  if (!iframeRef.value || runtimeLoading.value) return
  runtimeLoading.value = true; runtimeError.value = ''
  try { runtimeReport.value = await runRuntimeAudit(iframeRef.value) }
  catch { runtimeError.value = '预览尚未准备好，请等待页面完成渲染后重试。' }
  finally { runtimeLoading.value = false }
}
function focusRuntime(selector: string) { iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-editor-parent', type: 'focus-selector', selector }, '*') }
function chooseAsset(asset: BrandAsset) { imageSrc.value = asset.dataUrl; if (!imageAlt.value) imageAlt.value = asset.alt ?? asset.name; applyContent() }
async function uploadImage(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return
  if (!file.type.startsWith('image/') || file.size > 4_000_000) { toast.error('图片无法使用', '请选择 4MB 以内的图片。'); input.value = ''; return }
  const reader = new FileReader(); reader.onload = () => { imageSrc.value = String(reader.result); if (!imageAlt.value) imageAlt.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '); applyContent() }; reader.readAsDataURL(file); input.value = ''
}
function save() { if (!draft.value) return; saveState.value = 'saving'; emit('save', cleanEditedHtml(draft.value)); dirty.value = false; localStorage.removeItem(storageKey.value); saveState.value = 'saved' }
async function discardDraft() { if (dirty.value && !(await confirmDialog({ title: '放弃本轮全部修改？', description: '编辑器会恢复到进入时的版本，本地草稿也会被清除。', confirmLabel: '放弃修改', tone: 'danger' }))) return; localStorage.removeItem(storageKey.value); saveState.value = 'saved'; reset() }
async function close() { if (dirty.value && !(await confirmDialog({ title: '关闭编辑器并保留草稿？', description: '未保存修改已经保存在当前浏览器，下次打开相同版本时可继续。', confirmLabel: '关闭并保留草稿', cancelLabel: '继续编辑', tone: 'default' }))) return; emit('close') }

function scopeContext(): string {
  if (aiScope.value === 'element') return selected.value ? `只修改元素 <${selected.value.tag}>，当前文字为：${selected.value.text.slice(0, 800)}` : '未选中元素，请保持其他内容不变。'
  if (aiScope.value === 'section') return selectedSection.value ? `只修改区块「${selectedSection.value.label}」，区块标识 ${selectedSection.value.id}。` : '未选中区块，请保持其他区块不变。'
  if (aiScope.value === 'mobile') return '只优化 max-width:640px 的移动端样式，桌面内容与品牌方向保持不变。'
  if (aiScope.value === 'quality') return '只修复可访问性、响应式和 SEO 质量问题，不重写正常内容。'
  return '可以调整完整页面，但必须保留现有主要内容和品牌方向。'
}
function runAi(instruction = aiInstruction.value) {
  const text = instruction.trim(); if (!text || aiBusy.value) return
  if (!activeProvider.value || !activeConnection.value) { showModelSettings(); toast.info('先连接模型', 'AI 编辑会使用当前模型连接。'); return }
  aiInstruction.value = text; aiProcessedLength.value = 0
  const connection = activeConnection.value
  void aiStream.start({ provider: activeProvider.value.id, model: connection.model, apiKey: connection.apiKey, baseUrl: connection.baseUrl || undefined, siteType: props.siteType || 'website', requirement: `在保持完整页面可运行的前提下修改当前网站。范围：${scopeContext()} 指令：${text}`, history: [{ instruction: text, artifact: cleanEditedHtml(draft.value), round: 1 }] })
}
function captureAiCandidate() {
  if (aiStream.phase.value !== 'done' || !aiStream.text.value || aiProcessedLength.value === aiStream.text.value.length) return
  const parsed = parseModelOutput(aiStream.text.value); aiProcessedLength.value = aiStream.text.value.length
  if (!parsed) { toast.error('AI 方案无法解析', '当前草稿完整保留，可以调整指令后重试。'); return }
  try {
    const meta: ArtifactMeta = { id: `editor-ai-${Date.now()}`, title: props.title || 'AI 编辑方案', siteType: props.siteType || 'website', requirement: aiInstruction.value, createdAt: new Date().toISOString(), iteration: 1 }
    aiCandidates.value.unshift({ id: crypto.randomUUID(), html: prepareEditableHtml(artifactToSingleHtml(parsed.tree, meta)), instruction: aiInstruction.value, scope: aiScope.value, createdAt: new Date().toISOString() })
    aiCandidates.value = aiCandidates.value.slice(0, 3)
    aiHistory.value.unshift({ instruction: aiInstruction.value, scope: aiScope.value, createdAt: new Date().toISOString(), applied: false }); persistAiHistory()
    toast.success('AI 候选方案已生成', '先查看说明，再选择应用、放弃或生成另一个方案。')
  } catch { toast.error('AI 产物合成失败', '当前编辑草稿未受影响。') }
}
function applyCandidate(candidate: AiCandidate) {
  commit(candidate.html)
  const history = aiHistory.value.find((item) => item.instruction === candidate.instruction && item.createdAt === candidate.createdAt)
  if (history) history.applied = true
  persistAiHistory(); aiCandidates.value = aiCandidates.value.filter((item) => item.id !== candidate.id); activePanel.value = 'structure'; toast.success('AI 方案已应用到草稿', '仍可撤销或继续手动调整。')
}
function onKey(event: KeyboardEvent) {
  if (!props.open) return
  const target = event.target as HTMLElement; const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
  if (event.key === 'Escape' && !typing) { event.preventDefault(); void close() }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save() }
  if (!typing && ['1', '2', '3'].includes(event.key)) viewport.value = ({ '1': 'desktop', '2': 'tablet', '3': 'mobile' } as const)[event.key as '1' | '2' | '3']
  if (!typing && event.altKey && event.key.toLowerCase() === 'q') { event.preventDefault(); activePanel.value = 'quality'; sheetState.value = 'half' }
}
function onSheetPointerDown(event: PointerEvent) { sheetStartY = event.clientY; sheetStartState = sheetState.value; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId) }
function onSheetPointerUp(event: PointerEvent) { const delta = event.clientY - sheetStartY; if (delta < -70) sheetState.value = sheetStartState === 'collapsed' ? 'half' : 'full'; else if (delta > 70) sheetState.value = sheetStartState === 'full' ? 'half' : 'collapsed' }

watch(() => props.open, (open) => { if (open) reset() })
watch(() => props.html, () => { if (props.open && !dirty.value) reset() })
watch(viewport, () => { if (selected.value) styleDraft.value = elementStyleAtBreakpoint(draft.value, selected.value.id, viewport.value); runtimeReport.value = null })
watch(() => aiStream.phase.value, captureAiCandidate)
window.addEventListener('message', onMessage)
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => { window.removeEventListener('message', onMessage); window.removeEventListener('keydown', onKey); if (autosaveTimer) clearTimeout(autosaveTimer) })
</script>

<template>
  <AppDialog :open="open" size="full" :show-close="false" :close-on-backdrop="false" :close-on-escape="false" @close="close">
    <div class="flex h-full min-h-0 flex-col bg-app text-ink">
      <header class="flex min-h-16 items-center gap-2 border-b border-line/10 bg-soft/95 px-3 py-2 backdrop-blur sm:px-5">
        <button class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭编辑器" @click="close"><X class="h-5 w-5" /></button>
        <div class="min-w-0"><h2 class="truncate text-sm font-semibold">{{ title || '可视化编辑' }}</h2><p aria-live="polite" class="flex items-center gap-1.5 text-[10px]" :class="saveState === 'dirty' ? 'text-amber-500' : saveState === 'draft' ? 'text-sky-500' : 'text-faint'"><CircleCheck v-if="saveState === 'saved'" class="h-3 w-3" /><Loader2 v-else-if="saveState === 'saving'" class="h-3 w-3 animate-spin" /><span v-else class="h-1.5 w-1.5 rounded-full bg-current" />{{ saveLabel }}</p></div>
        <div class="ml-auto hidden items-center gap-1 rounded-xl bg-ink/[0.04] p-1 sm:flex"><button v-for="item in VIEWPORTS" :key="item.id" class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" :class="viewport === item.id ? 'bg-soft font-medium text-ink shadow-sm' : 'text-faint hover:text-ink'" @click="viewport = item.id"><component :is="item.icon" class="h-3.5 w-3.5" /><span class="hidden xl:inline">{{ item.label }}</span></button></div>
        <div class="flex items-center gap-1"><button :disabled="!canUndo" class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink disabled:opacity-30" title="撤销" @click="undo"><Undo2 class="h-4 w-4" /></button><button :disabled="!canRedo" class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink disabled:opacity-30" title="重做" @click="redo"><Redo2 class="h-4 w-4" /></button></div>
        <button v-if="dirty" class="hidden rounded-lg border border-line/10 px-3 py-2 text-xs text-faint hover:text-red-500 md:block" @click="discardDraft">放弃修改</button>
        <button :disabled="!dirty || saveState === 'saving'" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand1/20 disabled:opacity-45" @click="save"><Save class="h-4 w-4" /><span class="hidden sm:inline">保存为新版本</span><span class="sm:hidden">保存</span></button>
      </header>

      <div class="flex min-h-0 flex-1">
        <aside class="fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-line/10 bg-soft/98 shadow-2xl transition-[height,transform] duration-200 lg:static lg:z-auto lg:h-auto lg:max-h-none lg:w-[370px] lg:shrink-0 lg:translate-y-0 lg:border-r lg:border-t-0 lg:shadow-none" :class="sheetClass">
          <div class="lg:hidden" @pointerdown="onSheetPointerDown" @pointerup="onSheetPointerUp"><button class="flex h-13 w-full items-center justify-between border-b border-line/10 px-4 text-xs font-semibold" @click="sheetState = sheetState === 'collapsed' ? 'half' : sheetState === 'half' ? 'full' : 'collapsed'"><span class="flex items-center gap-2"><PanelBottomOpen class="h-4 w-4 text-brand1" />编辑面板 · {{ sheetState === 'collapsed' ? '收起' : sheetState === 'half' ? '半屏' : '全屏' }}</span><ChevronRight class="h-4 w-4 transition" :class="sheetState !== 'collapsed' && '-rotate-90'" /></button></div>
          <div class="grid grid-cols-5 border-b border-line/10 p-2"><button v-for="panel in PANELS" :key="panel.id" class="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px]" :class="activePanel === panel.id ? 'bg-brand1/10 font-semibold text-brand1' : 'text-faint hover:bg-ink/5 hover:text-ink'" @click="activePanel = panel.id; sheetState = sheetState === 'collapsed' ? 'half' : sheetState"><component :is="panel.icon" class="h-4 w-4" />{{ panel.label }}</button></div>
          <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            <template v-if="activePanel === 'structure'">
              <div class="flex items-center justify-between"><div><h3 class="text-xs font-semibold">页面结构</h3><p class="mt-1 text-[10px] text-faint">拖拽排序，或使用键盘可访问的上下移动。</p></div><button class="flex items-center gap-1 rounded-lg bg-brand1/10 px-2.5 py-1.5 text-[10px] font-semibold text-brand1" @click="addSectionOpen = !addSectionOpen"><Plus class="h-3 w-3" />添加</button></div>
              <div v-if="addSectionOpen" class="mt-3 grid gap-2 rounded-2xl border border-line/10 bg-app/45 p-3"><button v-for="preset in SECTION_PRESETS" :key="preset.id" class="rounded-xl border border-line/8 bg-soft/55 p-3 text-left hover:border-brand1/25" @click="insertPreset(preset.id)"><span class="text-xs font-semibold">{{ preset.name }}</span><span class="mt-1 block text-[10px] leading-4 text-faint">{{ preset.description }}</span></button></div>
              <div class="mt-4 grid gap-1.5"><div v-for="section in sections" :key="section.id" draggable="true" class="group relative" @dragstart="onSectionDragStart(section, $event)" @dragover.prevent @drop.prevent="onSectionDrop(section, 'before')"><button class="flex w-full items-center gap-2 rounded-xl border p-2.5 text-left" :class="selectedSectionId === section.id ? 'border-brand1/30 bg-brand1/[0.07]' : 'border-transparent hover:border-line/10 hover:bg-ink/[0.03]'" @click="focusSection(section)"><GripVertical class="h-3.5 w-3.5 shrink-0 text-faint" /><span class="grid h-7 w-7 place-items-center rounded-lg bg-ink/5 text-faint"><Blocks class="h-3.5 w-3.5" /></span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-medium" :class="section.hidden && 'line-through opacity-55'">{{ section.label }}</span><span class="mt-0.5 block text-[9px] text-faint">{{ section.tag }} · {{ section.elementCount }} 个元素</span></span><Lock v-if="section.locked" class="h-3 w-3 text-amber-500" /><EyeOff v-if="section.hidden" class="h-3 w-3 text-faint" /></button></div></div>
              <div v-if="selectedSection" class="mt-4 rounded-2xl border border-line/10 bg-app/45 p-4"><label class="text-[10px] font-semibold text-sub">区块名称<input v-model="sectionLabel" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/70 px-3 py-2 text-xs outline-none" /></label><label class="mt-3 block text-[10px] font-semibold text-sub">布局变体<select v-model="sectionVariant" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/70 px-3 py-2 text-xs outline-none"><option v-for="variant in SECTION_LAYOUT_VARIANTS" :key="variant.id" :value="variant.id">{{ variant.label }} · {{ variant.description }}</option></select></label><div class="mt-3 grid grid-cols-3 gap-2"><button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" title="上移" @click="sectionAction('up')"><ArrowUp class="mx-auto h-4 w-4" /></button><button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" title="下移" @click="sectionAction('down')"><ArrowDown class="mx-auto h-4 w-4" /></button><button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" title="复制" @click="sectionAction('duplicate')"><Copy class="mx-auto h-4 w-4" /></button><button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" @click="sectionAction('hide')"><Eye v-if="selectedSection.hidden" class="mx-auto h-4 w-4" /><EyeOff v-else class="mx-auto h-4 w-4" /></button><button class="rounded-lg border border-line/10 p-2 text-faint hover:text-amber-500" @click="sectionAction('lock')"><Unlock v-if="selectedSection.locked" class="mx-auto h-4 w-4" /><Lock v-else class="mx-auto h-4 w-4" /></button><button :disabled="selectedSection.locked" class="rounded-lg border border-red-500/15 p-2 text-red-500 disabled:opacity-30" @click="sectionAction('delete')"><Trash2 class="mx-auto h-4 w-4" /></button></div><div class="mt-4 grid grid-cols-2 gap-2"><label class="text-[10px] text-faint">上下间距<input v-model="sectionStyle.padding" placeholder="80px 24px" class="mt-1 w-full rounded-lg border border-line/10 bg-soft/70 px-2.5 py-2 text-[10px] outline-none" /></label><label class="text-[10px] text-faint">背景色<input v-model="sectionStyle.backgroundColor" placeholder="#ffffff" class="mt-1 w-full rounded-lg border border-line/10 bg-soft/70 px-2.5 py-2 font-mono text-[10px] outline-none" /></label></div><button :disabled="selectedSection.locked" class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand1/10 px-3 py-2.5 text-xs font-semibold text-brand1 disabled:opacity-40" @click="applySection"><Check class="h-3.5 w-3.5" />应用区块设置</button></div>
            </template>

            <template v-else-if="activePanel === 'content'">
              <div v-if="!selected" class="flex min-h-72 flex-col items-center justify-center text-center"><span class="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]"><ChevronRight class="h-5 w-5 text-faint" /></span><h3 class="mt-4 text-sm font-medium">选择页面元素</h3><p class="mt-2 text-xs leading-6 text-faint">单击选择；双击文字可直接在预览中编辑。</p></div>
              <div v-else class="space-y-4"><div class="rounded-xl border border-brand1/15 bg-brand1/[0.06] p-3"><p class="text-[9px] font-semibold tracking-wider text-brand1 uppercase">当前选中</p><p class="mt-1 font-mono text-sm">&lt;{{ selected.tag }}&gt;</p></div><label v-if="selected.tag !== 'img'" class="block text-[10px] font-semibold text-sub">文字内容<textarea v-model="textValue" rows="6" class="mt-2 w-full resize-y rounded-xl border border-line/12 bg-app/60 p-3 text-sm leading-6 outline-none" /></label><template v-if="selected.tag === 'img'"><div class="flex gap-2"><button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand1/20 bg-brand1/[0.06] px-3 py-2.5 text-xs font-semibold text-brand1" @click="assetPickerOpen = true"><Images class="h-3.5 w-3.5" />品牌资源库</button><label class="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-line/10 px-3 py-2.5 text-xs text-sub"><Image class="h-3.5 w-3.5" />本地上传<input type="file" accept="image/*" class="hidden" @change="uploadImage" /></label></div><label class="block text-[10px] font-semibold text-sub">图片地址<input v-model="imageSrc" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none" /></label><label class="block text-[10px] font-semibold text-sub">替代文字<input v-model="imageAlt" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-sm outline-none" /></label></template><template v-if="selected.tag === 'a'"><label class="block text-[10px] font-semibold text-sub"><span class="flex items-center gap-1.5"><Link2 class="h-3.5 w-3.5" />链接地址</span><input v-model="linkHref" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none" /></label><label class="block text-[10px] font-semibold text-sub">打开方式<select v-model="linkTarget" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none"><option value="_self">当前窗口</option><option value="_blank">新窗口</option></select></label></template><label class="block text-[10px] font-semibold text-sub">无障碍名称<input v-model="ariaLabel" placeholder="图标按钮或模糊链接需要填写" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none" /></label><button class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" @click="applyContent"><Check class="h-4 w-4" />应用内容修改</button></div>
            </template>

            <template v-else-if="activePanel === 'style'">
              <div v-if="selected" class="space-y-4"><div class="flex items-start justify-between"><div><h3 class="text-xs font-semibold">元素样式</h3><p class="mt-1 text-[10px] text-faint">{{ viewport === 'desktop' ? '桌面默认值' : currentOverrideCount ? `当前断点覆盖 ${currentOverrideCount} 项` : '全部继承自桌面' }}</p></div><button v-if="viewport !== 'desktop' && currentOverrideCount" class="text-[10px] text-brand1" @click="clearBreakpointStyles">清除覆盖</button></div><div v-if="viewport !== 'desktop'" class="rounded-xl border border-line/10 bg-app/45 p-3 text-[9px] text-faint">桌面继承：字号 {{ desktopStyle.fontSize || '默认' }} · 宽度 {{ desktopStyle.width || '自动' }} · 间距 {{ desktopStyle.padding || '默认' }}</div><div class="grid grid-cols-2 gap-3"><label class="text-[10px] text-faint">字号<input v-model="styleDraft.fontSize" placeholder="18px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">字重<input v-model="styleDraft.fontWeight" placeholder="600" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">行高<input v-model="styleDraft.lineHeight" placeholder="1.6" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">对齐<select v-model="styleDraft.textAlign" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none"><option value="">继承</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label><label class="text-[10px] text-faint">文字颜色<input v-model="styleDraft.color" placeholder="#18181b" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 font-mono text-xs outline-none" /></label><label class="text-[10px] text-faint">背景颜色<input v-model="styleDraft.backgroundColor" placeholder="transparent" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 font-mono text-xs outline-none" /></label><label class="text-[10px] text-faint">宽度<input v-model="styleDraft.width" placeholder="100%" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">最大宽度<input v-model="styleDraft.maxWidth" placeholder="720px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">内边距<input v-model="styleDraft.padding" placeholder="16px 24px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">外边距<input v-model="styleDraft.margin" placeholder="0 auto" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">圆角<input v-model="styleDraft.borderRadius" placeholder="16px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label class="text-[10px] text-faint">间距<input v-model="styleDraft.gap" placeholder="16px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label><label v-if="selected.tag === 'img'" class="text-[10px] text-faint">裁剪方式<select v-model="styleDraft.objectFit" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none"><option value="">继承</option><option value="cover">裁剪填充</option><option value="contain">完整显示</option><option value="fill">拉伸填充</option></select></label><label v-if="selected.tag === 'img'" class="text-[10px] text-faint">图片焦点<input v-model="styleDraft.objectPosition" placeholder="50% 50%" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label></div><button class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" @click="applyElementStyles"><AlignCenter class="h-4 w-4" />应用当前断点</button></div><div class="mt-6 border-t border-line/10 pt-5"><h3 class="text-xs font-semibold">全局主题覆盖</h3><div class="mt-3 grid grid-cols-3 gap-2"><label class="text-[9px] text-faint">强调色<input v-model="accent" type="color" class="mt-1 h-9 w-full rounded-lg" /></label><label class="text-[9px] text-faint">背景<input v-model="background" type="color" class="mt-1 h-9 w-full rounded-lg" /></label><label class="text-[9px] text-faint">文字<input v-model="foreground" type="color" class="mt-1 h-9 w-full rounded-lg" /></label></div><select v-model="fontFamily" class="mt-3 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none"><option value="system-ui, sans-serif">系统无衬线</option><option value="'PingFang SC','Microsoft YaHei',sans-serif">中文现代</option><option value="Georgia,'Times New Roman',serif">经典衬线</option><option value="ui-monospace,SFMono-Regular,monospace">等宽科技</option></select><button class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand1/10 px-4 py-2.5 text-xs font-semibold text-brand1" @click="applyTheme"><Palette class="h-4 w-4" />应用全局主题</button></div>
            </template>

            <template v-else-if="activePanel === 'quality'"><SiteQualityPanel compact :html="draft" :ignored-rules="ignoredQualityRules" @apply="applyIssue" @apply-all="applyAllIssues" @focus="focusIssue" @ignore="ignoreRule" /><RuntimeQualityPanel class="mt-4" :report="runtimeReport" :loading="runtimeLoading" :error="runtimeError" @run="runAudit" @focus="focusRuntime" /></template>

            <template v-else>
              <div class="rounded-2xl border border-brand1/15 bg-brand1/[0.055] p-4"><div class="flex items-center gap-2"><WandSparkles class="h-4 w-4 text-brand1" /><h3 class="text-xs font-semibold">选区级 AI 修改</h3></div><p class="mt-2 text-[10px] leading-5 text-mut">AI 先生成候选方案，不直接覆盖草稿。最多保留最近 3 个候选。</p></div><label class="mt-4 block text-[10px] font-semibold text-sub">修改范围<select v-model="aiScope" class="mt-2 w-full rounded-xl border border-line/10 bg-app/60 px-3 py-2.5 text-xs outline-none"><option v-for="scope in AI_SCOPES" :key="scope.id" :value="scope.id" :disabled="scope.id === 'element' && !selected || scope.id === 'section' && !selectedSection">{{ scope.label }}</option></select></label><div class="mt-4 grid gap-2"><button v-for="preset in AI_PRESETS" :key="preset" :disabled="aiBusy" class="rounded-xl border border-line/10 bg-app/45 p-3 text-left text-[10px] leading-5 text-sub hover:border-brand1/25 disabled:opacity-45" @click="runAi(preset)">{{ preset }}</button></div><label class="mt-4 block text-[10px] font-semibold text-sub">自定义修改指令<textarea v-model="aiInstruction" rows="5" class="mt-2 w-full resize-y rounded-xl border border-line/12 bg-app/60 p-3 text-xs leading-5 outline-none" /></label><button :disabled="!aiInstruction.trim() || aiBusy" class="bg-brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-45" @click="runAi()"><Loader2 v-if="aiBusy" class="h-4 w-4 animate-spin" /><Sparkles v-else class="h-4 w-4" />{{ aiBusy ? '正在生成候选方案' : '生成候选方案' }}</button><div v-if="aiCandidates.length" class="mt-5 space-y-2"><h4 class="text-[10px] font-semibold">待选择方案</h4><article v-for="candidate in aiCandidates" :key="candidate.id" class="rounded-xl border border-line/10 bg-app/45 p-3"><p class="text-[10px] font-semibold">{{ AI_SCOPES.find(item => item.id === candidate.scope)?.label }}</p><p class="mt-1 line-clamp-2 text-[9px] leading-4 text-mut">{{ candidate.instruction }}</p><div class="mt-3 flex gap-2"><button class="flex-1 rounded-lg bg-brand1/10 px-2 py-2 text-[10px] font-semibold text-brand1" @click="applyCandidate(candidate)">应用</button><button class="rounded-lg border border-line/10 px-3 py-2 text-[10px] text-faint" @click="aiCandidates = aiCandidates.filter(item => item.id !== candidate.id)">放弃</button><button class="rounded-lg border border-line/10 px-3 py-2 text-[10px] text-faint" @click="runAi(candidate.instruction)">再生成</button></div></article></div><details v-if="aiHistory.length" class="mt-5 rounded-xl border border-line/10 p-3"><summary class="cursor-pointer text-[10px] font-semibold">AI 修改历史 {{ aiHistory.length }}</summary><div class="mt-3 space-y-2"><div v-for="item in aiHistory.slice(0, 8)" :key="item.createdAt" class="rounded-lg bg-ink/[0.035] p-2"><p class="line-clamp-2 text-[9px] text-mut">{{ item.instruction }}</p><p class="mt-1 text-[8px] text-faint">{{ AI_SCOPES.find(scope => scope.id === item.scope)?.label }} · {{ item.applied ? '已应用' : '未应用' }}</p></div></div></details>
            </template>
          </div>
        </aside>

        <main class="relative min-w-0 flex-1 overflow-hidden bg-ink/[0.035] p-2 pb-16 sm:p-4 lg:pb-4">
          <div class="mb-2 flex items-center justify-between sm:hidden"><div class="flex rounded-xl bg-soft/80 p-1"><button v-for="item in VIEWPORTS" :key="item.id" class="rounded-lg p-2" :class="viewport === item.id ? 'bg-brand1/10 text-brand1' : 'text-faint'" @click="viewport = item.id"><component :is="item.icon" class="h-4 w-4" /></button></div><p class="text-[9px] text-faint">双击文字原位编辑 · 拖拽区块排序</p></div>
          <div class="mx-auto h-full overflow-hidden rounded-xl border border-line/12 bg-white shadow-2xl transition-[max-width] duration-200" :class="viewportClass"><iframe ref="iframeRef" :key="previewKey" :srcdoc="previewHtml" sandbox="allow-scripts" referrerpolicy="no-referrer" title="可视化编辑预览" class="h-full w-full" @load="runtimeReport = null" /></div>
        </main>
      </div>
      <BrandAssetPicker :open="assetPickerOpen" :brand-kit-id="brandKitId" @close="assetPickerOpen = false" @select="chooseAsset" />
    </div>
  </AppDialog>
</template>

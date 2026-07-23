<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlignCenter,
  ArrowDown,
  ArrowUp,
  Blocks,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  Image,
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
import SiteQualityPanel from './SiteQualityPanel.vue'
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
  applyAllSafeQualityFixes,
  applyQualityFix,
  type QualityIssue,
} from '../lib/siteQuality'

const props = defineProps<{
  open: boolean
  html: string
  title?: string
  draftKey?: string
  siteType?: string
}>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', html: string): void
}>()

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
  '让当前页面的层级更清晰，但保持原有内容',
  '优化移动端布局和文字尺寸，不改变品牌风格',
  '重写当前区块文案，让表达更专业、更具体',
  '增强 CTA 转化路径，减少模糊按钮文案',
  '修复无障碍与页面质量问题，保持视觉方向',
]

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
const accent = ref('#8b5cf6')
const background = ref('#ffffff')
const foreground = ref('#18181b')
const fontFamily = ref('system-ui, sans-serif')
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
const dirty = ref(false)
const previewKey = ref(0)
const addSectionOpen = ref(false)
const mobilePanelOpen = ref(false)
const saveState = ref<'saved' | 'dirty' | 'saving' | 'draft'>('saved')
const ignoredQualityRules = ref<string[]>([])
const aiInstruction = ref('')
const aiAppliedLength = ref(0)
const lastAiInstruction = ref('')
const aiStream = useGenerateStream()
const { activeProvider, activeConnection } = useModelConfig()
const { show: showModelSettings } = useModelDialog()
const toast = useToast()
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

const sections = computed(() => draft.value ? extractEditorSections(draft.value) : [])
const selectedSection = computed(() => sections.value.find((section) => section.id === selectedSectionId.value) ?? null)
const previewHtml = computed(() => draft.value ? buildEditorPreview(draft.value) : '')
const viewportClass = computed(() => {
  if (viewport.value === 'mobile') return 'max-w-[390px]'
  if (viewport.value === 'tablet') return 'max-w-[820px]'
  return 'max-w-none'
})
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)
const storageKey = computed(() => `siteforge:editor-draft:${props.draftKey || props.title || 'session'}`)
const saveLabel = computed(() => ({ saved: '已保存', dirty: '有未保存修改', saving: '保存中', draft: '草稿已自动保存' })[saveState.value])
const aiBusy = computed(() => aiStream.isActive.value)

function fingerprint(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += Math.max(1, Math.floor(value.length / 5000))) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `${value.length}:${(hash >>> 0).toString(36)}`
}

function restoreDraft(prepared: string): string {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey.value) ?? 'null') as null | { source: string; html: string }
    if (stored?.source === sourceFingerprint.value && stored.html) {
      saveState.value = 'draft'
      dirty.value = true
      return stored.html
    }
  } catch {
    localStorage.removeItem(storageKey.value)
  }
  return prepared
}

function reset() {
  const prepared = prepareEditableHtml(props.html)
  sourceFingerprint.value = fingerprint(props.html)
  draft.value = restoreDraft(prepared)
  selected.value = null
  selectedSectionId.value = sections.value[0]?.id ?? ''
  textValue.value = ''
  imageSrc.value = ''
  imageAlt.value = ''
  linkHref.value = ''
  linkTarget.value = '_self'
  ariaLabel.value = ''
  styleDraft.value = {}
  sectionStyle.value = {}
  undoStack.value = []
  redoStack.value = []
  if (saveState.value !== 'draft') {
    dirty.value = false
    saveState.value = 'saved'
  }
  previewKey.value += 1
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
  undoStack.value.push(draft.value)
  if (undoStack.value.length > 60) undoStack.value.shift()
  redoStack.value = []
  draft.value = next
  dirty.value = true
  saveState.value = 'dirty'
  previewKey.value += 1
  scheduleAutosave()
}

function undo() {
  const previous = undoStack.value.pop()
  if (!previous) return
  redoStack.value.push(draft.value)
  draft.value = previous
  selected.value = null
  dirty.value = true
  saveState.value = 'dirty'
  previewKey.value += 1
  scheduleAutosave()
}

function redo() {
  const next = redoStack.value.pop()
  if (!next) return
  undoStack.value.push(draft.value)
  draft.value = next
  selected.value = null
  dirty.value = true
  saveState.value = 'dirty'
  previewKey.value += 1
  scheduleAutosave()
}

function syncSelection(payload: EditorSelection) {
  selected.value = payload
  selectedSectionId.value = payload.sectionId ?? selectedSectionId.value
  textValue.value = payload.text ?? ''
  imageSrc.value = payload.src ?? ''
  imageAlt.value = payload.alt ?? ''
  linkHref.value = payload.href ?? ''
  linkTarget.value = payload.target === '_blank' ? '_blank' : '_self'
  ariaLabel.value = ''
  styleDraft.value = elementStyleAtBreakpoint(draft.value, payload.id, viewport.value)
  activePanel.value = 'content'
  mobilePanelOpen.value = true
}

function onMessage(event: MessageEvent) {
  if (!props.open || event.source === window) return
  const message = event.data as { source?: string; type?: string; payload?: EditorSelection | { id: string } }
  if (message?.source !== 'siteforge-editor' || !message.payload) return
  if (message.type === 'select-element') syncSelection(message.payload as EditorSelection)
  if (message.type === 'select-section') {
    selectedSectionId.value = (message.payload as { id: string }).id
    selected.value = null
    const section = sections.value.find((item) => item.id === selectedSectionId.value)
    sectionLabel.value = section?.label ?? ''
    activePanel.value = 'structure'
    mobilePanelOpen.value = true
  }
}

function focusSection(section: EditorSection) {
  selectedSectionId.value = section.id
  selected.value = null
  sectionLabel.value = section.label
  iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-editor-parent', type: 'focus-section', id: section.id }, '*')
}

function applyContent() {
  const current = selected.value
  if (!current) return
  commit(updateEditableElement(draft.value, current.id, {
    text: current.tag === 'img' ? undefined : textValue.value,
    src: current.tag === 'img' ? imageSrc.value : undefined,
    alt: current.tag === 'img' ? imageAlt.value : undefined,
    href: current.tag === 'a' ? linkHref.value : undefined,
    target: current.tag === 'a' ? linkTarget.value : undefined,
    ariaLabel: ariaLabel.value,
  }))
  selected.value = { ...current, text: textValue.value, src: imageSrc.value || undefined, alt: imageAlt.value || undefined, href: linkHref.value || undefined, target: linkTarget.value }
}

function applyElementStyles() {
  if (!selected.value) return
  commit(updateElementStyle(draft.value, selected.value.id, styleDraft.value, viewport.value))
}

function clearBreakpointStyles() {
  if (!selected.value) return
  styleDraft.value = {}
  commit(updateElementStyle(draft.value, selected.value.id, Object.fromEntries(Object.keys(elementStyleAtBreakpoint(draft.value, selected.value.id, viewport.value)).map((key) => [key, ''])) as Partial<ElementStylePatch>, viewport.value))
}

function applySection() {
  if (!selectedSection.value) return
  commit(updateEditorSection(draft.value, selectedSection.value.id, { label: sectionLabel.value, style: sectionStyle.value }))
}

function sectionAction(action: 'up' | 'down' | 'duplicate' | 'hide' | 'lock' | 'delete') {
  const section = selectedSection.value
  if (!section) return
  if (action === 'delete' && !window.confirm(`删除区块「${section.label}」？可通过撤销恢复。`)) return
  if (action === 'up') commit(moveEditorSection(draft.value, section.id, -1))
  if (action === 'down') commit(moveEditorSection(draft.value, section.id, 1))
  if (action === 'duplicate') commit(duplicateEditorSection(draft.value, section.id))
  if (action === 'hide') commit(updateEditorSection(draft.value, section.id, { hidden: !section.hidden }))
  if (action === 'lock') commit(updateEditorSection(draft.value, section.id, { locked: !section.locked }))
  if (action === 'delete') {
    commit(deleteEditorSection(draft.value, section.id))
    selectedSectionId.value = sections.value[0]?.id ?? ''
  }
}

function insertPreset(id: string) {
  commit(insertEditorSection(draft.value, id, selectedSectionId.value || undefined))
  addSectionOpen.value = false
  void nextTick(() => {
    const inserted = sections.value.find((section) => !section.id.startsWith(''))
    if (inserted) focusSection(inserted)
  })
}

function applyTheme() {
  commit(applyThemeOverrides(draft.value, { accent: accent.value, background: background.value, text: foreground.value, fontFamily: fontFamily.value }))
}

function applyIssue(target: QualityIssue) {
  commit(prepareEditableHtml(applyQualityFix(cleanEditedHtml(draft.value), target)))
  toast.success('问题已自动修复', target.title)
}

function applyAllIssues(issues: QualityIssue[]) {
  commit(prepareEditableHtml(applyAllSafeQualityFixes(cleanEditedHtml(draft.value), issues)))
  toast.success('安全修复已完成', `已处理 ${issues.length} 项问题。`)
}

function focusIssue(target: QualityIssue) {
  const editorMatch = target.selector?.match(/data-sf-editor-id="([^"]+)"/)
  const sectionMatch = target.selector?.match(/data-sf-section-id="([^"]+)"/)
  if (editorMatch) iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-editor-parent', type: 'focus-element', id: editorMatch[1] }, '*')
  else if (sectionMatch) iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-editor-parent', type: 'focus-section', id: sectionMatch[1] }, '*')
  else toast.info('这是页面级问题', '可在质量面板中查看说明并自动修复。')
}

function ignoreRule(rule: string) {
  if (!ignoredQualityRules.value.includes(rule)) ignoredQualityRules.value.push(rule)
}

function save() {
  if (!draft.value) return
  saveState.value = 'saving'
  emit('save', cleanEditedHtml(draft.value))
  dirty.value = false
  localStorage.removeItem(storageKey.value)
  saveState.value = 'saved'
}

function discardDraft() {
  if (dirty.value && !window.confirm('放弃本轮全部修改并恢复进入编辑器时的版本？')) return
  localStorage.removeItem(storageKey.value)
  saveState.value = 'saved'
  reset()
}

function close() {
  if (dirty.value && !window.confirm('有尚未保存的编辑。草稿已保存在本机，确定关闭吗？')) return
  emit('close')
}

function runAi(instruction = aiInstruction.value) {
  const text = instruction.trim()
  if (!text || aiBusy.value) return
  if (!activeProvider.value || !activeConnection.value) {
    showModelSettings()
    toast.info('先连接模型', '局部 AI 修改会使用当前模型连接。')
    return
  }
  lastAiInstruction.value = text
  aiInstruction.value = text
  aiAppliedLength.value = 0
  const connection = activeConnection.value
  void aiStream.start({
    provider: activeProvider.value.id,
    model: connection.model,
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl || undefined,
    siteType: props.siteType || 'website',
    requirement: `在保持完整页面可运行的前提下修改当前网站。${text}`,
    history: [{ instruction: text, artifact: cleanEditedHtml(draft.value), round: 1 }],
  })
}

function applyAiResult() {
  if (aiStream.phase.value !== 'done' || !aiStream.text.value || aiAppliedLength.value === aiStream.text.value.length) return
  const parsed = parseModelOutput(aiStream.text.value)
  if (!parsed) {
    toast.error('AI 修改无法解析', '当前编辑草稿已完整保留，可调整指令后重试。')
    return
  }
  try {
    const meta: ArtifactMeta = {
      id: `editor-ai-${Date.now()}`,
      title: props.title || 'AI 编辑版本',
      siteType: props.siteType || 'website',
      requirement: lastAiInstruction.value,
      createdAt: new Date().toISOString(),
      iteration: 1,
    }
    commit(prepareEditableHtml(artifactToSingleHtml(parsed.tree, meta)))
    aiAppliedLength.value = aiStream.text.value.length
    activePanel.value = 'structure'
    toast.success('AI 修改已应用到草稿', '检查预览后再保存为新版本。')
  } catch {
    toast.error('AI 产物合成失败', '当前编辑草稿未受影响。')
  }
}

function onKey(event: KeyboardEvent) {
  if (!props.open) return
  const target = event.target as HTMLElement
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  if (event.key === 'Escape' && !typing) close()
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? redo() : undo()
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    save()
  }
}

watch(() => props.open, (open) => { if (open) reset() })
watch(() => props.html, () => { if (props.open && !dirty.value) reset() })
watch(viewport, () => {
  if (selected.value) styleDraft.value = elementStyleAtBreakpoint(draft.value, selected.value.id, viewport.value)
})
watch(() => aiStream.phase.value, applyAiResult)

window.addEventListener('message', onMessage)
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKey)
  if (autosaveTimer) clearTimeout(autosaveTimer)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="editor">
      <div v-if="open" class="fixed inset-0 z-[160] flex flex-col bg-app text-ink">
        <header class="flex min-h-16 items-center gap-2 border-b border-line/10 bg-soft/95 px-3 py-2 backdrop-blur sm:px-5">
          <button class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭编辑器" @click="close"><X class="h-5 w-5" /></button>
          <div class="min-w-0"><h2 class="truncate text-sm font-semibold">{{ title || '可视化编辑' }}</h2><p class="flex items-center gap-1.5 text-[10px]" :class="saveState === 'dirty' ? 'text-amber-500' : saveState === 'draft' ? 'text-sky-500' : 'text-faint'"><CircleCheck v-if="saveState === 'saved'" class="h-3 w-3" /><Loader2 v-else-if="saveState === 'saving'" class="h-3 w-3 animate-spin" /><span v-else class="h-1.5 w-1.5 rounded-full bg-current" />{{ saveLabel }}</p></div>

          <div class="ml-auto hidden items-center gap-1 rounded-xl bg-ink/[0.04] p-1 sm:flex">
            <button v-for="item in VIEWPORTS" :key="item.id" class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" :class="viewport === item.id ? 'bg-soft font-medium text-ink shadow-sm' : 'text-faint hover:text-ink'" @click="viewport = item.id"><component :is="item.icon" class="h-3.5 w-3.5" /><span class="hidden xl:inline">{{ item.label }}</span></button>
          </div>

          <div class="flex items-center gap-1">
            <button :disabled="!canUndo" class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink disabled:opacity-30" title="撤销" @click="undo"><Undo2 class="h-4 w-4" /></button>
            <button :disabled="!canRedo" class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink disabled:opacity-30" title="重做" @click="redo"><Redo2 class="h-4 w-4" /></button>
          </div>
          <button v-if="dirty" class="hidden rounded-lg border border-line/10 px-3 py-2 text-xs text-faint hover:text-red-500 md:block" @click="discardDraft">放弃修改</button>
          <button :disabled="!dirty || saveState === 'saving'" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand1/20 disabled:opacity-45" @click="save"><Save class="h-4 w-4" /><span class="hidden sm:inline">保存为新版本</span><span class="sm:hidden">保存</span></button>
        </header>

        <div class="flex min-h-0 flex-1">
          <aside class="fixed inset-x-0 bottom-0 z-30 flex max-h-[72vh] flex-col border-t border-line/10 bg-soft/98 shadow-2xl transition-transform lg:static lg:z-auto lg:max-h-none lg:w-[360px] lg:shrink-0 lg:translate-y-0 lg:border-r lg:border-t-0 lg:shadow-none" :class="mobilePanelOpen ? 'translate-y-0' : 'translate-y-[calc(100%-52px)]'">
            <button class="flex h-13 items-center justify-between border-b border-line/10 px-4 text-xs font-semibold lg:hidden" @click="mobilePanelOpen = !mobilePanelOpen"><span class="flex items-center gap-2"><PanelBottomOpen class="h-4 w-4 text-brand1" />编辑面板</span><ChevronRight class="h-4 w-4 transition" :class="mobilePanelOpen && '-rotate-90'" /></button>
            <div class="grid grid-cols-5 border-b border-line/10 p-2">
              <button v-for="panel in PANELS" :key="panel.id" class="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px]" :class="activePanel === panel.id ? 'bg-brand1/10 font-semibold text-brand1' : 'text-faint hover:bg-ink/5 hover:text-ink'" @click="activePanel = panel.id"><component :is="panel.icon" class="h-4 w-4" />{{ panel.label }}</button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <template v-if="activePanel === 'structure'">
                <div class="flex items-center justify-between"><div><h3 class="text-xs font-semibold">页面结构</h3><p class="mt-1 text-[10px] text-faint">选择、排序和管理语义区块。</p></div><button class="flex items-center gap-1 rounded-lg bg-brand1/10 px-2.5 py-1.5 text-[10px] font-semibold text-brand1" @click="addSectionOpen = !addSectionOpen"><Plus class="h-3 w-3" />添加</button></div>
                <div v-if="addSectionOpen" class="mt-3 grid gap-2 rounded-2xl border border-line/10 bg-app/45 p-3">
                  <button v-for="preset in SECTION_PRESETS" :key="preset.id" class="rounded-xl border border-line/8 bg-soft/55 p-3 text-left hover:border-brand1/25" @click="insertPreset(preset.id)"><span class="text-xs font-semibold">{{ preset.name }}</span><span class="mt-1 block text-[10px] leading-4 text-faint">{{ preset.description }}</span></button>
                </div>
                <div class="mt-4 grid gap-1.5">
                  <button v-for="section in sections" :key="section.id" class="group flex items-center gap-2 rounded-xl border p-2.5 text-left" :class="selectedSectionId === section.id ? 'border-brand1/30 bg-brand1/[0.07]' : 'border-transparent hover:border-line/10 hover:bg-ink/[0.03]'" @click="focusSection(section)"><span class="grid h-7 w-7 place-items-center rounded-lg bg-ink/5 text-faint"><Blocks class="h-3.5 w-3.5" /></span><span class="min-w-0 flex-1"><span class="block truncate text-xs font-medium" :class="section.hidden && 'line-through opacity-55'">{{ section.label }}</span><span class="mt-0.5 block text-[9px] text-faint">{{ section.tag }} · {{ section.elementCount }} 个元素</span></span><Lock v-if="section.locked" class="h-3 w-3 text-amber-500" /><EyeOff v-if="section.hidden" class="h-3 w-3 text-faint" /></button>
                </div>
                <div v-if="selectedSection" class="mt-4 rounded-2xl border border-line/10 bg-app/45 p-4">
                  <label class="text-[10px] font-semibold text-sub">区块名称<input v-model="sectionLabel" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/70 px-3 py-2 text-xs outline-none focus:border-brand1/35" /></label>
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" title="上移" @click="sectionAction('up')"><ArrowUp class="mx-auto h-4 w-4" /></button>
                    <button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" title="下移" @click="sectionAction('down')"><ArrowDown class="mx-auto h-4 w-4" /></button>
                    <button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" title="复制" @click="sectionAction('duplicate')"><Copy class="mx-auto h-4 w-4" /></button>
                    <button class="rounded-lg border border-line/10 p-2 text-faint hover:text-brand1" :title="selectedSection.hidden ? '显示' : '隐藏'" @click="sectionAction('hide')"><Eye v-if="selectedSection.hidden" class="mx-auto h-4 w-4" /><EyeOff v-else class="mx-auto h-4 w-4" /></button>
                    <button class="rounded-lg border border-line/10 p-2 text-faint hover:text-amber-500" :title="selectedSection.locked ? '解锁' : '锁定'" @click="sectionAction('lock')"><Unlock v-if="selectedSection.locked" class="mx-auto h-4 w-4" /><Lock v-else class="mx-auto h-4 w-4" /></button>
                    <button :disabled="selectedSection.locked" class="rounded-lg border border-red-500/15 p-2 text-red-500 disabled:opacity-30" title="删除" @click="sectionAction('delete')"><Trash2 class="mx-auto h-4 w-4" /></button>
                  </div>
                  <div class="mt-4 grid grid-cols-2 gap-2"><label class="text-[10px] text-faint">上下间距<input v-model="sectionStyle.padding" placeholder="80px 24px" class="mt-1 w-full rounded-lg border border-line/10 bg-soft/70 px-2.5 py-2 text-[10px] outline-none" /></label><label class="text-[10px] text-faint">背景色<input v-model="sectionStyle.backgroundColor" placeholder="#ffffff" class="mt-1 w-full rounded-lg border border-line/10 bg-soft/70 px-2.5 py-2 font-mono text-[10px] outline-none" /></label></div>
                  <button :disabled="selectedSection.locked" class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand1/10 px-3 py-2.5 text-xs font-semibold text-brand1 disabled:opacity-40" @click="applySection"><Check class="h-3.5 w-3.5" />应用区块设置</button>
                </div>
              </template>

              <template v-else-if="activePanel === 'content'">
                <div v-if="!selected" class="flex min-h-72 flex-col items-center justify-center text-center"><span class="grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]"><ChevronRight class="h-5 w-5 text-faint" /></span><h3 class="mt-4 text-sm font-medium">选择页面元素</h3><p class="mt-2 text-xs leading-6 text-faint">在预览中点击文字、图片、按钮或链接。</p></div>
                <div v-else class="space-y-4">
                  <div class="rounded-xl border border-brand1/15 bg-brand1/[0.06] p-3"><p class="text-[9px] font-semibold tracking-wider text-brand1 uppercase">当前选中</p><p class="mt-1 font-mono text-sm">&lt;{{ selected.tag }}&gt;</p><p class="mt-1 truncate text-[9px] text-faint">{{ selected.id }}</p></div>
                  <label v-if="selected.tag !== 'img'" class="block text-[10px] font-semibold text-sub">文字内容<textarea v-model="textValue" rows="6" class="mt-2 w-full resize-y rounded-xl border border-line/12 bg-app/60 p-3 text-sm leading-6 outline-none focus:border-brand1/50" /></label>
                  <template v-if="selected.tag === 'img'"><label class="block text-[10px] font-semibold text-sub"><span class="flex items-center gap-1.5"><Image class="h-3.5 w-3.5" />图片地址</span><input v-model="imageSrc" placeholder="https://… 或 data:image/…" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none" /></label><label class="block text-[10px] font-semibold text-sub">替代文字<input v-model="imageAlt" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-sm outline-none" /></label></template>
                  <template v-if="selected.tag === 'a'"><label class="block text-[10px] font-semibold text-sub"><span class="flex items-center gap-1.5"><Link2 class="h-3.5 w-3.5" />链接地址</span><input v-model="linkHref" placeholder="https://example.com 或 #section" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none" /></label><label class="block text-[10px] font-semibold text-sub">打开方式<select v-model="linkTarget" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none"><option value="_self">当前窗口</option><option value="_blank">新窗口</option></select></label></template>
                  <label class="block text-[10px] font-semibold text-sub">无障碍名称<input v-model="ariaLabel" placeholder="图标按钮或模糊链接需要填写" class="mt-2 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none" /></label>
                  <button class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" @click="applyContent"><Check class="h-4 w-4" />应用内容修改</button>
                </div>
              </template>

              <template v-else-if="activePanel === 'style'">
                <div v-if="selected" class="space-y-4">
                  <div class="flex items-center justify-between"><div><h3 class="text-xs font-semibold">元素样式</h3><p class="mt-1 text-[10px] text-faint">当前断点：{{ VIEWPORTS.find(item => item.id === viewport)?.label }}</p></div><button v-if="viewport !== 'desktop'" class="text-[10px] text-brand1" @click="clearBreakpointStyles">清除覆盖</button></div>
                  <div class="grid grid-cols-2 gap-3">
                    <label class="text-[10px] text-faint">字号<input v-model="styleDraft.fontSize" placeholder="18px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">字重<input v-model="styleDraft.fontWeight" placeholder="600" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">行高<input v-model="styleDraft.lineHeight" placeholder="1.6" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">对齐<select v-model="styleDraft.textAlign" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none"><option value="">继承</option><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
                    <label class="text-[10px] text-faint">文字颜色<input v-model="styleDraft.color" placeholder="#18181b" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 font-mono text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">背景颜色<input v-model="styleDraft.backgroundColor" placeholder="transparent" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 font-mono text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">宽度<input v-model="styleDraft.width" placeholder="100%" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">最大宽度<input v-model="styleDraft.maxWidth" placeholder="720px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">内边距<input v-model="styleDraft.padding" placeholder="16px 24px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">外边距<input v-model="styleDraft.margin" placeholder="0 auto" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">圆角<input v-model="styleDraft.borderRadius" placeholder="16px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                    <label class="text-[10px] text-faint">间距<input v-model="styleDraft.gap" placeholder="16px" class="mt-1 w-full rounded-lg border border-line/10 bg-app/55 px-2.5 py-2 text-xs outline-none" /></label>
                  </div>
                  <button class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" @click="applyElementStyles"><AlignCenter class="h-4 w-4" />应用当前断点</button>
                </div>
                <div class="mt-6 border-t border-line/10 pt-5"><h3 class="text-xs font-semibold">全局主题覆盖</h3><div class="mt-3 grid grid-cols-3 gap-2"><label class="text-[9px] text-faint">强调色<input v-model="accent" type="color" class="mt-1 h-9 w-full rounded-lg" /></label><label class="text-[9px] text-faint">背景<input v-model="background" type="color" class="mt-1 h-9 w-full rounded-lg" /></label><label class="text-[9px] text-faint">文字<input v-model="foreground" type="color" class="mt-1 h-9 w-full rounded-lg" /></label></div><select v-model="fontFamily" class="mt-3 w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs outline-none"><option value="system-ui, sans-serif">系统无衬线</option><option value="'PingFang SC','Microsoft YaHei',sans-serif">中文现代</option><option value="Georgia,'Times New Roman',serif">经典衬线</option><option value="ui-monospace,SFMono-Regular,monospace">等宽科技</option></select><button class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand1/10 px-4 py-2.5 text-xs font-semibold text-brand1" @click="applyTheme"><Palette class="h-4 w-4" />应用全局主题</button></div>
              </template>

              <SiteQualityPanel v-else-if="activePanel === 'quality'" compact :html="draft" :ignored-rules="ignoredQualityRules" @apply="applyIssue" @apply-all="applyAllIssues" @focus="focusIssue" @ignore="ignoreRule" />

              <template v-else>
                <div class="rounded-2xl border border-brand1/15 bg-brand1/[0.055] p-4"><div class="flex items-center gap-2"><WandSparkles class="h-4 w-4 text-brand1" /><h3 class="text-xs font-semibold">局部 AI 修改</h3></div><p class="mt-2 text-[10px] leading-5 text-mut">AI 会基于当前完整草稿生成一个可撤销的新方案，不会直接保存到项目。</p></div>
                <div class="mt-4 grid gap-2"><button v-for="preset in AI_PRESETS" :key="preset" :disabled="aiBusy" class="rounded-xl border border-line/10 bg-app/45 p-3 text-left text-[10px] leading-5 text-sub hover:border-brand1/25 disabled:opacity-45" @click="runAi(preset)">{{ preset }}</button></div>
                <label class="mt-4 block text-[10px] font-semibold text-sub">自定义修改指令<textarea v-model="aiInstruction" rows="5" placeholder="例如：只修改 Hero 区块，把标题改得更克制，保留当前配色和其他区块。" class="mt-2 w-full resize-y rounded-xl border border-line/12 bg-app/60 p-3 text-xs leading-5 outline-none" /></label>
                <button :disabled="!aiInstruction.trim() || aiBusy" class="bg-brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-45" @click="runAi()"><Loader2 v-if="aiBusy" class="h-4 w-4 animate-spin" /><Sparkles v-else class="h-4 w-4" />{{ aiBusy ? 'AI 正在生成方案' : '生成修改方案' }}</button>
                <div v-if="aiStream.error.value" class="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3"><p class="text-[11px] font-medium text-red-500">{{ aiStream.error.value.message }}</p><p class="mt-1 text-[10px] text-faint">{{ aiStream.error.value.hint }}</p><button v-if="lastAiInstruction" class="mt-2 text-[10px] font-semibold text-brand1" @click="runAi(lastAiInstruction)">保留草稿并重试</button></div>
                <div v-if="aiBusy" class="mt-3 rounded-xl bg-app/45 p-3"><div class="h-1.5 overflow-hidden rounded-full bg-ink/5"><div class="h-full animate-pulse rounded-full bg-brand-gradient" :style="{ width: `${Math.max(8, Math.min(94, aiStream.charCount.value / 80))}%` }" /></div><p class="mt-2 text-[9px] text-faint">已接收 {{ aiStream.charCount.value }} 字符；当前编辑草稿始终保留。</p></div>
              </template>
            </div>
          </aside>

          <main class="relative min-w-0 flex-1 overflow-auto bg-ink/[0.045] p-3 pb-16 sm:p-6 lg:pb-6">
            <div class="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px] text-line/20" />
            <div class="relative mx-auto h-full min-h-[580px] overflow-hidden rounded-xl border border-line/15 bg-white shadow-2xl shadow-black/20 transition-[max-width] duration-300" :class="viewportClass">
              <iframe ref="iframeRef" :key="previewKey" :srcdoc="previewHtml" sandbox="allow-scripts" referrerpolicy="no-referrer" class="h-full min-h-[580px] w-full" title="可视化编辑预览" />
            </div>
          </main>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.editor-enter-active,.editor-leave-active{transition:opacity .2s ease}.editor-enter-from,.editor-leave-to{opacity:0}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important}}
</style>

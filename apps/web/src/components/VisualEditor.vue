<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image,
  Link2,
  Monitor,
  Palette,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Type,
  Undo2,
  X,
} from 'lucide-vue-next'
import {
  applyThemeOverrides,
  buildEditorPreview,
  cleanEditedHtml,
  prepareEditableHtml,
  updateEditableElement,
  type EditorSelection,
} from '../lib/visualEditor'

const props = defineProps<{
  open: boolean
  html: string
  title?: string
}>()
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', html: string): void
}>()

const draft = ref('')
const selected = ref<EditorSelection | null>(null)
const textValue = ref('')
const imageSrc = ref('')
const imageAlt = ref('')
const linkHref = ref('')
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const activePanel = ref<'content' | 'theme'>('content')
const accent = ref('#8b5cf6')
const background = ref('#ffffff')
const foreground = ref('#18181b')
const fontFamily = ref('system-ui, sans-serif')
const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
const dirty = ref(false)
const previewKey = ref(0)

const previewHtml = computed(() => (draft.value ? buildEditorPreview(draft.value) : ''))
const viewportClass = computed(() => {
  if (viewport.value === 'mobile') return 'max-w-[390px]'
  if (viewport.value === 'tablet') return 'max-w-[768px]'
  return 'max-w-none'
})
const canUndo = computed(() => undoStack.value.length > 0)
const canRedo = computed(() => redoStack.value.length > 0)

function reset() {
  draft.value = prepareEditableHtml(props.html)
  selected.value = null
  textValue.value = ''
  imageSrc.value = ''
  imageAlt.value = ''
  linkHref.value = ''
  undoStack.value = []
  redoStack.value = []
  dirty.value = false
  previewKey.value += 1
}

function commit(next: string) {
  if (!next || next === draft.value) return
  undoStack.value.push(draft.value)
  if (undoStack.value.length > 50) undoStack.value.shift()
  redoStack.value = []
  draft.value = next
  dirty.value = true
  previewKey.value += 1
}

function undo() {
  const previous = undoStack.value.pop()
  if (!previous) return
  redoStack.value.push(draft.value)
  draft.value = previous
  selected.value = null
  dirty.value = true
  previewKey.value += 1
}

function redo() {
  const next = redoStack.value.pop()
  if (!next) return
  undoStack.value.push(draft.value)
  draft.value = next
  selected.value = null
  dirty.value = true
  previewKey.value += 1
}

function onMessage(event: MessageEvent) {
  if (!props.open || event.source === window) return
  const message = event.data as { source?: string; type?: string; payload?: EditorSelection }
  if (message?.source !== 'siteforge-editor' || message.type !== 'select' || !message.payload) return
  selected.value = message.payload
  textValue.value = message.payload.text ?? ''
  imageSrc.value = message.payload.src ?? ''
  imageAlt.value = message.payload.alt ?? ''
  linkHref.value = message.payload.href ?? ''
  activePanel.value = 'content'
}

function applyContent() {
  const current = selected.value
  if (!current) return
  const next = updateEditableElement(draft.value, current.id, {
    text: current.tag === 'img' ? undefined : textValue.value,
    src: current.tag === 'img' ? imageSrc.value : undefined,
    alt: current.tag === 'img' ? imageAlt.value : undefined,
    href: current.tag === 'a' ? linkHref.value : undefined,
  })
  commit(next)
  selected.value = {
    ...current,
    text: textValue.value,
    src: imageSrc.value || undefined,
    alt: imageAlt.value || undefined,
    href: linkHref.value || undefined,
  }
}

function applyTheme() {
  commit(
    applyThemeOverrides(draft.value, {
      accent: accent.value,
      background: background.value,
      text: foreground.value,
      fontFamily: fontFamily.value,
    }),
  )
}

function save() {
  emit('save', cleanEditedHtml(draft.value))
  dirty.value = false
}

function close() {
  if (dirty.value && !window.confirm('有尚未保存的编辑,确认关闭吗？')) return
  emit('close')
}

function onKey(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') close()
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    event.shiftKey ? redo() : undo()
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    save()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)
watch(
  () => props.html,
  () => {
    if (props.open && !dirty.value) reset()
  },
)

window.addEventListener('message', onMessage)
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="editor">
      <div v-if="open" class="fixed inset-0 z-[100] flex flex-col bg-app text-ink">
        <header class="flex min-h-16 items-center gap-3 border-b border-line/10 bg-soft/95 px-3 py-2 backdrop-blur sm:px-5">
          <button
            class="rounded-lg p-2 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
            aria-label="关闭编辑器"
            @click="close"
          >
            <X class="h-5 w-5" />
          </button>
          <div class="min-w-0">
            <h2 class="truncate text-sm font-semibold text-ink">{{ title || '可视化编辑' }}</h2>
            <p class="text-[11px] text-faint">点击预览中的文字、图片或链接开始编辑</p>
          </div>

          <div class="ml-auto hidden items-center gap-1 rounded-lg bg-ink/[0.04] p-1 sm:flex">
            <button
              v-for="item in [
                { id: 'desktop', icon: Monitor, label: '桌面' },
                { id: 'tablet', icon: Tablet, label: '平板' },
                { id: 'mobile', icon: Smartphone, label: '手机' },
              ]"
              :key="item.id"
              class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors"
              :class="viewport === item.id ? 'bg-soft font-medium text-ink shadow-sm' : 'text-faint hover:text-ink'"
              :title="item.label"
              @click="viewport = item.id as typeof viewport"
            >
              <component :is="item.icon" class="h-3.5 w-3.5" />
              <span class="hidden lg:inline">{{ item.label }}</span>
            </button>
          </div>

          <div class="flex items-center gap-1">
            <button
              :disabled="!canUndo"
              class="rounded-lg p-2 text-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30"
              title="撤销 (Ctrl/⌘ Z)"
              @click="undo"
            >
              <Undo2 class="h-4 w-4" />
            </button>
            <button
              :disabled="!canRedo"
              class="rounded-lg p-2 text-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-30"
              title="重做 (Ctrl/⌘ Shift Z)"
              @click="redo"
            >
              <Redo2 class="h-4 w-4" />
            </button>
          </div>

          <button
            class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand1/20 transition-all hover:brightness-110 active:scale-[0.98]"
            @click="save"
          >
            <Save class="h-4 w-4" />
            <span class="hidden sm:inline">保存为新版本</span>
            <span class="sm:hidden">保存</span>
          </button>
        </header>

        <div class="flex min-h-0 flex-1">
          <aside class="hidden w-80 shrink-0 flex-col border-r border-line/10 bg-soft/70 lg:flex">
            <div class="grid grid-cols-2 border-b border-line/10 p-2">
              <button
                class="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors"
                :class="activePanel === 'content' ? 'bg-brand1/10 font-semibold text-brand1' : 'text-mut hover:bg-ink/5'"
                @click="activePanel = 'content'"
              >
                <Type class="h-3.5 w-3.5" />
                内容
              </button>
              <button
                class="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-colors"
                :class="activePanel === 'theme' ? 'bg-brand1/10 font-semibold text-brand1' : 'text-mut hover:bg-ink/5'"
                @click="activePanel = 'theme'"
              >
                <Palette class="h-3.5 w-3.5" />
                主题
              </button>
            </div>

            <div v-if="activePanel === 'content'" class="min-h-0 flex-1 overflow-y-auto p-5">
              <div v-if="!selected" class="flex h-full min-h-64 flex-col items-center justify-center text-center">
                <span class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]">
                  <ChevronRight class="h-5 w-5 text-faint" />
                </span>
                <h3 class="mt-4 text-sm font-medium text-ink">选择一个页面元素</h3>
                <p class="mt-2 text-xs leading-6 text-faint">将鼠标移到预览中,紫色轮廓表示可编辑内容。</p>
              </div>

              <div v-else class="space-y-5">
                <div class="rounded-xl border border-brand1/15 bg-brand1/[0.06] p-3">
                  <p class="text-[10px] font-medium tracking-wider text-brand1 uppercase">当前选中</p>
                  <p class="mt-1 font-mono text-sm text-ink">&lt;{{ selected.tag }}&gt;</p>
                  <p class="mt-1 truncate text-xs text-faint">{{ selected.id }}</p>
                </div>

                <div v-if="selected.tag !== 'img'">
                  <label class="mb-2 block text-xs font-medium text-sub">文字内容</label>
                  <textarea
                    v-model="textValue"
                    rows="6"
                    class="w-full resize-y rounded-xl border border-line/12 bg-app/60 p-3 text-sm leading-6 text-ink outline-none focus:border-brand1/50"
                  />
                </div>

                <template v-if="selected.tag === 'img'">
                  <div>
                    <label class="mb-2 flex items-center gap-1.5 text-xs font-medium text-sub">
                      <Image class="h-3.5 w-3.5" />图片地址
                    </label>
                    <input
                      v-model="imageSrc"
                      type="url"
                      placeholder="https://… 或 data:image/…"
                      class="w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs text-ink outline-none focus:border-brand1/50"
                    />
                  </div>
                  <div>
                    <label class="mb-2 block text-xs font-medium text-sub">替代文字</label>
                    <input
                      v-model="imageAlt"
                      class="w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/50"
                    />
                  </div>
                </template>

                <div v-if="selected.tag === 'a'">
                  <label class="mb-2 flex items-center gap-1.5 text-xs font-medium text-sub">
                    <Link2 class="h-3.5 w-3.5" />链接地址
                  </label>
                  <input
                    v-model="linkHref"
                    placeholder="https://example.com 或 #section"
                    class="w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-xs text-ink outline-none focus:border-brand1/50"
                  />
                </div>

                <button
                  class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  @click="applyContent"
                >
                  <Check class="h-4 w-4" />
                  应用修改
                </button>
              </div>
            </div>

            <div v-else class="min-h-0 flex-1 overflow-y-auto p-5">
              <div class="space-y-5">
                <div>
                  <label class="mb-2 block text-xs font-medium text-sub">品牌强调色</label>
                  <div class="flex items-center gap-3 rounded-xl border border-line/10 bg-app/45 p-2.5">
                    <input v-model="accent" type="color" class="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" />
                    <input v-model="accent" class="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" />
                  </div>
                </div>
                <div>
                  <label class="mb-2 block text-xs font-medium text-sub">页面背景</label>
                  <div class="flex items-center gap-3 rounded-xl border border-line/10 bg-app/45 p-2.5">
                    <input v-model="background" type="color" class="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" />
                    <input v-model="background" class="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" />
                  </div>
                </div>
                <div>
                  <label class="mb-2 block text-xs font-medium text-sub">正文颜色</label>
                  <div class="flex items-center gap-3 rounded-xl border border-line/10 bg-app/45 p-2.5">
                    <input v-model="foreground" type="color" class="h-9 w-12 cursor-pointer rounded-lg border-0 bg-transparent" />
                    <input v-model="foreground" class="min-w-0 flex-1 bg-transparent font-mono text-xs text-ink outline-none" />
                  </div>
                </div>
                <div>
                  <label class="mb-2 block text-xs font-medium text-sub">字体</label>
                  <select
                    v-model="fontFamily"
                    class="w-full rounded-xl border border-line/12 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/50"
                  >
                    <option value="system-ui, sans-serif">系统无衬线</option>
                    <option value="'PingFang SC','Microsoft YaHei',sans-serif">中文现代</option>
                    <option value="Georgia,'Times New Roman',serif">经典衬线</option>
                    <option value="ui-monospace,SFMono-Regular,monospace">等宽科技</option>
                  </select>
                </div>
                <button
                  class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  @click="applyTheme"
                >
                  <Palette class="h-4 w-4" />
                  应用主题
                </button>
                <p class="text-[11px] leading-5 text-faint">优先覆盖常见 CSS 变量,同时为 body 提供安全回退,不会删除原有样式。</p>
              </div>
            </div>
          </aside>

          <main class="relative min-w-0 flex-1 overflow-auto bg-ink/[0.045] p-3 sm:p-6">
            <div class="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px] text-line/20" />
            <div
              class="relative mx-auto h-full min-h-[580px] overflow-hidden rounded-xl border border-line/15 bg-white shadow-2xl shadow-black/20 transition-[max-width] duration-300"
              :class="viewportClass"
            >
              <iframe
                :key="previewKey"
                :srcdoc="previewHtml"
                sandbox="allow-scripts"
                referrerpolicy="no-referrer"
                class="h-full min-h-[580px] w-full"
                title="可视化编辑预览"
              />
            </div>
          </main>
        </div>

        <div class="flex items-center justify-between border-t border-line/10 bg-soft/95 px-3 py-2 text-[11px] text-faint lg:hidden">
          <span>{{ dirty ? '有未保存修改' : '当前版本未修改' }}</span>
          <div class="flex gap-2">
            <button class="flex items-center gap-1 rounded-lg border border-line/10 px-2.5 py-1.5" @click="activePanel = 'content'">
              <ChevronLeft class="h-3 w-3" />点选元素后请使用桌面端编辑面板
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.editor-enter-active,
.editor-leave-active { transition: opacity 0.2s ease; }
.editor-enter-from,
.editor-leave-to { opacity: 0; }
</style>

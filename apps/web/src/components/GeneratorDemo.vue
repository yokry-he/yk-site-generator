<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  BrainCircuit,
  LayoutTemplate,
  Blocks,
  PenLine,
  CheckCircle2,
  Play,
  RotateCcw,
  PencilRuler,
  Lock,
  Loader2,
  Plug,
  Info,
  Wand2,
  FileArchive,
  History,
  Square,
  MonitorSmartphone,
  Smartphone,
  ExternalLink,
  Copy,
  Download,
  AlertTriangle,
  XCircle,
} from 'lucide-vue-next'
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODES,
  artifactToSingleHtml,
  getGenerationModeProfile,
  parseModelOutput,
  type ArtifactMeta,
  type GenerationMode,
} from 'shared'
import AppSelect from './AppSelect.vue'
import SectionHeading from './SectionHeading.vue'
import MockSite from './MockSite.vue'
import TemplateGen from './TemplateGen.vue'
import HistoryPanel from './HistoryPanel.vue'
import { SITE_TYPES, TYPE_GROUPS, typeById } from '../data/siteTypes'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'
import { useToast } from '../composables/useToast'
import { useGenerateStream, GENERATE_STAGES } from '../composables/useGenerateStream'
import { extractPartialHtml } from '../lib/generate'
import {
  isQuotaError,
  newSessionId,
  recordToSession,
  sessionToRecord,
  titleFromRequirement,
  upsertSession,
  type StoredSession,
} from '../lib/historyStore'
import {
  addRound,
  backToRound,
  canViewNext,
  canViewPrev,
  createSession,
  currentRound,
  isLargeArtifact,
  isViewingCurrent,
  nextRoundNumber,
  viewNext,
  viewPrev,
  viewingRound,
  type IterationSession,
} from '../lib/iterationSession'

const props = defineProps<{ prompt: string }>()
const emit = defineEmits<{
  (e: 'update:prompt', v: string): void
  (e: 'artifact', html: string): void
  (e: 'site-type', value: string): void
  (e: 'recovery', visible: boolean): void
  (e: 'edit-artifact'): void
}>()

/** web 类型 id → prompts 包站点类型 id(不一致的做映射) */
const SITE_TYPE_MAP: Record<string, string> = { business: 'corporate' }

const DEMO_STEPS = [
  { icon: BrainCircuit, label: '分析需求' },
  { icon: LayoutTemplate, label: '规划页面结构' },
  { icon: Blocks, label: '生成组件' },
  { icon: PenLine, label: '填充内容' },
  { icon: CheckCircle2, label: '完成' },
]
const REAL_STEP_ICONS = [Plug, BrainCircuit, Blocks, PenLine, CheckCircle2]

const { activeProvider, activeConnection } = useModelConfig()
const { show: showModelSettings } = useModelDialog()
const toast = useToast()
const stream = useGenerateStream()

const tab = ref<'ai' | 'template'>('ai')
const typeId = ref('portfolio')
const logs = ref<string[]>([])
const logBoxRef = ref<HTMLElement>()
const previewWidth = ref<'desktop' | 'mobile'>('desktop')
const GENERATION_MODE_STORAGE_KEY = 'siteforge:generation-mode-v1'
const savedGenerationMode = localStorage.getItem(GENERATION_MODE_STORAGE_KEY)
const generationMode = ref<GenerationMode>(
  GENERATION_MODES.some((item) => item.id === savedGenerationMode)
    ? savedGenerationMode as GenerationMode
    : DEFAULT_GENERATION_MODE,
)
const generationModeProfile = computed(() => getGenerationModeProfile(generationMode.value))
watch(generationMode, (value) => localStorage.setItem(GENERATION_MODE_STORAGE_KEY, value))

const typeName = computed(() => typeById(typeId.value)?.name ?? '网站')
const typeIcon = computed(() => typeById(typeId.value)?.icon)
const typeGroups = computed(() =>
  TYPE_GROUPS.map((g) => ({
    label: g,
    options: SITE_TYPES.filter((t) => t.group === g).map((t) => ({ value: t.id, label: t.name })),
  })),
)

/** 未接入模型 → 演示模式(保留模拟动画与静态 mock) */
const isDemo = computed(() => !activeProvider.value || !activeConnection.value)

/* ============ 演示模式(原有模拟) ============ */
const demoPhase = ref<'idle' | 'generating' | 'done'>('idle')
const demoStepIndex = ref(-1)
let cancelled = false
let timers: ReturnType<typeof setTimeout>[] = []

function clearTimers() {
  cancelled = true
  timers.forEach(clearTimeout)
  timers = []
}

function startDemo() {
  clearTimers()
  cancelled = false
  demoPhase.value = 'generating'
  logs.value = []
  demoStepIndex.value = 0
  const lines = [
    '正在解析你的描述,提取关键词、风格偏好与目标受众……',
    `为「${typeName.value}」规划信息架构:导航、首屏、内容区块与页脚……`,
    '调用组件库,生成卡片、表单、图表等 18 个 UI 组件……',
    '撰写标题与正文文案,填充配色、配图与示例数据……',
    '样式校验通过,响应式适配完成,网站已就绪 ✓',
  ]
  let li = 0
  const typeLine = () => {
    if (cancelled) return
    const line = lines[li]
    let ci = 0
    logs.value.push('')
    demoStepIndex.value = li
    const tick = () => {
      if (cancelled) return
      ci += 1
      logs.value[li] = line.slice(0, ci)
      if (ci < line.length) timers.push(setTimeout(tick, 14))
      else {
        li += 1
        if (li < lines.length) timers.push(setTimeout(typeLine, 520))
        else {
          demoStepIndex.value = lines.length
          timers.push(setTimeout(() => !cancelled && (demoPhase.value = 'done'), 650))
        }
      }
    }
    tick()
  }
  timers.push(setTimeout(typeLine, 250))
}

/* ============ 真实生成(SSE) ============ */
const phase = computed<'idle' | 'generating' | 'done' | 'error'>(() => {
  if (isDemo.value) {
    // 演示模式下从历史恢复的会话也可查看产物
    return session.value.rounds.length > 0 ? 'done' : demoPhase.value
  }
  switch (stream.phase.value) {
    case 'connecting':
    case 'streaming':
      return 'generating'
    case 'parsing':
    case 'done':
      return 'done'
    case 'error':
      return 'error'
    default:
      // 流空闲但有会话轮次(从历史恢复)→ 预览态
      return session.value.rounds.length > 0 ? 'done' : 'idle'
  }
})

const steps = computed(() =>
  isDemo.value
    ? DEMO_STEPS
    : GENERATE_STAGES.map((label, i) => ({ icon: REAL_STEP_ICONS[i], label })),
)
const stepIndex = computed(() => (isDemo.value ? demoStepIndex.value : stream.stageIndex.value))

/** 日志区:演示=打字机;真实=token 流回显(截断最近 N 字符) */
const logText = computed(() => {
  if (isDemo.value) return null
  const t = stream.text.value
  return t.length > 2000 ? `……${t.slice(-2000)}` : t
})

function formatDuration(value?: number | null): string {
  if (value === undefined || value === null) return ''
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`
}

const performanceSummary = computed(() => {
  const value = stream.performance.value
  if (!value) return ''
  const parts = [
    value.firstTokenMs === undefined || value.firstTokenMs === null ? '' : `首 token ${formatDuration(value.firstTokenMs)}`,
    value.durationMs ? `总耗时 ${formatDuration(value.durationMs)}` : '',
    value.outputChars ? `${(value.outputChars / 1024).toFixed(1)} KB` : '',
  ]
  return parts.filter(Boolean).join(' · ')
})

/** 流式预览 HTML(生成中增量渲染;浏览器自带未闭合标签容错) */
const partialHtml = computed(() => extractPartialHtml(stream.text.value))

/** 完成后:前端用 shared 再解析一次,合成产物单 HTML */
const finalHtml = computed(() => {
  if (isDemo.value || !stream.text.value) return null
  if (stream.phase.value !== 'done' && !stream.stopped.value) return null
  const parsed = parseModelOutput(stream.text.value)
  if (!parsed) return null
  const meta: ArtifactMeta = {
    id: `web-${Date.now()}`,
    siteType: SITE_TYPE_MAP[typeId.value] ?? typeId.value,
    title: `${typeName.value} · AI 生成`,
    requirement: props.prompt,
    createdAt: new Date().toISOString(),
    iteration: 1,
  }
  try {
    return artifactToSingleHtml(parsed.tree, meta)
  } catch {
    return null
  }
})

/** 预览框实际渲染内容:生成中→增量 HTML;完成→查看轮的产物(初次则刚解析的产物) */
const previewHtml = computed(() => {
  if (isDemo.value && session.value.rounds.length === 0) return null
  if (phase.value === 'generating') return partialHtml.value
  return viewing.value?.html ?? finalHtml.value ?? partialHtml.value
})

/** 解析失败(仅初次生成):有完整输出但无法解析为产物;迭代失败走 toast 并保留上一版 */
const parseFailed = computed(
  () =>
    !isDemo.value &&
    (stream.phase.value === 'done' || stream.stopped.value) &&
    stream.text.value.length > 0 &&
    !finalHtml.value &&
    session.value.rounds.length === 0,
)

watch(previewHtml, (html) => emit('artifact', html ?? ''), { immediate: true })
watch(typeId, (value) => emit('site-type', value), { immediate: true })
watch([phase, stream.canRetry], () => {
  emit('recovery', phase.value === 'error' && stream.canRetry.value)
}, { immediate: true })

/* ============ 迭代会话(SF-1-6)与历史持久化(SF-1-7) ============ */
const session = ref<IterationSession>(createSession())
const instructionInput = ref('')
/** 当前这次流式生成对应的指令(初生成=需求,迭代=修改意见) */
let pendingInstruction = ''
const historyOpen = ref(false)
/** 当前会话的持久化标识(首轮落库时创建) */
const currentSessionId = ref<string | null>(null)
const sessionCreatedAt = ref<string | null>(null)

/** 生成/迭代完成后自动保存(upsert 当前会话) */
async function persistSession() {
  if (isDemo.value || session.value.rounds.length === 0) return
  try {
    if (!currentSessionId.value) {
      currentSessionId.value = newSessionId()
      sessionCreatedAt.value = new Date().toISOString()
    }
    const rec = sessionToRecord(
      {
        id: currentSessionId.value,
        title: titleFromRequirement(session.value.rounds[0].instruction),
        siteType: typeId.value,
        requirement: props.prompt,
        provider: activeProvider.value?.id,
        model: activeConnection.value?.model,
        createdAt: sessionCreatedAt.value ?? new Date().toISOString(),
      },
      session.value,
    )
    await upsertSession(rec)
  } catch (err) {
    if (isQuotaError(err)) {
      toast.error('存储空间不足', '历史会话未能保存:浏览器本地存储已满,请在「生成历史」中清理后重试。')
    }
  }
}

/** 从历史面板恢复完整会话(含全部轮次与基底轮) */
function restoreSession(rec: StoredSession) {
  historyOpen.value = false
  typeId.value = rec.siteType
  emit('update:prompt', rec.requirement)
  session.value = recordToSession(rec)
  currentSessionId.value = rec.id
  sessionCreatedAt.value = rec.createdAt
  stream.reset()
  toast.success('已恢复会话', `「${rec.title}」共 ${rec.rounds.length} 轮,可继续迭代。`)
}

const viewing = computed(() => viewingRound(session.value))
const base = computed(() => currentRound(session.value))
const viewPrevDisabled = computed(() => !canViewPrev(session.value))
const viewNextDisabled = computed(() => !canViewNext(session.value))
const viewingIsBase = computed(() => isViewingCurrent(session.value))
const baseIsLarge = computed(() => (base.value ? isLargeArtifact(base.value.html) : false))

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

/** 流结束时把产物落为一轮(解析失败:初次→原始输出 UI;迭代→toast 并保留上一版) */
watch(
  () => stream.phase.value,
  (p) => {
    if (isDemo.value) return
    if (p === 'done' || (p === 'parsing' && stream.stopped.value)) {
      const html = finalHtml.value
      if (html) {
        session.value = addRound(session.value, {
          instruction: pendingInstruction || props.prompt,
          html,
          time: new Date().toISOString(),
          model: activeConnection.value?.model ?? '',
          fileCount: stream.parseSummary.value?.fileCount,
          stopped: stream.stopped.value || undefined,
        })
        void persistSession()
      } else if (session.value.rounds.length > 0) {
        toast.error('迭代解析失败', '已保留上一版产物,可调整指令后重新发送。')
      }
    }
  },
)

function sendIteration() {
  const instruction = instructionInput.value.trim()
  const b = base.value
  if (!instruction || !b || stream.isActive.value) return
  if (isLargeArtifact(b.html)) {
    toast.info('产物较大', '当前产物接近 maxTokens 上限,迭代输出可能被截断;建议分步修改。')
  }
  pendingInstruction = instruction
  instructionInput.value = ''
  const conn = activeConnection.value!
  void stream.start({
    provider: activeProvider.value!.id,
    model: conn.model,
    apiKey: conn.apiKey,
    baseUrl: conn.baseUrl || undefined,
    siteType: SITE_TYPE_MAP[typeId.value] ?? typeId.value,
    mode: generationMode.value,
    maxTokens: generationModeProfile.value.maxTokens,
    requirement: props.prompt.trim(),
    history: [{ instruction, artifact: b.html, round: nextRoundNumber(session.value) }],
  })
}

/** 「基于此轮重新生成」:同指令重发(第 1 轮则按初始需求重发) */
function regenerateFromBase() {
  const b = base.value
  if (!b || stream.isActive.value) return
  if (b.round === 1) {
    regenerate()
    return
  }
  pendingInstruction = b.instruction
  const conn = activeConnection.value!
  void stream.start({
    provider: activeProvider.value!.id,
    model: conn.model,
    apiKey: conn.apiKey,
    baseUrl: conn.baseUrl || undefined,
    siteType: SITE_TYPE_MAP[typeId.value] ?? typeId.value,
    mode: generationMode.value,
    maxTokens: generationModeProfile.value.maxTokens,
    requirement: props.prompt.trim(),
    history: [{ instruction: b.instruction, artifact: b.html, round: nextRoundNumber(session.value) }],
  })
}

function start() {
  if (!props.prompt.trim()) {
    toast.error('请先描述你想要的网站', '在左侧输入一句话需求,或从首页快捷标签中选择。')
    return
  }
  if (isDemo.value) {
    session.value = createSession()
    currentSessionId.value = null
    sessionCreatedAt.value = null
    startDemo()
    return
  }
  clearTimers()
  session.value = createSession() // 初次生成 = 全新会话
  currentSessionId.value = null
  sessionCreatedAt.value = null
  pendingInstruction = props.prompt.trim()
  const conn = activeConnection.value!
  void stream.start({
    provider: activeProvider.value!.id,
    model: conn.model,
    apiKey: conn.apiKey,
    baseUrl: conn.baseUrl || undefined,
    siteType: SITE_TYPE_MAP[typeId.value] ?? typeId.value,
    mode: generationMode.value,
    maxTokens: generationModeProfile.value.maxTokens,
    requirement: props.prompt.trim(),
  })
}

function regenerate() {
  stream.reset()
  start()
}

function retryGeneration() {
  if (stream.canRetry.value) void stream.retryLast()
  else regenerate()
}

defineExpose({ retryGeneration })

async function copyHtml() {
  const html = previewHtml.value
  if (!html) {
    toast.error('暂无可复制的内容', '请先生成网站。')
    return
  }
  try {
    await navigator.clipboard.writeText(html)
    toast.success('已复制 HTML', `${(html.length / 1024).toFixed(1)} KB 已复制到剪贴板。`)
  } catch {
    toast.error('复制失败', '浏览器拒绝了剪贴板访问,请改用「新标签打开」后手动复制。')
  }
}

function openInNewTab() {
  const html = previewHtml.value
  if (!html) return
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  window.open(url, '_blank', 'noopener')
}

function downloadHtml() {
  const html = previewHtml.value
  if (!html) return
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${typeId.value}-site.html`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('已导出 HTML', a.download)
}

watch([logs, () => stream.text.value], () => {
  const box = logBoxRef.value
  if (box) box.scrollTop = box.scrollHeight
})

onBeforeUnmount(() => {
  clearTimers()
  stream.stop()
})
</script>

<template>
  <section id="demo" class="relative scroll-mt-20 py-24">
    <div class="glow-brand1 pointer-events-none absolute top-0 left-1/2 h-80 w-[720px] -translate-x-1/2 rounded-full blur-[140px]" />
    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="在线体验"
        title="亲眼看看,一句话如何变成网站"
        desc="输入需求、选择类型,观看 AI 的生成过程;也可以上传模板压缩包,用变量替换批量生成项目。"
      />

      <!-- Tab 切换 -->
      <div class="mt-10 flex items-center justify-center">
        <div class="flex h-11 items-center rounded-full border border-line/10 bg-ink/[0.05] p-1">
          <button
            class="flex h-full items-center rounded-full px-5 text-sm transition-all"
            :class="tab === 'ai' ? 'bg-soft font-semibold text-ink shadow' : 'text-mut hover:text-ink'"
            @click="tab = 'ai'"
          >
            <Wand2 class="mr-1.5 h-4 w-4" />
            AI 生成
          </button>
          <button
            class="flex h-full items-center rounded-full px-5 text-sm transition-all"
            :class="tab === 'template' ? 'bg-soft font-semibold text-ink shadow' : 'text-mut hover:text-ink'"
            @click="tab = 'template'"
          >
            <FileArchive class="mr-1.5 h-4 w-4" />
            模板生成
          </button>
        </div>
        <button
          class="ml-3 flex h-11 items-center gap-1.5 rounded-full border border-line/10 bg-ink/[0.05] px-4 text-sm text-mut transition-colors hover:text-ink"
          title="查看生成历史(本地保存)"
          @click="historyOpen = true"
        >
          <History class="h-4 w-4" />
          历史
        </button>
      </div>

      <!-- ============ AI 生成 ============ -->
      <div v-show="tab === 'ai'" class="mt-8">
        <!-- 模型状态横幅 -->
        <div class="mb-6 flex flex-wrap items-center justify-center gap-2">
          <p
            v-if="!isDemo"
            class="flex items-center gap-2 rounded-full border border-line/10 bg-ink/[0.04] px-4 py-2 text-xs text-sub"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-400" />
            当前模型:{{ activeProvider!.name }} · {{ activeConnection!.model }}
            <button class="ml-1 text-brand1 underline-offset-2 hover:underline" @click="showModelSettings">
              更换
            </button>
          </p>
          <p
            v-else
            class="flex flex-wrap items-center justify-center gap-2 rounded-full border border-brand2/25 bg-brand2/[0.07] px-4 py-2 text-xs text-mut"
          >
            <Info class="h-3.5 w-3.5 text-brand2" />
            <span class="font-medium text-brand2">演示模式</span>
            当前为模拟生成,接入模型后可真实生成
            <button
              class="flex items-center gap-1 font-medium text-sub underline-offset-2 hover:underline"
              @click="showModelSettings"
            >
              <Plug class="h-3 w-3" />
              去接入
            </button>
          </p>
        </div>

        <div class="grid gap-6 lg:grid-cols-5">
          <!-- 左侧:需求输入 -->
          <div class="rounded-2xl border border-line/10 bg-soft/60 p-6 lg:col-span-2">
            <label class="mb-2 block text-sm font-medium text-sub">描述你的需求</label>
            <textarea
              :value="prompt"
              rows="4"
              placeholder="例如:一个深色极简的摄影师作品集,瀑布流照片墙,支持按系列分类……"
              class="w-full resize-none rounded-xl border border-line/12 bg-app/60 p-3.5 text-sm leading-relaxed text-ink outline-none placeholder:text-faint focus:border-brand1/50"
              @input="emit('update:prompt', ($event.target as HTMLTextAreaElement).value)"
            />

            <label class="mt-5 mb-2 block text-sm font-medium text-sub">选择站点类型</label>
            <AppSelect v-model="typeId" :groups="typeGroups" placeholder="选择类型">
              <template #prefix>
                <component :is="typeIcon" v-if="typeIcon" class="h-4 w-4 shrink-0 text-brand1" />
              </template>
            </AppSelect>

            <label class="mt-5 mb-2 block text-sm font-medium text-sub">生成策略</label>
            <div class="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <button
                v-for="item in GENERATION_MODES"
                :key="item.id"
                type="button"
                class="rounded-xl border px-3 py-3 text-left transition"
                :class="generationMode === item.id ? 'border-brand1/35 bg-brand1/[0.08] ring-2 ring-brand1/8' : 'border-line/10 bg-app/45 hover:border-brand1/20'"
                @click="generationMode = item.id"
              >
                <span class="block text-xs font-semibold" :class="generationMode === item.id ? 'text-brand1' : 'text-ink'">{{ item.label }}</span>
                <span class="mt-1 block text-[9px] leading-4 text-faint">{{ item.description }}</span>
              </button>
            </div>
            <p class="mt-2 text-[10px] leading-5 text-faint">
              {{ generationModeProfile.sectionGuidance }} · {{ generationModeProfile.outputTarget }} · 最大 {{ generationModeProfile.maxTokens }} tokens
            </p>

            <div class="mt-6 flex gap-2">
              <button
                :disabled="phase === 'generating'"
                class="bg-brand-gradient flex flex-1 items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand1/30 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                @click="start"
              >
                <Loader2 v-if="phase === 'generating'" class="h-4 w-4 animate-spin" />
                <Play v-else class="h-4 w-4" />
                {{ phase === 'generating' ? '正在生成……' : '开始生成' }}
              </button>
              <button
                v-if="!isDemo && phase === 'generating'"
                class="flex items-center gap-1.5 rounded-xl border border-red-500/30 px-4 py-3.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
                @click="stream.stop"
              >
                <Square class="h-4 w-4" />
                停止
              </button>
            </div>
          </div>

          <!-- 右侧:浏览器预览 -->
          <div class="overflow-hidden rounded-2xl border border-line/10 bg-soft/60 lg:col-span-3">
            <!-- 浏览器标题栏 -->
            <div class="flex items-center gap-3 border-b border-line/10 bg-app/70 px-4 py-3">
              <div class="flex gap-1.5">
                <span v-for="i in 3" :key="i" class="h-3 w-3 rounded-full bg-line/25" />
              </div>
              <div class="flex flex-1 items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs text-faint">
                <Lock class="h-3 w-3" />
                {{ phase === 'done' ? `siteforge.app/preview/${typeId}` : 'siteforge.app/preview' }}
              </div>
              <!-- 预览工具条(真实模式且已有内容时) -->
              <div v-if="!isDemo && previewHtml" class="flex items-center gap-1">
                <button
                  class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                  :class="previewWidth === 'desktop' && 'bg-ink/10 text-ink'"
                  title="桌面宽度"
                  @click="previewWidth = 'desktop'"
                >
                  <MonitorSmartphone class="h-3.5 w-3.5" />
                </button>
                <button
                  class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                  :class="previewWidth === 'mobile' && 'bg-ink/10 text-ink'"
                  title="移动宽度"
                  @click="previewWidth = 'mobile'"
                >
                  <Smartphone class="h-3.5 w-3.5" />
                </button>
                <button
                  class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                  title="在新标签页打开"
                  @click="openInNewTab"
                >
                  <ExternalLink class="h-3.5 w-3.5" />
                </button>
                <button
                  class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                  title="复制 HTML"
                  @click="copyHtml"
                >
                  <Copy class="h-3.5 w-3.5" />
                </button>
                <button
                  class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                  title="导出 HTML"
                  @click="downloadHtml"
                >
                  <Download class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              class="relative"
              :class="phase === 'done' && !isDemo && session.rounds.length > 0 ? 'h-[480px] sm:h-[560px]' : 'h-[380px] sm:h-[420px]'"
            >
              <!-- 待机态 -->
              <div v-if="phase === 'idle'" class="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]">
                  <Play class="h-6 w-6 text-faint" />
                </div>
                <p class="text-sm text-faint">填写需求并点击「开始生成」</p>
                <p class="text-xs text-mut">AI 将在这里实时构建你的网站</p>
              </div>

              <!-- 生成过程 -->
              <div v-else-if="phase === 'generating'" class="grid h-full gap-0 sm:grid-cols-[180px_1fr]">
                <!-- 步骤指示 -->
                <div class="hidden flex-col justify-center gap-4 border-r border-line/10 bg-app/50 px-5 sm:flex">
                  <div v-for="(s, i) in steps" :key="s.label" class="flex items-center gap-2.5">
                    <CheckCircle2 v-if="i < stepIndex" class="h-4.5 w-4.5 shrink-0 text-emerald-500" />
                    <Loader2 v-else-if="i === stepIndex" class="h-4.5 w-4.5 shrink-0 animate-spin text-brand1" />
                    <component :is="s.icon" v-else class="h-4.5 w-4.5 shrink-0 text-faint" />
                    <span
                      class="text-xs"
                      :class="i < stepIndex ? 'text-mut' : i === stepIndex ? 'font-medium text-ink' : 'text-faint'"
                    >
                      {{ s.label }}
                    </span>
                  </div>
                  <p v-if="!isDemo && stream.tokenCount.value > 0" class="mt-2 text-[10px] leading-5 text-faint">
                    已接收 {{ stream.tokenCount.value }} 分片 / {{ stream.charCount.value }} 字符<br>
                    {{ generationModeProfile.label }}<template v-if="stream.performance.value?.firstTokenMs != null"> · 首 token {{ formatDuration(stream.performance.value.firstTokenMs) }}</template>
                  </p>
                </div>
                <!-- 日志输出 -->
                <div ref="logBoxRef" class="overflow-y-auto p-5 font-mono text-xs leading-loose">
                  <p class="mb-2 text-faint">
                    $ siteforge generate --type {{ typeId }}{{ isDemo ? ' --demo' : '' }}
                  </p>
                  <template v-if="isDemo">
                    <p
                      v-for="(line, i) in logs"
                      :key="i"
                      :class="i === logs.length - 1 ? 'typing-caret text-brand2' : 'text-mut'"
                    >
                      <span class="mr-2 text-brand1">▸</span>
                      {{ line }}
                    </p>
                  </template>
                  <pre v-else class="typing-caret text-mut break-all whitespace-pre-wrap">{{ logText ?? '正在连接模型服务……' }}</pre>
                </div>
              </div>

              <!-- 错误态 -->
              <div v-else-if="phase === 'error'" class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <XCircle class="h-10 w-10 text-red-500" />
                <p class="text-sm font-medium text-ink">{{ stream.error.value?.message ?? '生成失败' }}</p>
                <p class="text-xs text-faint">{{ stream.error.value?.hint }}</p>
                <div class="mt-2 flex gap-2">
                  <button
                    v-if="stream.error.value?.action === 'openModelSettings'"
                    class="flex items-center gap-1.5 rounded-lg border border-line/12 bg-ink/5 px-3.5 py-2 text-xs font-medium text-sub transition-colors hover:bg-ink/10"
                    @click="showModelSettings"
                  >
                    <Plug class="h-3.5 w-3.5" />
                    打开模型设置
                  </button>
                  <button
                    class="bg-brand-gradient flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-md transition-transform hover:scale-[1.03] active:scale-95"
                    @click="regenerate"
                  >
                    <RotateCcw class="h-3.5 w-3.5" />
                    重试
                  </button>
                </div>
              </div>

              <!-- 完成/预览态 -->
              <div v-else class="animate-fade-in flex h-full flex-col">
                <div class="min-h-0 flex-1 p-3">
                  <!-- 演示模式:静态 CSS mock 降级保留(恢复的历史会话除外,直接看产物) -->
                  <div v-if="isDemo && session.rounds.length === 0" class="h-full overflow-hidden rounded-lg border border-line/15 shadow-2xl shadow-black/20">
                    <MockSite :type="typeId" />
                  </div>
                  <!-- 真实模式:解析失败 → 原始输出 + 重试 -->
                  <div v-else-if="parseFailed" class="flex h-full flex-col overflow-hidden rounded-lg border border-amber-500/25 bg-amber-500/[0.04]">
                    <p class="flex items-center gap-1.5 border-b border-amber-500/20 px-3 py-2 text-xs text-amber-600">
                      <AlertTriangle class="h-3.5 w-3.5" />
                      解析失败:模型输出无法解析为网站产物,以下为原始输出,可重试
                    </p>
                    <pre class="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-mut">{{ stream.text.value.slice(0, 4000) }}</pre>
                  </div>
                  <!-- 真实模式:产物本体 iframe(增量或最终) -->
                  <div
                    v-else-if="previewHtml"
                    class="mx-auto h-full overflow-hidden rounded-lg border border-line/15 bg-white shadow-2xl shadow-black/20 transition-all"
                    :style="previewWidth === 'mobile' ? 'max-width: 390px' : 'width: 100%'"
                  >
                    <iframe
                      :srcdoc="previewHtml"
                      sandbox="allow-scripts"
                      referrerpolicy="no-referrer"
                      class="h-full w-full"
                      title="生成产物预览"
                    />
                  </div>
                  <!-- 已停止但无 HTML / 等待内容 -->
                  <div v-else class="flex h-full flex-col items-center justify-center gap-2 text-center">
                    <Loader2 class="h-5 w-5 animate-spin text-faint" />
                    <p class="text-xs text-faint">等待 HTML 内容……</p>
                  </div>
                </div>
                <!-- 迭代面板:修改意见输入 + 轮次信息(真实模式且已有轮次) -->
                <div v-if="!isDemo && session.rounds.length > 0" class="border-t border-line/10 bg-app/60 px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <input
                      v-model="instructionInput"
                      type="text"
                      placeholder="修改意见,如:把配色改成暖色系,首页加一个 FAQ 区块"
                      class="min-w-0 flex-1 rounded-lg border border-line/12 bg-app/80 px-3 py-2 text-xs text-ink outline-none placeholder:text-faint focus:border-brand1/50"
                      @keyup.enter="sendIteration"
                    />
                    <button
                      :disabled="!instructionInput.trim() || stream.isActive.value"
                      class="bg-brand-gradient flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      @click="sendIteration"
                    >
                      <Wand2 class="h-3.5 w-3.5" />
                      发送
                    </button>
                  </div>
                  <p v-if="baseIsLarge" class="mt-1.5 flex items-center gap-1 text-[10px] text-amber-600">
                    <AlertTriangle class="h-3 w-3" />
                    当前产物较大,迭代输出可能接近 maxTokens 上限被截断,建议分步修改
                  </p>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 bg-app/50 px-4 py-3">
                  <!-- 轮次导航与信息 -->
                  <div v-if="!isDemo && viewing" class="flex flex-wrap items-center gap-2 text-xs text-mut">
                    <div class="flex items-center gap-1">
                      <button
                        :disabled="viewPrevDisabled"
                        class="rounded-md border border-line/12 px-1.5 py-1 text-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                        title="上一轮"
                        @click="session = viewPrev(session)"
                      >
                        ◀
                      </button>
                      <span class="px-1 font-medium text-ink">第 {{ viewing.round }}/{{ session.rounds.length }} 轮</span>
                      <button
                        :disabled="viewNextDisabled"
                        class="rounded-md border border-line/12 px-1.5 py-1 text-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                        title="下一轮"
                        @click="session = viewNext(session)"
                      >
                        ▶
                      </button>
                    </div>
                    <span class="max-w-56 truncate" :title="viewing.instruction">「{{ viewing.instruction }}」</span>
                    <span class="text-faint">{{ fmtTime(viewing.time) }} · {{ viewing.model }}</span>
                    <button
                      v-if="!viewingIsBase"
                      class="rounded-md bg-brand1/10 px-2 py-1 font-medium text-brand1 transition-colors hover:bg-brand1/20"
                      title="以该轮为基底继续迭代"
                      @click="session = backToRound(session)"
                    >
                      回到此轮
                    </button>
                  </div>
                  <p v-else class="flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    <template v-if="isDemo && session.rounds.length > 0">已恢复的历史会话(接入模型后可继续迭代)</template>
                    <template v-else-if="isDemo">{{ typeName }} · 生成完成(演示)</template>
                    <template v-else-if="stream.stopped.value">已停止 · 渲染了已生成部分</template>
                    <template v-else-if="stream.parseSummary.value?.ok">
                      {{ typeName }} · 生成完成({{ stream.parseSummary.value.fileCount }} 个文件)
                    </template>
                    <template v-else>{{ typeName }} · 生成结束</template>
                  </p>
                  <span v-if="!isDemo && performanceSummary" class="text-[10px] text-faint">{{ performanceSummary }}</span>
                  <div class="flex flex-wrap gap-2">
                    <button
                      v-if="!isDemo && viewing"
                      class="flex items-center gap-1.5 rounded-lg border border-line/12 bg-ink/5 px-3.5 py-2 text-xs font-medium text-sub transition-colors hover:bg-ink/10 hover:text-ink"
                      title="以当前基底轮的指令重新生成"
                      @click="regenerateFromBase"
                    >
                      <RotateCcw class="h-3.5 w-3.5" />
                      基于此轮重新生成
                    </button>
                    <button
                      class="flex items-center gap-1.5 rounded-lg border border-line/12 bg-ink/5 px-3.5 py-2 text-xs font-medium text-sub transition-colors hover:bg-ink/10 hover:text-ink"
                      @click="regenerate"
                    >
                      <RotateCcw class="h-3.5 w-3.5" />
                      重新生成
                    </button>
                    <button
                      class="bg-brand-gradient flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-brand1/25 transition-transform hover:scale-[1.03] active:scale-95"
                      @click="emit('edit-artifact')"
                    >
                      <PencilRuler class="h-3.5 w-3.5" />
                      进入编辑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============ 模板生成 ============ -->
      <div v-show="tab === 'template'" class="mt-8">
        <TemplateGen />
      </div>

      <!-- 生成历史抽屉(SF-1-7) -->
      <HistoryPanel v-if="historyOpen" @close="historyOpen = false" @open-session="restoreSession" />
    </div>
  </section>
</template>

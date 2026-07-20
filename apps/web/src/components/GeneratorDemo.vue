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
} from 'lucide-vue-next'
import AppSelect from './AppSelect.vue'
import SectionHeading from './SectionHeading.vue'
import MockSite from './MockSite.vue'
import TemplateGen from './TemplateGen.vue'
import { SITE_TYPES, TYPE_GROUPS, typeById } from '../data/siteTypes'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'
import { useToast } from '../composables/useToast'

const props = defineProps<{ prompt: string }>()
const emit = defineEmits<{ (e: 'update:prompt', v: string): void }>()

const STEPS = [
  { icon: BrainCircuit, label: '分析需求' },
  { icon: LayoutTemplate, label: '规划页面结构' },
  { icon: Blocks, label: '生成组件' },
  { icon: PenLine, label: '填充内容' },
  { icon: CheckCircle2, label: '完成' },
]

const { activeProvider, activeConnection } = useModelConfig()
const { show: showModelSettings } = useModelDialog()
const toast = useToast()

const tab = ref<'ai' | 'template'>('ai')
const typeId = ref('portfolio')
const phase = ref<'idle' | 'generating' | 'done'>('idle')
const stepIndex = ref(-1)
const logs = ref<string[]>([])
const logBoxRef = ref<HTMLElement>()

const typeName = computed(() => typeById(typeId.value)?.name ?? '网站')
const typeIcon = computed(() => typeById(typeId.value)?.icon)
const typeGroups = computed(() =>
  TYPE_GROUPS.map((g) => ({
    label: g,
    options: SITE_TYPES.filter((t) => t.group === g).map((t) => ({ value: t.id, label: t.name })),
  })),
)

function buildLogs(name: string) {
  return [
    `正在解析你的描述,提取关键词、风格偏好与目标受众……`,
    `为「${name}」规划信息架构:导航、首屏、内容区块与页脚……`,
    `调用组件库,生成卡片、表单、图表等 18 个 UI 组件……`,
    `撰写标题与正文文案,填充配色、配图与示例数据……`,
    `样式校验通过,响应式适配完成,网站已就绪 ✓`,
  ]
}

let cancelled = false
let timers: ReturnType<typeof setTimeout>[] = []

function clearTimers() {
  cancelled = true
  timers.forEach(clearTimeout)
  timers = []
}

function start() {
  if (!props.prompt.trim()) {
    toast.error('请先描述你想要的网站', '在左侧输入一句话需求,或从首页快捷标签中选择。')
    return
  }
  clearTimers()
  cancelled = false
  phase.value = 'generating'
  logs.value = []
  stepIndex.value = 0

  const lines = buildLogs(typeName.value)
  let li = 0

  const typeLine = () => {
    if (cancelled) return
    const line = lines[li]
    let ci = 0
    logs.value.push('')
    stepIndex.value = li
    const tick = () => {
      if (cancelled) return
      ci += 1
      logs.value[li] = line.slice(0, ci)
      if (ci < line.length) {
        timers.push(setTimeout(tick, 14))
      } else {
        li += 1
        if (li < lines.length) {
          timers.push(setTimeout(typeLine, 520))
        } else {
          stepIndex.value = lines.length
          timers.push(
            setTimeout(() => {
              if (!cancelled) phase.value = 'done'
            }, 650),
          )
        }
      }
    }
    tick()
  }
  timers.push(setTimeout(typeLine, 250))
}

watch(logs, () => {
  const box = logBoxRef.value
  if (box) box.scrollTop = box.scrollHeight
})

onBeforeUnmount(clearTimers)
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
      <div class="mt-10 flex justify-center">
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
      </div>

      <!-- ============ AI 生成 ============ -->
      <div v-show="tab === 'ai'" class="mt-8">
        <!-- 模型状态横幅 -->
        <div class="mb-6 flex flex-wrap items-center justify-center gap-2">
          <p
            v-if="activeProvider && activeConnection"
            class="flex items-center gap-2 rounded-full border border-line/10 bg-ink/[0.04] px-4 py-2 text-xs text-sub"
          >
            <span class="h-2 w-2 rounded-full bg-emerald-400" />
            当前模型:{{ activeProvider.name }} · {{ activeConnection.model }}
            <button class="ml-1 text-brand1 underline-offset-2 hover:underline" @click="showModelSettings">
              更换
            </button>
          </p>
          <p
            v-else
            class="flex flex-wrap items-center justify-center gap-2 rounded-full border border-line/10 bg-ink/[0.04] px-4 py-2 text-xs text-mut"
          >
            <Info class="h-3.5 w-3.5 text-brand2" />
            当前为演示模式,接入模型后可真实生成
            <button
              class="flex items-center gap-1 font-medium text-brand1 underline-offset-2 hover:underline"
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

            <button
              :disabled="phase === 'generating'"
              class="bg-brand-gradient mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand1/30 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              @click="start"
            >
              <Loader2 v-if="phase === 'generating'" class="h-4 w-4 animate-spin" />
              <Play v-else class="h-4 w-4" />
              {{ phase === 'generating' ? '正在生成……' : '开始生成' }}
            </button>
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
            </div>

            <div class="relative h-[380px] sm:h-[420px]">
              <!-- 待机态 -->
              <div v-if="phase === 'idle'" class="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]">
                  <Play class="h-6 w-6 text-faint" />
                </div>
                <p class="text-sm text-faint">填写需求并点击「开始生成」</p>
                <p class="text-xs text-faint/70">AI 将在这里实时构建你的网站</p>
              </div>

              <!-- 生成过程 -->
              <div v-else-if="phase === 'generating'" class="grid h-full gap-0 sm:grid-cols-[180px_1fr]">
                <!-- 步骤指示 -->
                <div class="hidden flex-col justify-center gap-4 border-r border-line/10 bg-app/50 px-5 sm:flex">
                  <div v-for="(s, i) in STEPS" :key="s.label" class="flex items-center gap-2.5">
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
                </div>
                <!-- 日志输出 -->
                <div ref="logBoxRef" class="overflow-y-auto p-5 font-mono text-xs leading-loose">
                  <p class="mb-2 text-faint">$ siteforge generate --type {{ typeId }}</p>
                  <p
                    v-for="(line, i) in logs"
                    :key="i"
                    :class="i === logs.length - 1 ? 'typing-caret text-brand2' : 'text-mut'"
                  >
                    <span class="mr-2 text-brand1">▸</span>
                    {{ line }}
                  </p>
                </div>
              </div>

              <!-- 生成完成:网站缩略 mock -->
              <div v-else class="animate-fade-in flex h-full flex-col">
                <div class="min-h-0 flex-1 p-3">
                  <div class="h-full overflow-hidden rounded-lg border border-line/15 shadow-2xl shadow-black/20">
                    <MockSite :type="typeId" />
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3 border-t border-line/10 bg-app/50 px-4 py-3">
                  <p class="flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 class="h-3.5 w-3.5" />
                    {{ typeName }} · 生成完成
                  </p>
                  <div class="flex gap-2">
                    <button
                      class="flex items-center gap-1.5 rounded-lg border border-line/12 bg-ink/5 px-3.5 py-2 text-xs font-medium text-sub transition-colors hover:bg-ink/10 hover:text-ink"
                      @click="start"
                    >
                      <RotateCcw class="h-3.5 w-3.5" />
                      重新生成
                    </button>
                    <button
                      class="bg-brand-gradient flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-brand1/25 transition-transform hover:scale-[1.03] active:scale-95"
                      @click="toast.info('演示环境', '在线编辑器暂未开放,正式版将支持拖拽编辑与实时预览。')"
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
    </div>
  </section>
</template>

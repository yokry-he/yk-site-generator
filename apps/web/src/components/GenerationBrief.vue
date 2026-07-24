<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Image,
  Layers3,
  Palette,
  RotateCcw,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-vue-next'

interface BriefAsset {
  id: string
  name: string
  type: string
  size: number
  purpose: 'logo' | 'hero' | 'style' | 'copy' | 'content'
  preview?: string
  extractedText?: string
}

interface BriefState {
  goal: string
  audience: string
  tone: string
  language: string
  style: string
  cta: string
  sections: string[]
  notes: string
}

const props = defineProps<{ prompt: string }>()
const emit = defineEmits<{
  (event: 'update:prompt', value: string): void
}>()

const STORAGE_KEY = 'siteforge:generation-brief-v2'
const open = ref(false)
const step = ref(0)
const assets = ref<BriefAsset[]>([])
const state = ref<BriefState>({
  goal: '展示产品并推动用户采取行动',
  audience: '',
  tone: '专业、清晰、可信',
  language: '简体中文',
  style: '现代、克制、留白充足',
  cta: '立即开始',
  sections: ['导航', '首屏', '核心功能', '客户证明', '行动号召', '页脚'],
  notes: '',
})

const SECTION_OPTIONS = ['导航', '首屏', '核心功能', '数据指标', '客户案例', '客户评价', '价格方案', 'FAQ', '团队介绍', '内容列表', '图片画廊', '联系表单', '行动号召', '页脚']
const GOALS = ['展示产品并推动用户采取行动', '建立企业可信度并获得咨询', '展示个人作品与能力', '发布内容并建立长期读者', '介绍活动并收集报名', '展示数据和业务进展']
const TONES = ['专业、清晰、可信', '友好、轻松、有亲和力', '大胆、鲜明、有行动感', '克制、理性、编辑感', '温暖、自然、有故事感']
const STYLES = ['现代、克制、留白充足', '深色科技感、细腻渐变', '极简编辑风、大字号排版', '自然温暖、柔和质感', '高密度专业信息、清晰网格', '大胆撞色、强视觉节奏']
const stepMeta = [
  { title: '目标与受众', icon: Target, description: '先明确页面要解决什么问题。' },
  { title: '内容结构', icon: Layers3, description: '选择页面应该包含的关键区块。' },
  { title: '风格与素材', icon: Palette, description: '补充表达方式、行动按钮和参考资料。' },
]

const completion = computed(() => {
  const checks = [state.value.goal, state.value.audience, state.value.tone, state.value.style, state.value.sections.length, state.value.cta]
  return Math.round(checks.filter(Boolean).length / checks.length * 100)
})

function toggleSection(section: string) {
  state.value.sections = state.value.sections.includes(section)
    ? state.value.sections.filter((item) => item !== section)
    : [...state.value.sections, section]
}

function assetSummary(asset: BriefAsset): string {
  const purpose = { logo: '品牌 Logo', hero: '首屏主图', style: '视觉风格参考', copy: '文案资料', content: '内容素材' }[asset.purpose]
  const text = asset.extractedText ? `；提取文字：${asset.extractedText.slice(0, 500)}` : ''
  return `${asset.name}（${purpose}）${text}`
}

function buildPrompt(): string {
  const original = props.prompt.trim()
  const lines = [
    original ? `原始需求：${original}` : '',
    `页面目标：${state.value.goal}`,
    state.value.audience ? `目标用户：${state.value.audience}` : '',
    `内容语气：${state.value.tone}`,
    `视觉方向：${state.value.style}`,
    `页面语言：${state.value.language}`,
    `必须包含的区块：${state.value.sections.join('、')}`,
    `主要行动按钮：${state.value.cta}`,
    state.value.notes ? `其他要求：${state.value.notes}` : '',
    assets.value.length ? `参考素材：${assets.value.map(assetSummary).join('；')}` : '',
    '生成要求：内容必须具体、避免占位文案；桌面、平板和手机均需可用；保持完整 HTML 可独立运行。',
  ]
  return lines.filter(Boolean).join('\n')
}

function applyBrief() {
  emit('update:prompt', buildPrompt())
  open.value = false
}

function reset() {
  state.value = {
    goal: GOALS[0], audience: '', tone: TONES[0], language: '简体中文', style: STYLES[0], cta: '立即开始',
    sections: ['导航', '首屏', '核心功能', '客户证明', '行动号召', '页脚'], notes: '',
  }
  assets.value = []
  step.value = 0
}

async function readAsset(file: File): Promise<BriefAsset | null> {
  if (file.size > 1_500_000) return null
  const id = crypto.randomUUID()
  let preview: string | undefined
  let extractedText: string | undefined
  if (file.type.startsWith('image/')) {
    preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  } else if (file.type.startsWith('text/') || /\.(md|txt|csv)$/i.test(file.name)) {
    extractedText = (await file.text()).replace(/\s+/g, ' ').trim().slice(0, 1800)
  }
  return { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size, purpose: file.type.startsWith('image/') ? 'style' : 'copy', preview, extractedText }
}

async function addFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, Math.max(0, 6 - assets.value.length))
  for (const file of files) {
    const asset = await readAsset(file)
    if (asset) assets.value.push(asset)
  }
  input.value = ''
}

watch([state, assets], () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: state.value, assets: assets.value.map(({ preview, ...asset }) => asset) }))
}, { deep: true })

onMounted(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as null | { state?: BriefState; assets?: BriefAsset[] }
    if (saved?.state) state.value = { ...state.value, ...saved.state }
    if (saved?.assets) assets.value = saved.assets
  } catch {
    localStorage.removeItem(STORAGE_KEY)
  }
})
</script>

<template>
  <section class="mx-auto max-w-7xl px-4 pt-20 sm:px-6 lg:px-8">
    <button class="flex w-full items-center gap-4 rounded-3xl border border-brand1/16 bg-brand1/[0.055] p-4 text-left transition hover:border-brand1/30 sm:p-5" @click="open = !open">
      <span class="bg-brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"><Sparkles class="h-5 w-5" /></span>
      <span class="min-w-0 flex-1"><strong class="block text-sm text-ink">结构化需求向导</strong><span class="mt-1 block text-xs text-mut">把目标、受众、区块、风格和参考素材整理成可编辑的生成简报。</span></span>
      <span class="hidden rounded-full bg-brand1/10 px-3 py-1.5 text-[10px] font-semibold text-sub sm:block">完成度 {{ completion }}%</span>
      <ChevronDown class="h-4 w-4 text-faint transition" :class="open && 'rotate-180'" />
    </button>

    <Transition name="brief">
      <div v-if="open" class="mt-4 overflow-hidden rounded-3xl border border-line/10 bg-soft/65 shadow-xl shadow-black/5">
        <div class="grid border-b border-line/10 sm:grid-cols-3">
          <button v-for="(item,index) in stepMeta" :key="item.title" class="flex items-center gap-3 border-b border-line/8 px-4 py-3 text-left last:border-0 sm:border-r sm:border-b-0" :class="step === index ? 'bg-brand1/[0.065] text-brand1' : 'text-mut'" @click="step = index"><span class="grid h-8 w-8 place-items-center rounded-xl" :class="step === index ? 'bg-brand1/12' : 'bg-ink/5'"><component :is="item.icon" class="h-4 w-4" /></span><span><strong class="block text-xs">{{ index + 1 }}. {{ item.title }}</strong><small class="mt-0.5 block text-[9px] text-faint">{{ item.description }}</small></span></button>
        </div>

        <div class="p-5 sm:p-7">
          <div v-if="step === 0" class="grid gap-5 lg:grid-cols-2">
            <label class="text-xs font-semibold text-sub">页面主要目标<select v-model="state.goal" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-3 text-sm text-ink outline-none"><option v-for="goal in GOALS" :key="goal">{{ goal }}</option></select></label>
            <label class="text-xs font-semibold text-sub">目标用户<input v-model="state.audience" placeholder="例如：20–40 人的成长型 SaaS 团队" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-3 text-sm text-ink outline-none" /></label>
            <label class="text-xs font-semibold text-sub">内容语气<select v-model="state.tone" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-3 text-sm text-ink outline-none"><option v-for="tone in TONES" :key="tone">{{ tone }}</option></select></label>
            <label class="text-xs font-semibold text-sub">页面语言<select v-model="state.language" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-3 text-sm text-ink outline-none"><option>简体中文</option><option>繁体中文</option><option>英文</option><option>中英双语</option></select></label>
          </div>

          <div v-else-if="step === 1">
            <div class="flex items-end justify-between gap-3"><div><h3 class="text-sm font-semibold text-ink">选择页面区块</h3><p class="mt-1 text-xs text-faint">生成后仍可在编辑器中增加、删除或重排。</p></div><span class="text-[10px] text-faint">已选 {{ state.sections.length }}</span></div>
            <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><button v-for="section in SECTION_OPTIONS" :key="section" class="flex items-center justify-between rounded-xl border px-3 py-3 text-left text-xs" :class="state.sections.includes(section) ? 'border-brand1/30 bg-brand1/[0.07] font-semibold text-brand1' : 'border-line/10 bg-app/45 text-sub hover:border-brand1/20'" @click="toggleSection(section)">{{ section }}<Check v-if="state.sections.includes(section)" class="h-3.5 w-3.5" /></button></div>
          </div>

          <div v-else class="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div class="space-y-4">
              <label class="text-xs font-semibold text-sub">视觉方向<select v-model="state.style" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-3 text-sm text-ink outline-none"><option v-for="style in STYLES" :key="style">{{ style }}</option></select></label>
              <label class="text-xs font-semibold text-sub">主要行动按钮<input v-model="state.cta" placeholder="例如：预约演示" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-3 text-sm text-ink outline-none" /></label>
              <label class="text-xs font-semibold text-sub">补充要求<textarea v-model="state.notes" rows="4" placeholder="例如：避免使用夸张渐变；首屏要出现产品截图；FAQ 控制在 5 条以内。" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 text-sm leading-6 text-ink outline-none" /></label>
            </div>
            <div>
              <div class="flex items-center justify-between"><div><h3 class="text-xs font-semibold text-sub">参考素材</h3><p class="mt-1 text-[10px] text-faint">支持图片和文本；单个文件不超过 1.5MB。</p></div><label class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line/10 px-3 py-2 text-[10px] font-semibold text-brand1"><Upload class="h-3.5 w-3.5" />上传<input type="file" multiple accept="image/*,.txt,.md,.csv" class="hidden" @change="addFiles" /></label></div>
              <div v-if="assets.length" class="mt-3 grid gap-2"><article v-for="asset in assets" :key="asset.id" class="flex items-center gap-3 rounded-xl border border-line/10 bg-app/45 p-3"><span class="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-ink/5"><img v-if="asset.preview" :src="asset.preview" class="h-full w-full object-cover" /><Image v-else-if="asset.type.startsWith('image/')" class="h-4 w-4 text-faint" /><FileText v-else class="h-4 w-4 text-faint" /></span><div class="min-w-0 flex-1"><p class="truncate text-xs font-medium text-ink">{{ asset.name }}</p><select v-model="asset.purpose" class="mt-1 bg-transparent text-[9px] text-faint outline-none"><option value="logo">品牌 Logo</option><option value="hero">首屏主图</option><option value="style">视觉风格参考</option><option value="copy">文案资料</option><option value="content">内容素材</option></select></div><button class="rounded-lg p-1.5 text-faint hover:text-red-500" @click="assets = assets.filter(item => item.id !== asset.id)"><X class="h-3.5 w-3.5" /></button></article></div>
              <div v-else class="mt-3 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-line/15 text-center"><Upload class="h-6 w-6 text-faint" /><p class="mt-2 text-xs text-mut">还没有参考素材</p><p class="mt-1 text-[9px] text-faint">文本会提取摘要；图片作为后续替换和风格提示。</p></div>
            </div>
          </div>
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 bg-app/35 px-5 py-4 sm:px-7"><button class="flex items-center gap-1.5 text-xs text-faint hover:text-ink" @click="reset"><RotateCcw class="h-3.5 w-3.5" />重置向导</button><div class="flex gap-2"><button v-if="step > 0" class="rounded-xl border border-line/10 px-4 py-2.5 text-xs text-sub" @click="step -= 1">上一步</button><button v-if="step < 2" class="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white" @click="step += 1">下一步<ArrowRight class="h-3.5 w-3.5" /></button><button v-else class="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white" @click="applyBrief"><Sparkles class="h-3.5 w-3.5" />应用到生成需求</button></div></footer>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.brief-enter-active,.brief-leave-active{transition:opacity .18s ease,transform .2s ease}.brief-enter-from,.brief-leave-to{opacity:0;transform:translateY(-8px)}
</style>

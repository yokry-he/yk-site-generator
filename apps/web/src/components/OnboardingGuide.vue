<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CircleCheck,
  FolderKanban,
  LayoutTemplate,
  Loader2,
  Palette,
  Rocket,
  Sparkles,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import { SITE_TYPES, typeById } from '../data/siteTypes'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import {
  completeOnboarding,
  dismissOnboarding,
  getOnboarding,
  resetOnboarding,
  updateOnboarding,
  type OnboardingChecklistItem,
  type OnboardingContext,
  type OnboardingProgress,
} from '../lib/growth'

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated, initialized } = useAuth()
const toast = useToast()

const rootRef = ref<HTMLElement>()
const open = ref(false)
const loading = ref(false)
const saving = ref(false)
const dismissConfirm = ref(false)
const progress = ref<OnboardingProgress | null>(null)
const checklist = ref<OnboardingChecklistItem[]>([])
const context = ref<OnboardingContext>({})
const currentStep = ref<OnboardingProgress['currentStep']>('welcome')
const loadedUserId = ref('')
let openTimer: ReturnType<typeof setTimeout> | null = null
let previousFocus: HTMLElement | null = null

const steps = [
  { id: 'welcome' as const, label: '欢迎' },
  { id: 'goal' as const, label: '目标' },
  { id: 'starter' as const, label: '起点' },
  { id: 'brand' as const, label: '品牌' },
  { id: 'ready' as const, label: '开始' },
]

const goals = [
  { id: 'personal' as const, title: '建立个人影响力', desc: '个人主页、作品集、简历或专业博客', icon: UserRound, color: 'text-violet-500 bg-violet-500/10' },
  { id: 'business' as const, title: '推广业务与产品', desc: '企业官网、SaaS、活动、课程或商品', icon: BriefcaseBusiness, color: 'text-blue-500 bg-blue-500/10' },
  { id: 'content' as const, title: '沉淀内容与社区', desc: '博客、文档、知识库或兴趣社区', icon: BookOpen, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'data' as const, title: '展示数据与运营', desc: '业务看板、监控大屏和数据报告', icon: BarChart3, color: 'text-cyan-500 bg-cyan-500/10' },
]

const siteTypesByGoal: Record<NonNullable<OnboardingContext['goal']>, string[]> = {
  personal: ['personal', 'portfolio', 'resume', 'blog'],
  business: ['business', 'saas', 'landing', 'restaurant', 'shop', 'education'],
  content: ['blog', 'docs', 'wiki', 'forum'],
  data: ['dashboard'],
}

const stepIndex = computed(() => Math.max(0, steps.findIndex((item) => item.id === currentStep.value)))
const suggestedTypes = computed(() => {
  const goal = context.value.goal
  return goal ? siteTypesByGoal[goal].map((id) => typeById(id)).filter(Boolean) : []
})
const selectedType = computed(() => typeById(context.value.siteType ?? ''))
const canContinue = computed(() => {
  if (currentStep.value === 'goal') return Boolean(context.value.goal && context.value.siteType)
  if (currentStep.value === 'starter') return Boolean(context.value.starter)
  if (currentStep.value === 'brand') return Boolean(context.value.brandIntent)
  return true
})
const primaryLabel = computed(() => {
  if (currentStep.value === 'welcome') return '规划我的第一步'
  if (currentStep.value === 'ready') {
    if (context.value.brandIntent === 'create') return '先建立品牌套件'
    return context.value.starter === 'template' ? '浏览推荐模板' : '开始 AI 生成'
  }
  return '继续'
})
const routeAfterFinish = computed(() => {
  if (context.value.brandIntent === 'create') return '/brand?from=onboarding'
  if (context.value.starter === 'template') {
    const name = selectedType.value?.name ?? ''
    return `/templates?onboarding=1&q=${encodeURIComponent(name)}`
  }
  const prompt = selectedType.value?.example ?? '帮我生成一个现代、清晰、响应式的网站'
  return `/generator?q=${encodeURIComponent(prompt)}`
})
const completedTaskCount = computed(() => checklist.value.filter((item) => item.completed).length)

function nextStepId(): OnboardingProgress['currentStep'] {
  return steps[Math.min(steps.length - 1, stepIndex.value + 1)].id
}

function previousStepId(): OnboardingProgress['currentStep'] {
  return steps[Math.max(0, stepIndex.value - 1)].id
}

function selectGoal(goal: NonNullable<OnboardingContext['goal']>) {
  context.value = {
    ...context.value,
    goal,
    siteType: siteTypesByGoal[goal][0],
  }
}

async function load(automatic = true) {
  if (!isAuthenticated.value || !user.value || route.path.startsWith('/admin')) return
  if (loadedUserId.value === user.value.id && automatic) return
  loadedUserId.value = user.value.id
  loading.value = true
  try {
    const response = await getOnboarding()
    progress.value = response.progress
    checklist.value = response.checklist
    context.value = { ...response.progress.context }
    currentStep.value = response.progress.currentStep
    if (automatic && !response.progress.completedAt && !response.progress.dismissedAt) {
      if (openTimer) clearTimeout(openTimer)
      openTimer = setTimeout(() => show(), 650)
    }
  } catch {
    // 引导不是主业务阻塞项，读取失败时保持静默。
  } finally {
    loading.value = false
  }
}

async function show(reset = false) {
  if (!isAuthenticated.value || route.path.startsWith('/admin')) return
  if (reset || progress.value?.completedAt || progress.value?.dismissedAt) {
    try {
      progress.value = await resetOnboarding()
      context.value = {}
      currentStep.value = 'welcome'
    } catch {
      return
    }
  }
  previousFocus = document.activeElement as HTMLElement | null
  open.value = true
  document.body.style.overflow = 'hidden'
  await nextTick()
  rootRef.value?.focus()
}

async function persist(next: OnboardingProgress['currentStep']) {
  saving.value = true
  try {
    const updated = await updateOnboarding({
      currentStep: next,
      completedSteps: [currentStep.value],
      context: context.value,
    })
    progress.value = updated
    currentStep.value = next
  } finally {
    saving.value = false
  }
}

async function next() {
  if (!canContinue.value || saving.value) return
  if (currentStep.value === 'ready') {
    saving.value = true
    try {
      progress.value = await completeOnboarding()
      close(false)
      toast.success('准备完成', '你的建站起点已经配置好。')
      await router.push(routeAfterFinish.value)
    } catch {
      toast.error('保存失败', '暂时无法完成引导，请稍后重试。')
    } finally {
      saving.value = false
    }
    return
  }
  await persist(nextStepId())
}

async function back() {
  if (saving.value || currentStep.value === 'welcome') return
  await persist(previousStepId())
}

function close(restoreFocus = true) {
  open.value = false
  dismissConfirm.value = false
  document.body.style.overflow = ''
  if (restoreFocus) void nextTick(() => previousFocus?.focus())
}

async function confirmDismiss() {
  saving.value = true
  try {
    progress.value = await dismissOnboarding()
    close()
    toast.info('已稍后处理', '可从账号菜单重新打开新手引导。')
  } catch {
    toast.error('操作失败', '暂时无法保存引导状态。')
  } finally {
    saving.value = false
  }
}

function focusables(): HTMLElement[] {
  if (!rootRef.value) return []
  return [...rootRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
  )]
}

function onKey(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    dismissConfirm.value = true
    return
  }
  if (event.key === 'Tab') {
    const items = focusables()
    if (!items.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

function handleOpenEvent() {
  void show(true)
}

watch([initialized, isAuthenticated], ([ready, authenticated]) => {
  if (ready && authenticated) void load()
  if (!authenticated) {
    loadedUserId.value = ''
    close(false)
  }
}, { immediate: true })

watch(() => route.path, (path) => {
  if (path.startsWith('/admin') && open.value) close(false)
})

window.addEventListener('keydown', onKey)
window.addEventListener('siteforge:open-onboarding', handleOpenEvent)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('siteforge:open-onboarding', handleOpenEvent)
  if (openTimer) clearTimeout(openTimer)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="onboarding">
      <div v-if="open" class="fixed inset-0 z-[140] bg-black/60 p-0 backdrop-blur-sm sm:p-4 lg:p-7" @mousedown.self="dismissConfirm = true">
        <section
          ref="rootRef"
          role="dialog"
          aria-modal="true"
          aria-label="SiteForge 新手引导"
          tabindex="-1"
          class="mx-auto grid h-full max-w-6xl overflow-hidden bg-app text-ink outline-none sm:max-h-[760px] sm:rounded-[28px] sm:border sm:border-white/10 sm:shadow-2xl lg:grid-cols-[360px_minmax(0,1fr)]"
        >
          <aside class="relative hidden overflow-hidden bg-zinc-950 p-8 text-white lg:flex lg:flex-col">
            <div class="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full bg-violet-600/35 blur-3xl" />
            <div class="pointer-events-none absolute right-[-100px] bottom-[-120px] h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
            <div class="relative flex items-center gap-2.5">
              <span class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/25"><Sparkles class="h-4.5 w-4.5" /></span>
              <strong class="text-lg">SiteForge</strong>
            </div>
            <div class="relative mt-16">
              <p class="text-xs font-semibold tracking-[.18em] text-violet-300 uppercase">Your launch path</p>
              <h2 class="mt-4 text-3xl font-bold leading-tight">把第一步变得清晰，网站就更容易真正上线</h2>
              <p class="mt-4 text-sm leading-7 text-zinc-400">根据你的目标推荐站点类型、创建方式和品牌准备顺序。全部选择都可以稍后修改。</p>
            </div>
            <ol class="relative mt-10 grid gap-3">
              <li v-for="(step,index) in steps" :key="step.id" class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition" :class="index === stepIndex ? 'bg-white/10' : ''">
                <span class="grid h-7 w-7 place-items-center rounded-full border text-[10px] font-bold" :class="index < stepIndex ? 'border-emerald-400 bg-emerald-400 text-zinc-950' : index === stepIndex ? 'border-violet-400 bg-violet-400/15 text-violet-200' : 'border-white/15 text-zinc-500'">
                  <Check v-if="index < stepIndex" class="h-3.5 w-3.5" /><template v-else>{{ index + 1 }}</template>
                </span>
                <span class="text-sm" :class="index === stepIndex ? 'font-semibold text-white' : index < stepIndex ? 'text-zinc-300' : 'text-zinc-500'">{{ step.label }}</span>
              </li>
            </ol>
            <div class="relative mt-auto rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <div class="flex items-center justify-between"><span class="text-xs text-zinc-400">启动清单</span><strong class="text-sm">{{ completedTaskCount }}/{{ checklist.length || 4 }}</strong></div>
              <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" :style="{ width: `${(completedTaskCount / Math.max(1, checklist.length || 4)) * 100}%` }" /></div>
            </div>
          </aside>

          <div class="flex min-h-0 flex-col">
            <header class="flex min-h-16 items-center gap-3 border-b border-line/10 px-4 sm:px-6">
              <div class="flex min-w-0 flex-1 items-center gap-3 lg:hidden">
                <span class="bg-brand-gradient grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"><Sparkles class="h-4 w-4" /></span>
                <div class="min-w-0"><p class="truncate text-sm font-semibold">SiteForge 快速开始</p><p class="text-[10px] text-faint">步骤 {{ stepIndex + 1 }} / {{ steps.length }}</p></div>
              </div>
              <div class="ml-auto flex items-center gap-2">
                <span v-if="saving" class="hidden items-center gap-1.5 text-[10px] text-faint sm:flex"><Loader2 class="h-3 w-3 animate-spin" />正在保存</span>
                <button class="rounded-xl p-2 text-faint transition hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand1/45" aria-label="稍后完成引导" @click="dismissConfirm = true"><X class="h-5 w-5" /></button>
              </div>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-9 sm:py-10">
              <div class="mx-auto max-w-2xl">
                <template v-if="currentStep === 'welcome'">
                  <span class="inline-flex items-center gap-1.5 rounded-full bg-brand1/10 px-3 py-1 text-[11px] font-semibold text-brand1"><WandSparkles class="h-3.5 w-3.5" />约 1 分钟完成</span>
                  <h2 class="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">欢迎来到你的智能建站工作台</h2>
                  <p class="mt-4 text-sm leading-7 text-mut sm:text-base">我们不会用一连串功能介绍打断你，而是根据目标规划一条可以真正完成并发布网站的路径。</p>
                  <div class="mt-8 grid gap-3 sm:grid-cols-3">
                    <article class="rounded-2xl border border-line/10 bg-soft/55 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><LayoutTemplate class="h-4.5 w-4.5" /></span><h3 class="mt-4 text-sm font-semibold">选择好起点</h3><p class="mt-2 text-xs leading-5 text-mut">从官方模板或 AI 生成开始。</p></article>
                    <article class="rounded-2xl border border-line/10 bg-soft/55 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500"><Palette class="h-4.5 w-4.5" /></span><h3 class="mt-4 text-sm font-semibold">保持品牌一致</h3><p class="mt-2 text-xs leading-5 text-mut">颜色、字体与视觉规范跨项目复用。</p></article>
                    <article class="rounded-2xl border border-line/10 bg-soft/55 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><Rocket class="h-4.5 w-4.5" /></span><h3 class="mt-4 text-sm font-semibold">持续迭代发布</h3><p class="mt-2 text-xs leading-5 text-mut">每次修改都保留版本，放心尝试。</p></article>
                  </div>
                </template>

                <template v-else-if="currentStep === 'goal'">
                  <p class="text-[11px] font-semibold tracking-[.16em] text-brand1 uppercase">01 · 建站目标</p>
                  <h2 class="mt-3 text-3xl font-bold tracking-tight">你最想用网站完成什么？</h2>
                  <p class="mt-3 text-sm leading-6 text-mut">目标会影响推荐的页面结构、模板和内容重点。</p>
                  <div class="mt-7 grid gap-3 sm:grid-cols-2">
                    <button v-for="goal in goals" :key="goal.id" class="group rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/45" :class="context.goal === goal.id ? 'border-brand1/35 bg-brand1/[0.07]' : 'border-line/10 bg-soft/45 hover:border-brand1/20 hover:bg-soft/75'" :aria-pressed="context.goal === goal.id" @click="selectGoal(goal.id)">
                      <div class="flex items-start gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :class="goal.color"><component :is="goal.icon" class="h-5 w-5" /></span><div><h3 class="text-sm font-semibold">{{ goal.title }}</h3><p class="mt-1.5 text-xs leading-5 text-mut">{{ goal.desc }}</p></div><CircleCheck v-if="context.goal === goal.id" class="ml-auto h-5 w-5 shrink-0 text-brand1" /></div>
                    </button>
                  </div>
                  <div v-if="context.goal" class="mt-7">
                    <p class="text-xs font-semibold text-sub">选择最接近的站点类型</p>
                    <div class="mt-3 flex flex-wrap gap-2"><button v-for="type in suggestedTypes" :key="type!.id" class="rounded-full border px-3.5 py-2 text-xs transition focus-visible:ring-2 focus-visible:ring-brand1/45" :class="context.siteType === type!.id ? 'border-brand1/30 bg-brand1/10 font-semibold text-brand1' : 'border-line/10 bg-soft/45 text-mut hover:text-ink'" @click="context.siteType = type!.id">{{ type!.name }}</button></div>
                  </div>
                </template>

                <template v-else-if="currentStep === 'starter'">
                  <p class="text-[11px] font-semibold tracking-[.16em] text-brand1 uppercase">02 · 创建方式</p>
                  <h2 class="mt-3 text-3xl font-bold tracking-tight">你希望从哪里开始？</h2>
                  <p class="mt-3 text-sm leading-6 text-mut">两种方式最终都会进入同一个可视化编辑和版本工作流。</p>
                  <div class="mt-8 grid gap-4 sm:grid-cols-2">
                    <button class="relative overflow-hidden rounded-3xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-brand1/45" :class="context.starter === 'template' ? 'border-brand1/35 bg-brand1/[0.07]' : 'border-line/10 bg-soft/45 hover:border-brand1/20'" @click="context.starter = 'template'">
                      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-500"><LayoutTemplate class="h-6 w-6" /></span><h3 class="mt-5 text-lg font-semibold">官方模板</h3><p class="mt-2 text-sm leading-6 text-mut">先看到完整效果，再替换内容和品牌。适合希望快速上线的用户。</p><span class="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand1">推荐 · 更快完成</span><CircleCheck v-if="context.starter === 'template'" class="absolute top-5 right-5 h-5 w-5 text-brand1" />
                    </button>
                    <button class="relative overflow-hidden rounded-3xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-brand1/45" :class="context.starter === 'ai' ? 'border-brand1/35 bg-brand1/[0.07]' : 'border-line/10 bg-soft/45 hover:border-brand1/20'" @click="context.starter = 'ai'">
                      <span class="bg-brand-gradient grid h-12 w-12 place-items-center rounded-2xl text-white"><WandSparkles class="h-6 w-6" /></span><h3 class="mt-5 text-lg font-semibold">AI 自由生成</h3><p class="mt-2 text-sm leading-6 text-mut">从自然语言需求开始，获得更个性化的页面结构和文案。</p><span class="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand1">灵活 · 适合独特需求</span><CircleCheck v-if="context.starter === 'ai'" class="absolute top-5 right-5 h-5 w-5 text-brand1" />
                    </button>
                  </div>
                </template>

                <template v-else-if="currentStep === 'brand'">
                  <p class="text-[11px] font-semibold tracking-[.16em] text-brand1 uppercase">03 · 品牌准备</p>
                  <h2 class="mt-3 text-3xl font-bold tracking-tight">是否先建立品牌套件？</h2>
                  <p class="mt-3 text-sm leading-6 text-mut">品牌套件集中保存 Logo、颜色、字体和按钮风格，可在多个项目中重复使用。</p>
                  <div class="mt-8 grid gap-4 sm:grid-cols-2">
                    <button class="rounded-3xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-brand1/45" :class="context.brandIntent === 'create' ? 'border-brand1/35 bg-brand1/[0.07]' : 'border-line/10 bg-soft/45 hover:border-brand1/20'" @click="context.brandIntent = 'create'"><span class="grid h-12 w-12 place-items-center rounded-2xl bg-pink-500/10 text-pink-500"><Palette class="h-6 w-6" /></span><div class="mt-5 flex items-center justify-between"><h3 class="text-lg font-semibold">先建立品牌</h3><CircleCheck v-if="context.brandIntent === 'create'" class="h-5 w-5 text-brand1" /></div><p class="mt-2 text-sm leading-6 text-mut">适合已经有品牌名称、颜色或 Logo，希望从一开始保持一致。</p></button>
                    <button class="rounded-3xl border p-5 text-left transition focus-visible:ring-2 focus-visible:ring-brand1/45" :class="context.brandIntent === 'later' ? 'border-brand1/35 bg-brand1/[0.07]' : 'border-line/10 bg-soft/45 hover:border-brand1/20'" @click="context.brandIntent = 'later'"><span class="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-500"><Rocket class="h-6 w-6" /></span><div class="mt-5 flex items-center justify-between"><h3 class="text-lg font-semibold">先做出第一版</h3><CircleCheck v-if="context.brandIntent === 'later'" class="h-5 w-5 text-brand1" /></div><p class="mt-2 text-sm leading-6 text-mut">先快速创建网站，之后随时应用预设主题或建立自己的品牌套件。</p></button>
                  </div>
                </template>

                <template v-else>
                  <p class="text-[11px] font-semibold tracking-[.16em] text-brand1 uppercase">04 · 个性化路径</p>
                  <h2 class="mt-3 text-3xl font-bold tracking-tight">你的第一步已经准备好</h2>
                  <p class="mt-3 text-sm leading-6 text-mut">这不是永久设置。创建后仍可更换模板、品牌和生成方式。</p>
                  <div class="mt-8 overflow-hidden rounded-3xl border border-line/10 bg-soft/55">
                    <div class="grid gap-px bg-line/8 sm:grid-cols-3">
                      <div class="bg-app/75 p-5"><span class="text-[10px] font-semibold tracking-wider text-faint uppercase">站点类型</span><p class="mt-2 text-sm font-semibold">{{ selectedType?.name || '网站' }}</p></div>
                      <div class="bg-app/75 p-5"><span class="text-[10px] font-semibold tracking-wider text-faint uppercase">创建起点</span><p class="mt-2 text-sm font-semibold">{{ context.starter === 'template' ? '官方模板' : 'AI 自由生成' }}</p></div>
                      <div class="bg-app/75 p-5"><span class="text-[10px] font-semibold tracking-wider text-faint uppercase">品牌顺序</span><p class="mt-2 text-sm font-semibold">{{ context.brandIntent === 'create' ? '先建立品牌' : '稍后完善品牌' }}</p></div>
                    </div>
                    <div class="p-5"><p class="text-xs font-semibold text-sub">接下来建议</p><div class="mt-3 grid gap-2"><div class="flex items-center gap-3 text-sm"><span class="grid h-7 w-7 place-items-center rounded-full bg-brand1/10 text-[10px] font-bold text-brand1">1</span><span>{{ context.brandIntent === 'create' ? '创建并保存第一套品牌规范' : context.starter === 'template' ? '预览并选择一套官方模板' : '完善需求并生成第一版网站' }}</span></div><div class="flex items-center gap-3 text-sm"><span class="grid h-7 w-7 place-items-center rounded-full bg-brand1/10 text-[10px] font-bold text-brand1">2</span><span>进入项目工作区编辑内容和视觉</span></div><div class="flex items-center gap-3 text-sm"><span class="grid h-7 w-7 place-items-center rounded-full bg-brand1/10 text-[10px] font-bold text-brand1">3</span><span>检查移动端效果并发布网站</span></div></div></div>
                  </div>
                </template>
              </div>
            </div>

            <footer class="flex items-center gap-3 border-t border-line/10 px-5 py-4 sm:px-8">
              <button v-if="currentStep !== 'welcome'" :disabled="saving" class="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium text-mut transition hover:bg-ink/5 hover:text-ink disabled:opacity-50" @click="back"><ArrowLeft class="h-4 w-4" />返回</button>
              <button v-else class="rounded-xl px-3 py-2.5 text-sm text-faint hover:text-ink" @click="dismissConfirm = true">稍后再说</button>
              <button :disabled="!canContinue || saving" class="bg-brand-gradient ml-auto flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45" @click="next"><Loader2 v-if="saving" class="h-4 w-4 animate-spin" /><template v-else>{{ primaryLabel }}<ArrowRight class="h-4 w-4" /></template></button>
            </footer>
          </div>
        </section>

        <Transition name="confirm">
          <div v-if="dismissConfirm" class="absolute inset-0 z-10 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" @mousedown.self="dismissConfirm = false">
            <section role="alertdialog" aria-modal="true" aria-label="稍后完成新手引导" class="w-full max-w-md rounded-3xl border border-white/10 bg-app p-6 text-ink shadow-2xl">
              <span class="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/10 text-amber-500"><FolderKanban class="h-5 w-5" /></span><h2 class="mt-5 text-xl font-bold">稍后再完成引导？</h2><p class="mt-2 text-sm leading-6 text-mut">当前选择会保留。你可以从账号菜单随时重新打开，并继续完成启动清单。</p><div class="mt-6 flex justify-end gap-2"><button :disabled="saving" class="rounded-xl border border-line/10 px-4 py-2.5 text-sm text-sub" @click="dismissConfirm = false">继续设置</button><button :disabled="saving" class="flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-app disabled:opacity-50" @click="confirmDismiss"><Loader2 v-if="saving" class="h-4 w-4 animate-spin" />稍后再说</button></div>
            </section>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onboarding-enter-active,.onboarding-leave-active{transition:opacity .2s ease}.onboarding-enter-active>section,.onboarding-leave-active>section{transition:transform .25s cubic-bezier(.22,1,.36,1),opacity .2s ease}.onboarding-enter-from,.onboarding-leave-to{opacity:0}.onboarding-enter-from>section,.onboarding-leave-to>section{transform:translateY(14px) scale(.99);opacity:0}.confirm-enter-active,.confirm-leave-active{transition:opacity .15s ease}.confirm-enter-from,.confirm-leave-to{opacity:0}
</style>

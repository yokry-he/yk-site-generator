<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Filter,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import {
  listAdminFeedback,
  updateAdminFeedbackStatus,
  type AdminFeedback,
  type QualitySummary,
} from '../lib/admin'

const { isAuthenticated, isOperator, hasPermission, loading: authLoading } = useAuth()
const toast = useToast()

const feedback = ref<AdminFeedback[]>([])
const summary = ref<QualitySummary>({ total: 0, positive: 0, negative: 0, negativeRate: 0, open: 0, topCategories: [] })
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const status = ref('all')
const sentiment = ref('all')
const siteType = ref('')
const model = ref('')
const expandedId = ref('')
const actionBusy = ref('')
const feedbackStatuses: AdminFeedback['status'][] = ['open', 'reviewed', 'resolved', 'dismissed']
let filterTimer: ReturnType<typeof setTimeout> | null = null

const categoryLabels: Record<string, string> = {
  layout: '布局与层级', copy: '文案内容', colors: '配色风格', images: '图片素材', mobile: '移动端',
  interaction: '交互效果', missing: '内容缺失', error: '页面错误', other: '其他',
}
const statusMeta: Record<AdminFeedback['status'], { label: string; class: string; icon: typeof CircleDot }> = {
  open: { label: '待处理', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', icon: CircleDot },
  reviewed: { label: '已查看', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', icon: MessageSquareText },
  resolved: { label: '已解决', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', icon: CheckCircle2 },
  dismissed: { label: '已忽略', class: 'bg-ink/5 text-faint', icon: XCircle },
}
const maxCategory = computed(() => Math.max(1, ...summary.value.topCategories.map((item) => item.count)))
const canResolve = computed(() => hasPermission('feedback.resolve'))

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

async function load(silent = false) {
  if (!hasPermission('feedback.read')) return
  if (silent) refreshing.value = true
  else loading.value = true
  error.value = ''
  try {
    const result = await listAdminFeedback({
      limit: 300,
      status: status.value,
      sentiment: sentiment.value,
      siteType: siteType.value,
      model: model.value,
    })
    feedback.value = result.feedback
    summary.value = result.summary
  } catch (err) {
    error.value = err instanceof Error ? err.message : '质量反馈加载失败'
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function scheduleLoad() {
  if (filterTimer) clearTimeout(filterTimer)
  filterTimer = setTimeout(() => void load(true), 320)
}

async function updateStatus(item: AdminFeedback, next: AdminFeedback['status']) {
  if (!canResolve.value || item.status === next || actionBusy.value) return
  actionBusy.value = item.id
  const previous = item.status
  item.status = next
  try {
    await updateAdminFeedbackStatus(item.id, next)
    toast.success('反馈状态已更新', statusMeta[next].label)
    await load(true)
  } catch (err) {
    item.status = previous
    toast.error('更新失败', err instanceof Error ? err.message : '请稍后重试')
  } finally {
    actionBusy.value = ''
  }
}

function resetFilters() {
  status.value = 'all'
  sentiment.value = 'all'
  siteType.value = ''
  model.value = ''
}

watch([status, sentiment], () => void load(true))
watch([siteType, model], scheduleLoad)
onMounted(() => void load())
</script>

<template>
  <main class="min-h-screen pt-16 pb-20">
    <div v-if="authLoading" class="flex min-h-[70vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>

    <section v-else-if="!isAuthenticated || !isOperator || !hasPermission('feedback.read')" class="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center">
      <div class="w-full rounded-3xl border border-line/10 bg-soft/65 p-9"><XCircle class="mx-auto h-10 w-10 text-faint" /><h1 class="mt-5 text-2xl font-bold">需要质量反馈权限</h1><p class="mt-3 text-sm leading-7 text-mut">质量反馈包含用户项目和模型信息，仅对授权运营角色开放。</p><RouterLink to="/" class="mt-6 inline-flex rounded-xl border border-line/10 px-5 py-3 text-sm font-semibold">返回首页</RouterLink></div>
    </section>

    <div v-else class="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <header class="flex flex-wrap items-end justify-between gap-5 border-b border-line/10 pb-6">
        <div>
          <RouterLink to="/admin" class="inline-flex items-center gap-1.5 text-xs font-medium text-faint hover:text-brand1"><ArrowLeft class="h-3.5 w-3.5" />运营控制台</RouterLink>
          <p class="mt-5 text-[10px] font-semibold tracking-[.16em] text-brand1 uppercase">Quality Intelligence</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">质量反馈工作区</h1>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-mut">把用户感受关联到具体项目版本、站点类型和模型，识别高频问题并跟踪处理状态。</p>
        </div>
        <div class="flex items-center gap-2"><span v-if="!canResolve" class="rounded-full bg-sky-500/10 px-3 py-1.5 text-[10px] font-semibold text-sky-500">只读模式</span><button :disabled="loading || refreshing" class="flex items-center gap-2 rounded-xl border border-line/12 bg-soft/60 px-4 py-2.5 text-xs font-semibold text-sub hover:border-brand1/25 hover:text-brand1 disabled:opacity-50" @click="load(true)"><RefreshCw class="h-3.5 w-3.5" :class="refreshing ? 'animate-spin' : ''" />刷新数据</button></div>
      </header>

      <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-line/10 bg-soft/60 p-5"><div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><MessageSquareText class="h-5 w-5" /></span><span class="text-[10px] text-faint">全部版本</span></div><p class="mt-5 text-3xl font-bold">{{ summary.total }}</p><p class="mt-1 text-xs text-mut">反馈总量</p></article>
        <article class="rounded-2xl border border-line/10 bg-soft/60 p-5"><div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><ThumbsUp class="h-5 w-5" /></span><span class="text-[10px] text-faint">{{ summary.total ? Math.round(summary.positive / summary.total * 100) : 0 }}%</span></div><p class="mt-5 text-3xl font-bold">{{ summary.positive }}</p><p class="mt-1 text-xs text-mut">符合预期</p></article>
        <article class="rounded-2xl border border-line/10 bg-soft/60 p-5"><div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><ThumbsDown class="h-5 w-5" /></span><span class="text-[10px] text-faint">负向率 {{ summary.negativeRate }}%</span></div><p class="mt-5 text-3xl font-bold">{{ summary.negative }}</p><p class="mt-1 text-xs text-mut">需要改进</p></article>
        <article class="rounded-2xl border border-line/10 bg-soft/60 p-5"><div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-500"><CircleDot class="h-5 w-5" /></span><span class="text-[10px] text-faint">需要跟进</span></div><p class="mt-5 text-3xl font-bold">{{ summary.open }}</p><p class="mt-1 text-xs text-mut">待处理反馈</p></article>
      </div>

      <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section class="min-w-0">
          <div class="flex flex-col gap-3 rounded-2xl border border-line/10 bg-soft/55 p-4 sm:flex-row">
            <label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-app/60 px-3 py-2.5 focus-within:border-brand1/35"><Search class="h-4 w-4 text-faint" /><input v-model="model" placeholder="筛选模型，例如 deepseek-chat" class="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-faint" /></label>
            <label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-app/60 px-3 py-2.5 focus-within:border-brand1/35"><Filter class="h-4 w-4 text-faint" /><input v-model="siteType" placeholder="筛选站点类型，例如 saas" class="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-faint" /></label>
            <label class="relative"><select v-model="sentiment" class="appearance-none rounded-xl border border-line/10 bg-app/60 py-2.5 pr-9 pl-3 text-xs text-sub outline-none focus:border-brand1/35"><option value="all">全部评价</option><option value="positive">符合预期</option><option value="negative">需要改进</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
            <label class="relative"><select v-model="status" class="appearance-none rounded-xl border border-line/10 bg-app/60 py-2.5 pr-9 pl-3 text-xs text-sub outline-none focus:border-brand1/35"><option value="all">全部状态</option><option value="open">待处理</option><option value="reviewed">已查看</option><option value="resolved">已解决</option><option value="dismissed">已忽略</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
          </div>

          <div v-if="error" class="mt-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">{{ error }}</div>
          <div v-if="loading" class="flex min-h-96 items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>
          <div v-else-if="feedback.length" class="mt-4 grid gap-3">
            <article v-for="item in feedback" :key="item.id" class="overflow-hidden rounded-2xl border border-line/10 bg-soft/58 transition hover:border-brand1/18">
              <button class="flex w-full items-start gap-3 p-4 text-left sm:p-5" @click="expandedId = expandedId === item.id ? '' : item.id">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :class="item.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'"><ThumbsUp v-if="item.sentiment === 'positive'" class="h-5 w-5" /><ThumbsDown v-else class="h-5 w-5" /></span>
                <div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="text-xs font-semibold text-ink">{{ item.sentiment === 'positive' ? '符合预期' : '需要改进' }}</span><span class="rounded-md px-2 py-0.5 text-[9px] font-semibold" :class="statusMeta[item.status].class"><component :is="statusMeta[item.status].icon" class="mr-1 inline h-3 w-3" />{{ statusMeta[item.status].label }}</span><span class="rounded-md bg-ink/5 px-2 py-0.5 text-[9px] text-faint">{{ item.siteType }}</span><span v-if="item.model" class="rounded-md bg-ink/5 px-2 py-0.5 text-[9px] text-faint">{{ item.model }}</span></div><p class="mt-2 line-clamp-2 text-xs leading-5 text-mut">{{ item.message || (item.categories.length ? item.categories.map((category) => categoryLabels[category] || category).join('、') : '用户未补充文字说明') }}</p><p class="mt-2 font-mono text-[9px] text-faint">Project {{ item.projectId }} · Version {{ item.versionId }}</p></div>
                <div class="shrink-0 text-right"><time class="text-[10px] text-faint">{{ formatDate(item.updatedAt) }}</time><ChevronDown class="mt-3 ml-auto h-4 w-4 text-faint transition" :class="expandedId === item.id ? 'rotate-180' : ''" /></div>
              </button>
              <div v-if="expandedId === item.id" class="border-t border-line/8 bg-app/30 px-4 py-4 sm:px-5">
                <div class="flex flex-wrap gap-1.5"><span v-for="category in item.categories" :key="category" class="rounded-full border border-line/10 bg-soft/70 px-2.5 py-1 text-[10px] text-sub">{{ categoryLabels[category] || category }}</span><span v-if="!item.categories.length" class="text-[10px] text-faint">未选择具体分类</span></div>
                <blockquote v-if="item.message" class="mt-3 rounded-xl border-l-2 border-brand1 bg-brand1/[0.045] px-4 py-3 text-xs leading-6 text-sub">{{ item.message }}</blockquote>
                <div class="mt-4 flex flex-wrap items-center justify-between gap-3"><div class="text-[9px] text-faint"><span>User {{ item.userId }}</span><span class="ml-3">Created {{ formatDate(item.createdAt) }}</span></div><div v-if="canResolve" class="flex gap-1.5"><button v-for="next in feedbackStatuses" :key="next" :disabled="actionBusy === item.id || item.status === next" class="rounded-lg border px-2.5 py-1.5 text-[10px] font-medium transition disabled:opacity-35" :class="item.status === next ? statusMeta[next].class + ' border-transparent' : 'border-line/10 text-faint hover:text-ink'" @click.stop="updateStatus(item,next)"><Loader2 v-if="actionBusy === item.id && item.status !== next" class="mr-1 inline h-3 w-3 animate-spin" />{{ statusMeta[next].label }}</button></div><span v-else class="text-[10px] text-faint">当前角色仅可查看反馈</span></div>
              </div>
            </article>
          </div>
          <div v-else class="mt-4 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-line/15 bg-soft/35 p-8 text-center"><MessageSquareText class="h-8 w-8 text-faint" /><h3 class="mt-4 text-sm font-semibold">暂无匹配反馈</h3><p class="mt-2 text-xs text-mut">调整筛选条件，或等待用户在项目版本中提交体验反馈。</p><button class="mt-4 text-xs font-medium text-brand1 hover:underline" @click="resetFilters">重置筛选</button></div>
        </section>

        <aside class="space-y-5">
          <article class="rounded-2xl border border-line/10 bg-soft/60 p-5"><h2 class="text-sm font-semibold text-ink">负向问题分布</h2><p class="mt-1 text-[11px] text-faint">仅统计“需要改进”的反馈分类</p><div v-if="summary.topCategories.length" class="mt-5 grid gap-3"><div v-for="item in summary.topCategories" :key="item.category"><div class="flex items-center justify-between text-[10px]"><span class="text-sub">{{ categoryLabels[item.category] || item.category }}</span><strong class="text-ink">{{ item.count }}</strong></div><div class="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.05]"><div class="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500" :style="{ width: `${item.count / maxCategory * 100}%` }" /></div></div></div><p v-else class="mt-5 text-xs text-faint">还没有负向问题分类数据。</p></article>
          <article class="rounded-2xl border border-line/10 bg-soft/60 p-5"><h2 class="text-sm font-semibold text-ink">处理建议</h2><div class="mt-4 grid gap-3 text-xs leading-5 text-mut"><div class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand1/10 text-[9px] font-bold text-brand1">1</span><p>先将新反馈标记为“已查看”，避免多人重复排查。</p></div><div class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand1/10 text-[9px] font-bold text-brand1">2</span><p>相同模型、站点类型和分类重复出现时，加入离线评测集。</p></div><div class="flex gap-3"><span class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand1/10 text-[9px] font-bold text-brand1">3</span><p>Prompt 或模板修复上线后，将对应反馈标记为“已解决”。</p></div></div></article>
        </aside>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Wrench,
  XCircle,
} from 'lucide-vue-next'
import {
  analyzeSiteQuality,
  type QualityCategory,
  type QualityIssue,
  type QualitySeverity,
} from '../lib/siteQuality'

const props = withDefaults(defineProps<{
  html: string
  ignoredRules?: string[]
  compact?: boolean
}>(), { ignoredRules: () => [], compact: false })
const emit = defineEmits<{
  (event: 'apply', issue: QualityIssue): void
  (event: 'apply-all', issues: QualityIssue[]): void
  (event: 'focus', issue: QualityIssue): void
  (event: 'ignore', rule: string): void
}>()

const query = ref('')
const severity = ref<QualitySeverity | 'all'>('all')
const category = ref<QualityCategory | 'all'>('all')
const expanded = ref('')
const report = computed(() => analyzeSiteQuality(props.html))
const visible = computed(() => report.value.issues.filter((item) => {
  const keyword = query.value.trim().toLowerCase()
  return !props.ignoredRules.includes(item.rule)
    && (severity.value === 'all' || item.severity === severity.value)
    && (category.value === 'all' || item.category === category.value)
    && (!keyword || `${item.title} ${item.description} ${item.elementLabel ?? ''}`.toLowerCase().includes(keyword))
}))
const fixable = computed(() => visible.value.filter((item) => item.fixable))

const categoryLabels: Record<QualityCategory, string> = {
  content: '内容', images: '图片', links: '链接', responsive: '响应式', accessibility: '无障碍', seo: 'SEO',
}
const severityMeta: Record<QualitySeverity, { label: string; class: string; icon: typeof XCircle }> = {
  error: { label: '必须修复', class: 'bg-red-500/10 text-red-500', icon: XCircle },
  warning: { label: '建议修复', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', icon: AlertTriangle },
  suggestion: { label: '优化建议', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', icon: Info },
}

function scoreMeta(score: number) {
  if (score >= 90) return { label: '状态优秀', class: 'text-emerald-500', ring: 'border-emerald-500/25 bg-emerald-500/[0.06]' }
  if (score >= 70) return { label: '可以改进', class: 'text-amber-500', ring: 'border-amber-500/25 bg-amber-500/[0.06]' }
  return { label: '需要处理', class: 'text-red-500', ring: 'border-red-500/25 bg-red-500/[0.06]' }
}
</script>

<template>
  <section class="flex min-h-0 flex-col" :class="compact ? '' : 'rounded-3xl border border-line/10 bg-soft/58'">
    <header class="border-b border-line/10 p-4 sm:p-5">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3"><span class="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-500"><ShieldCheck class="h-5 w-5" /></span><div><h2 class="text-sm font-semibold text-ink">站点质量检查</h2><p class="mt-1 text-[11px] text-faint">内容、响应式、无障碍和 SEO 的发布前检查。</p></div></div>
        <div class="flex items-center gap-3 rounded-2xl border p-3" :class="scoreMeta(report.score).ring"><strong class="text-2xl text-ink">{{ report.score }}</strong><div><p class="text-[10px] font-semibold" :class="scoreMeta(report.score).class">{{ scoreMeta(report.score).label }}</p><p class="mt-0.5 text-[9px] text-faint">满分 100</p></div></div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2 text-center"><div class="rounded-xl bg-red-500/[0.055] p-2"><strong class="text-sm text-red-500">{{ report.counts.error }}</strong><p class="text-[9px] text-faint">必须修复</p></div><div class="rounded-xl bg-amber-500/[0.055] p-2"><strong class="text-sm text-amber-500">{{ report.counts.warning }}</strong><p class="text-[9px] text-faint">建议修复</p></div><div class="rounded-xl bg-sky-500/[0.055] p-2"><strong class="text-sm text-sky-500">{{ report.counts.suggestion }}</strong><p class="text-[9px] text-faint">优化建议</p></div></div>
    </header>
    <div class="border-b border-line/10 p-3 sm:p-4"><label class="flex items-center gap-2 rounded-xl border border-line/10 bg-app/55 px-3 py-2 focus-within:border-brand1/35"><Search class="h-3.5 w-3.5 text-faint" /><input v-model="query" placeholder="搜索问题或元素" class="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-faint" /></label><div class="mt-2 grid grid-cols-2 gap-2"><label class="relative"><select v-model="severity" class="w-full appearance-none rounded-xl border border-line/10 bg-app/55 py-2 pr-8 pl-3 text-[10px] text-sub outline-none"><option value="all">全部级别</option><option value="error">必须修复</option><option value="warning">建议修复</option><option value="suggestion">优化建议</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-faint" /></label><label class="relative"><select v-model="category" class="w-full appearance-none rounded-xl border border-line/10 bg-app/55 py-2 pr-8 pl-3 text-[10px] text-sub outline-none"><option value="all">全部分类</option><option v-for="(label,key) in categoryLabels" :key="key" :value="key">{{ label }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-faint" /></label></div><button v-if="fixable.length" class="bg-brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white" @click="emit('apply-all',fixable)"><WandSparkles class="h-3.5 w-3.5" />安全修复 {{ fixable.length }} 项</button></div>
    <div class="min-h-0 flex-1 overflow-y-auto"><article v-for="item in visible" :key="item.id" class="border-b border-line/8 p-4 last:border-0"><button class="flex w-full items-start gap-3 text-left" @click="expanded = expanded === item.id ? '' : item.id"><span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl" :class="severityMeta[item.severity].class"><component :is="severityMeta[item.severity].icon" class="h-4 w-4" /></span><span class="min-w-0 flex-1"><span class="flex flex-wrap items-center gap-1.5"><strong class="text-xs text-ink">{{ item.title }}</strong><span class="rounded bg-ink/5 px-1.5 py-0.5 text-[8px] text-faint">{{ categoryLabels[item.category] }}</span></span><span class="mt-1 block truncate text-[10px] text-faint">{{ item.elementLabel || item.selector || '页面级问题' }}</span></span><ChevronDown class="mt-2 h-3.5 w-3.5 shrink-0 text-faint transition" :class="expanded === item.id && 'rotate-180'" /></button><div v-if="expanded === item.id" class="mt-3 rounded-xl bg-app/45 p-3"><p class="text-[11px] leading-5 text-mut">{{ item.description }}</p><div class="mt-3 flex flex-wrap gap-2"><button v-if="item.selector" class="flex items-center gap-1 rounded-lg border border-line/10 px-2.5 py-1.5 text-[10px] text-sub hover:text-brand1" @click="emit('focus',item)"><Eye class="h-3 w-3" />定位</button><button v-if="item.fixable" class="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-emerald-600" @click="emit('apply',item)"><Wrench class="h-3 w-3" />自动修复</button><button class="rounded-lg border border-line/10 px-2.5 py-1.5 text-[10px] text-faint hover:text-ink" @click="emit('ignore',item.rule)">忽略同类</button></div></div></article><div v-if="!visible.length" class="flex min-h-72 flex-col items-center justify-center p-8 text-center"><span class="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500"><CheckCircle2 class="h-7 w-7" /></span><h3 class="mt-4 text-sm font-semibold text-ink">当前筛选下没有问题</h3><p class="mt-2 text-xs leading-5 text-mut">继续完善内容，或切换筛选查看其他质量维度。</p></div></div>
    <footer v-if="!compact" class="flex items-center gap-2 border-t border-line/10 px-4 py-3 text-[10px] text-faint"><Sparkles class="h-3 w-3 text-brand1" />自动检查不会替代真实设备和人工内容审核。</footer>
  </section>
</template>

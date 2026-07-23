<script setup lang="ts">
import { computed } from 'vue'
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-vue-next'
import type { RuntimeQualityReport } from '../lib/runtimeQuality'

const props = withDefaults(defineProps<{ report?: RuntimeQualityReport | null; loading?: boolean; error?: string }>(), { report: null, loading: false, error: '' })
const emit = defineEmits<{ (event: 'run'): void; (event: 'focus', selector: string): void }>()
const counts = computed(() => ({
  error: props.report?.issues.filter((item) => item.severity === 'error').length ?? 0,
  warning: props.report?.issues.filter((item) => item.severity === 'warning').length ?? 0,
  suggestion: props.report?.issues.filter((item) => item.severity === 'suggestion').length ?? 0,
}))
const labels = { overflow: '溢出', touch: '触控', images: '图片', content: '内容', accessibility: '无障碍' }
</script>

<template>
  <section class="rounded-2xl border border-line/10 bg-soft/45">
    <header class="flex items-start justify-between gap-4 border-b border-line/10 p-4">
      <div class="flex gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-500"><Activity class="h-4 w-4" /></span><div><h3 class="text-xs font-semibold">真实渲染检查</h3><p class="mt-1 text-[10px] leading-5 text-faint">测量当前设备视口中的溢出、点击区域、拉伸和对比度。</p></div></div>
      <button :disabled="loading" class="flex shrink-0 items-center gap-1.5 rounded-lg border border-line/10 px-2.5 py-2 text-[10px] text-sub hover:text-brand1 disabled:opacity-45" @click="emit('run')"><Loader2 v-if="loading" class="h-3.5 w-3.5 animate-spin" /><RefreshCw v-else class="h-3.5 w-3.5" />{{ report ? '重新检查' : '开始检查' }}</button>
    </header>
    <div v-if="error" class="m-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-[10px] leading-5 text-red-500">{{ error }}</div>
    <div v-else-if="report" class="p-4">
      <div class="grid grid-cols-3 gap-2 text-center"><div class="rounded-xl bg-red-500/[0.055] p-2"><strong class="text-sm text-red-500">{{ counts.error }}</strong><p class="text-[8px] text-faint">严重</p></div><div class="rounded-xl bg-amber-500/[0.055] p-2"><strong class="text-sm text-amber-500">{{ counts.warning }}</strong><p class="text-[8px] text-faint">警告</p></div><div class="rounded-xl bg-sky-500/[0.055] p-2"><strong class="text-sm text-sky-500">{{ counts.suggestion }}</strong><p class="text-[8px] text-faint">建议</p></div></div>
      <p class="mt-3 text-[9px] text-faint">视口 {{ report.viewport.width }}×{{ report.viewport.height }} · 页面 {{ report.viewport.scrollWidth }}×{{ report.viewport.scrollHeight }}</p>
      <div v-if="report.issues.length" class="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1"><button v-for="issue in report.issues" :key="issue.id" class="flex w-full items-start gap-2 rounded-xl border border-line/8 bg-app/45 p-3 text-left hover:border-brand1/20" @click="issue.selector && emit('focus', issue.selector)"><AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0" :class="issue.severity === 'error' ? 'text-red-500' : issue.severity === 'warning' ? 'text-amber-500' : 'text-sky-500'" /><span class="min-w-0 flex-1"><span class="flex items-center gap-1.5"><strong class="text-[10px] text-ink">{{ issue.title }}</strong><span class="rounded bg-ink/5 px-1.5 py-0.5 text-[8px] text-faint">{{ labels[issue.category] }}</span></span><span class="mt-1 block text-[9px] leading-4 text-mut">{{ issue.description }}</span><span v-if="issue.elementLabel" class="mt-1 block truncate font-mono text-[8px] text-faint">{{ issue.elementLabel }}</span></span></button></div>
      <div v-else class="flex min-h-32 flex-col items-center justify-center text-center"><CheckCircle2 class="h-7 w-7 text-emerald-500" /><p class="mt-3 text-xs font-semibold">当前视口未发现运行时问题</p></div>
    </div>
    <div v-else class="flex min-h-36 flex-col items-center justify-center p-5 text-center"><Activity class="h-7 w-7 text-faint" /><p class="mt-3 text-[10px] leading-5 text-mut">页面完成渲染后运行检查；切换设备尺寸后可重新测量。</p></div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Columns2, Eye, ListFilter } from 'lucide-vue-next'
import { analyzeVersionDiff } from '../lib/versionDiff'

const props = defineProps<{ beforeHtml: string; afterHtml: string; beforeLabel?: string; afterLabel?: string }>()
const slider = ref(50)
const mode = ref<'overlay' | 'split'>('overlay')
const changedOnly = ref(true)
const category = ref<'all' | 'sections' | 'content' | 'images' | 'links' | 'seo' | 'style'>('all')
const report = computed(() => analyzeVersionDiff(props.beforeHtml, props.afterHtml))
const changes = computed(() => report.value.changes.filter((item) => category.value === 'all' || item.category === category.value))
const categories = { all: '全部', sections: '区块', content: '内容', images: '图片', links: '链接', seo: 'SEO', style: '样式' }
const kindClass = { added: 'bg-emerald-500/10 text-emerald-500', removed: 'bg-red-500/10 text-red-500', changed: 'bg-amber-500/10 text-amber-500', moved: 'bg-sky-500/10 text-sky-500', metadata: 'bg-violet-500/10 text-violet-500' }
const kindLabel = { added: '新增', removed: '移除', changed: '修改', moved: '移动', metadata: '元数据' }
</script>

<template>
  <section class="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
    <div class="overflow-hidden rounded-2xl border border-line/10 bg-soft/55">
      <header class="flex flex-wrap items-center gap-2 border-b border-line/10 px-3 py-2.5"><div class="flex rounded-lg bg-ink/[0.04] p-1"><button class="rounded-md px-2.5 py-1.5 text-[10px]" :class="mode === 'overlay' ? 'bg-soft font-semibold shadow-sm' : 'text-faint'" @click="mode = 'overlay'"><Eye class="mr-1 inline h-3 w-3" />滑动对比</button><button class="rounded-md px-2.5 py-1.5 text-[10px]" :class="mode === 'split' ? 'bg-soft font-semibold shadow-sm' : 'text-faint'" @click="mode = 'split'"><Columns2 class="mr-1 inline h-3 w-3" />并排</button></div><span class="ml-auto text-[9px] text-faint">差异强度 {{ report.score }} / 100</span></header>
      <div v-if="mode === 'overlay'" class="relative h-[620px] overflow-hidden bg-white">
        <iframe :srcdoc="afterHtml" sandbox="allow-scripts" class="absolute inset-0 h-full w-full" title="新版本预览" />
        <div class="pointer-events-none absolute inset-y-0 left-0 overflow-hidden border-r-2 border-cyan-400" :style="{ width: `${slider}%` }"><iframe :srcdoc="beforeHtml" sandbox="allow-scripts" class="h-full max-w-none" :style="{ width: `${10000 / Math.max(slider, 1)}%` }" title="旧版本预览" /></div>
        <div class="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan-400 shadow-lg" :style="{ left: `${slider}%` }"><span class="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cyan-500 text-xs font-bold text-white shadow-xl">↔</span></div>
        <input v-model.number="slider" type="range" min="5" max="95" aria-label="拖动查看版本差异" class="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
        <span class="absolute top-3 left-3 rounded-full bg-black/70 px-2.5 py-1 text-[9px] text-white">{{ beforeLabel || '对比版本' }}</span><span class="absolute top-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[9px] text-white">{{ afterLabel || '当前版本' }}</span>
      </div>
      <div v-else class="grid h-[620px] grid-cols-2 divide-x divide-line/10"><div class="relative"><span class="absolute top-3 left-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[9px] text-white">{{ beforeLabel || '对比版本' }}</span><iframe :srcdoc="beforeHtml" sandbox="allow-scripts" class="h-full w-full bg-white" title="对比版本预览" /></div><div class="relative"><span class="absolute top-3 right-3 z-10 rounded-full bg-black/70 px-2.5 py-1 text-[9px] text-white">{{ afterLabel || '当前版本' }}</span><iframe :srcdoc="afterHtml" sandbox="allow-scripts" class="h-full w-full bg-white" title="当前版本预览" /></div></div>
    </div>

    <aside class="min-h-0 overflow-hidden rounded-2xl border border-line/10 bg-soft/55"><header class="border-b border-line/10 p-4"><div class="flex items-center gap-2"><ListFilter class="h-4 w-4 text-brand1" /><h3 class="text-xs font-semibold">结构化差异</h3></div><p class="mt-2 text-[10px] leading-5 text-mut">{{ report.summary.join(' · ') }}</p><label class="mt-3 flex items-center gap-2 text-[9px] text-faint"><input v-model="changedOnly" type="checkbox" class="accent-violet-500" />仅显示发生变化的项目</label><div class="mt-3 flex flex-wrap gap-1"><button v-for="(label,key) in categories" :key="key" class="rounded-full px-2.5 py-1 text-[9px]" :class="category === key ? 'bg-brand1/10 font-semibold text-brand1' : 'bg-ink/[0.04] text-faint'" @click="category = key">{{ label }}</button></div></header>
      <div class="max-h-[540px] overflow-y-auto p-3"><article v-for="change in changes" :key="change.id" class="mb-2 rounded-xl border border-line/8 bg-app/45 p-3"><div class="flex items-start gap-2"><span class="rounded-full px-2 py-0.5 text-[8px] font-semibold" :class="kindClass[change.kind]">{{ kindLabel[change.kind] }}</span><div class="min-w-0 flex-1"><h4 class="text-[10px] font-semibold">{{ change.title }}</h4><p class="mt-1 text-[9px] leading-4 text-mut">{{ change.description }}</p><details v-if="change.before || change.after" class="mt-2"><summary class="cursor-pointer text-[8px] text-brand1">查看内容摘要</summary><div class="mt-2 grid gap-1 font-mono text-[8px] leading-4 text-faint"><p v-if="change.before" class="rounded bg-red-500/[0.04] p-2">- {{ change.before.slice(0, 220) }}</p><p v-if="change.after" class="rounded bg-emerald-500/[0.04] p-2">+ {{ change.after.slice(0, 220) }}</p></div></details></div></div></article><div v-if="!changes.length" class="flex min-h-52 items-center justify-center text-center text-xs text-mut">当前筛选下没有差异。</div></div>
    </aside>
  </section>
</template>

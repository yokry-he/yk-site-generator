<script setup lang="ts">
import { FileClock, Loader2, RotateCcw, Star } from 'lucide-vue-next'
import AppDrawer from './ui/AppDrawer.vue'
import type { ProjectVersionSummary } from '../lib/workspace'

withDefaults(defineProps<{
  open: boolean
  versions: ProjectVersionSummary[]
  selectedId?: string
  busy?: string
}>(), { selectedId: '', busy: '' })
const emit = defineEmits<{
  (event: 'close'): void
  (event: 'select', version: ProjectVersionSummary): void
  (event: 'rollback', version: ProjectVersionSummary): void
}>()

function sourceLabel(source: ProjectVersionSummary['source']): string {
  return { generate: 'AI 生成', iterate: 'AI 迭代', editor: '可视化编辑', import: '模板/导入' }[source]
}
</script>

<template>
  <AppDrawer :open="open" side="bottom" title="版本历史" description="选择版本预览，或基于旧版本创建新版本。" @close="emit('close')">
    <div class="max-h-[68vh] space-y-2 overflow-y-auto p-3">
      <article v-for="version in versions" :key="version.id" class="rounded-2xl border p-3" :class="selectedId === version.id ? 'border-brand1/30 bg-brand1/[0.07]' : 'border-line/10 bg-soft/45'">
        <button class="flex w-full items-start gap-3 text-left" @click="emit('select',version);emit('close')"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand1/10 text-brand1"><FileClock class="h-4 w-4" /></span><span class="min-w-0 flex-1"><span class="flex items-center gap-2"><strong class="truncate text-xs">{{ version.name || `第 ${version.version} 版` }}</strong><Star v-if="version.starred" class="h-3 w-3 fill-current text-amber-500" /></span><span class="mt-1 block line-clamp-2 text-[10px] leading-4 text-mut">{{ version.note || version.instruction || '未添加版本说明' }}</span><span class="mt-2 block text-[9px] text-faint">{{ sourceLabel(version.source) }} · {{ (version.sizeBytes/1024).toFixed(1) }}KB</span></span></button>
        <button v-if="selectedId !== version.id" :disabled="busy === `rollback:${version.id}`" class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line/10 px-3 py-2 text-[10px] text-sub disabled:opacity-50" @click="emit('rollback',version)"><Loader2 v-if="busy === `rollback:${version.id}`" class="h-3.5 w-3.5 animate-spin" /><RotateCcw v-else class="h-3.5 w-3.5" />以此版本创建新版本</button>
      </article>
      <div v-if="!versions.length" class="flex min-h-48 items-center justify-center text-xs text-faint">该项目还没有版本。</div>
    </div>
  </AppDrawer>
</template>

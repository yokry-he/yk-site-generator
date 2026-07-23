<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Monitor, Smartphone } from 'lucide-vue-next'
import SiteQualityPanel from './SiteQualityPanel.vue'
import RuntimeQualityPanel from './RuntimeQualityPanel.vue'
import { buildRuntimeAuditPreview, runRuntimeAudit, type RuntimeQualityReport } from '../lib/runtimeQuality'
import type { QualityIssue } from '../lib/siteQuality'

const props = withDefaults(defineProps<{ html: string; ignoredRules?: string[] }>(), { ignoredRules: () => [] })
const emit = defineEmits<{ (event: 'apply', issue: QualityIssue): void; (event: 'apply-all', issues: QualityIssue[]): void; (event: 'ignore', rule: string): void }>()
const iframeRef = ref<HTMLIFrameElement>()
const viewport = ref<'desktop' | 'mobile'>('desktop')
const report = ref<RuntimeQualityReport | null>(null)
const loading = ref(false)
const error = ref('')
const previewHtml = computed(() => buildRuntimeAuditPreview(props.html))

async function run() {
  if (!iframeRef.value || loading.value) return
  loading.value = true
  error.value = ''
  try { await nextTick(); report.value = await runRuntimeAudit(iframeRef.value) }
  catch { error.value = '页面尚未完成渲染，请稍后重新检查。' }
  finally { loading.value = false }
}
function focus(selector: string) {
  iframeRef.value?.contentWindow?.postMessage({ source: 'siteforge-runtime-quality-parent', type: 'focus-selector', selector }, '*')
}
watch(() => props.html, () => { report.value = null; error.value = '' })
watch(viewport, () => { report.value = null })
</script>

<template>
  <div class="grid min-h-[680px] gap-4 p-4 xl:grid-cols-[380px_minmax(0,1fr)]">
    <div class="space-y-4"><SiteQualityPanel compact :html="html" :ignored-rules="ignoredRules" @apply="emit('apply',$event)" @apply-all="emit('apply-all',$event)" @ignore="emit('ignore',$event)" @focus="focus($event.selector || 'body')" /><RuntimeQualityPanel :report="report" :loading="loading" :error="error" @run="run" @focus="focus" /></div>
    <section class="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-line/10 bg-soft/55"><header class="flex items-center gap-3 border-b border-line/10 bg-app/45 px-4 py-3"><p class="text-xs font-semibold">检查预览</p><div class="ml-auto flex rounded-lg bg-ink/[0.04] p-1"><button class="rounded-md p-1.5" :class="viewport === 'desktop' ? 'bg-soft text-brand1 shadow-sm' : 'text-faint'" aria-label="桌面预览" @click="viewport = 'desktop'"><Monitor class="h-3.5 w-3.5" /></button><button class="rounded-md p-1.5" :class="viewport === 'mobile' ? 'bg-soft text-brand1 shadow-sm' : 'text-faint'" aria-label="手机预览" @click="viewport = 'mobile'"><Smartphone class="h-3.5 w-3.5" /></button></div></header><div class="min-h-0 flex-1 bg-ink/[0.035] p-3"><div class="mx-auto h-full overflow-hidden rounded-xl border border-line/10 bg-white shadow-xl transition-[max-width]" :class="viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-none'"><iframe ref="iframeRef" :srcdoc="previewHtml" sandbox="allow-scripts" referrerpolicy="no-referrer" class="h-full min-h-[590px] w-full" title="质量检查预览" /></div></div></section>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle, PencilRuler, RotateCcw } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import GenerationBrief from '../components/GenerationBrief.vue'
import GeneratorDemo from '../components/GeneratorDemo.vue'
import GeneratorArtifactBar from '../components/GeneratorArtifactBar.vue'
import { SITE_TYPES } from '../data/siteTypes'

const route = useRoute()
const hostRef = ref<HTMLElement>()
const artifactBarRef = ref<{ openEditor: () => void }>()
const artifactHtml = ref('')
const siteType = ref('website')
const recoveryVisible = ref(false)
let observer: MutationObserver | null = null
let scanTimer: ReturnType<typeof setInterval> | null = null

const prompt = ref(
  typeof route.query.q === 'string' && route.query.q
    ? route.query.q
    : SITE_TYPES.find((type) => type.id === 'dashboard')!.example,
)

function findButton(label: string): HTMLButtonElement | undefined {
  return [...(hostRef.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((item) => item.textContent?.trim().includes(label))
}

function wireLegacyEditorButton(host: HTMLElement) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent?.includes('进入编辑'))
  if (!button || button.dataset.sfEditorWired) return
  button.dataset.sfEditorWired = 'true'
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopImmediatePropagation()
    artifactBarRef.value?.openEditor()
  }, { capture: true })
}

function scanArtifact() {
  const host = hostRef.value
  if (!host) return
  wireLegacyEditorButton(host)
  const iframe = host.querySelector<HTMLIFrameElement>('iframe[title="生成产物预览"]')
  const html = iframe?.srcdoc || iframe?.getAttribute('srcdoc') || ''
  if (html && html !== artifactHtml.value) artifactHtml.value = html
  const typeMatch = host.textContent?.match(/siteforge\s+generate\s+--type\s+([A-Za-z0-9_-]+)/i)
  if (typeMatch?.[1]) siteType.value = typeMatch[1]
  recoveryVisible.value = Boolean(findButton('重试'))
}

function applyEditedHtml(html: string) {
  artifactHtml.value = html
  const iframe = hostRef.value?.querySelector<HTMLIFrameElement>('iframe[title="生成产物预览"]')
  if (iframe) {
    iframe.srcdoc = html
    iframe.setAttribute('srcdoc', html)
  }
}

function retryGeneration() {
  findButton('重试')?.click()
}

function editRetainedArtifact() {
  artifactBarRef.value?.openEditor()
}

watch(() => route.query.q, (value) => {
  if (typeof value === 'string' && value) prompt.value = value
})

onMounted(async () => {
  await nextTick()
  scanArtifact()
  observer = new MutationObserver(scanArtifact)
  if (hostRef.value) observer.observe(hostRef.value, { childList: true, subtree: true, attributes: true, attributeFilter: ['srcdoc'] })
  scanTimer = setInterval(scanArtifact, 500)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (scanTimer) clearInterval(scanTimer)
})
</script>

<template>
  <main class="pt-8">
    <GenerationBrief :prompt="prompt" @update:prompt="prompt = $event" />
    <div v-if="recoveryVisible" class="mx-auto mt-5 flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
      <div class="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.055] p-4">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div><p class="text-xs font-semibold text-ink">生成没有完整结束，但已有内容不会丢失</p><p class="mt-1 text-[11px] leading-5 text-mut">可原样重试；已有上一份完整页面时，也可以先进入编辑器继续完善，避免重新开始。</p></div>
      </div>
      <div class="flex shrink-0 gap-2">
        <button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line/10 bg-soft/60 px-4 py-3 text-xs font-semibold text-sub lg:flex-none" @click="retryGeneration"><RotateCcw class="h-3.5 w-3.5" />重试生成</button>
        <button v-if="artifactHtml" class="bg-brand-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold text-white lg:flex-none" @click="editRetainedArtifact"><PencilRuler class="h-3.5 w-3.5" />编辑已保留页面</button>
      </div>
    </div>
    <div ref="hostRef"><GeneratorDemo v-model:prompt="prompt" /></div>
    <GeneratorArtifactBar ref="artifactBarRef" :html="artifactHtml" :prompt="prompt" :site-type="siteType" @update:html="applyEditedHtml" />
  </main>
</template>

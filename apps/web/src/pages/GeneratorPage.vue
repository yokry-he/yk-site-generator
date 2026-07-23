<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import GeneratorDemo from '../components/GeneratorDemo.vue'
import GeneratorArtifactBar from '../components/GeneratorArtifactBar.vue'
import { SITE_TYPES } from '../data/siteTypes'

const route = useRoute()
const hostRef = ref<HTMLElement>()
const artifactBarRef = ref<{ openEditor: () => void }>()
const artifactHtml = ref('')
const siteType = ref('website')
let observer: MutationObserver | null = null
let scanTimer: ReturnType<typeof setInterval> | null = null

// 从首页 Hero 带过来的需求文本(query.q,刷新/分享链接也能保留)
const prompt = ref(
  typeof route.query.q === 'string' && route.query.q
    ? route.query.q
    : SITE_TYPES.find((type) => type.id === 'dashboard')!.example,
)

function wireLegacyEditorButton(host: HTMLElement) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find((item) =>
    item.textContent?.includes('进入编辑'),
  )
  if (!button || button.dataset.sfEditorWired) return
  button.dataset.sfEditorWired = 'true'
  button.addEventListener(
    'click',
    (event) => {
      event.preventDefault()
      event.stopImmediatePropagation()
      artifactBarRef.value?.openEditor()
    },
    { capture: true },
  )
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
}

function applyEditedHtml(html: string) {
  artifactHtml.value = html
  const iframe = hostRef.value?.querySelector<HTMLIFrameElement>('iframe[title="生成产物预览"]')
  if (iframe) {
    iframe.srcdoc = html
    iframe.setAttribute('srcdoc', html)
  }
}

watch(
  () => route.query.q,
  (value) => {
    if (typeof value === 'string' && value) prompt.value = value
  },
)

onMounted(async () => {
  await nextTick()
  scanArtifact()
  observer = new MutationObserver(scanArtifact)
  if (hostRef.value) {
    observer.observe(hostRef.value, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['srcdoc'],
    })
  }
  scanTimer = setInterval(scanArtifact, 500)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (scanTimer) clearInterval(scanTimer)
})
</script>

<template>
  <main class="pt-8">
    <div ref="hostRef">
      <GeneratorDemo v-model:prompt="prompt" />
    </div>
    <GeneratorArtifactBar
      ref="artifactBarRef"
      :html="artifactHtml"
      :prompt="prompt"
      :site-type="siteType"
      @update:html="applyEditedHtml"
    />
  </main>
</template>

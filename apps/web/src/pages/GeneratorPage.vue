<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, PencilRuler, RotateCcw } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import GenerationBrief from '../components/GenerationBrief.vue'
import GeneratorDemo from '../components/GeneratorDemo.vue'
import GeneratorArtifactBar from '../components/GeneratorArtifactBar.vue'
import { SITE_TYPES } from '../data/siteTypes'

const route = useRoute()
const generatorRef = ref<{ retryGeneration: () => void }>()
const artifactBarRef = ref<{ openEditor: () => void }>()
const artifactHtml = ref('')
const siteType = ref('website')
const recoveryVisible = ref(false)
const prompt = ref(
  typeof route.query.q === 'string' && route.query.q
    ? route.query.q
    : SITE_TYPES.find((type) => type.id === 'dashboard')!.example,
)

function retryGeneration() {
  generatorRef.value?.retryGeneration()
}

function editRetainedArtifact() {
  artifactBarRef.value?.openEditor()
}

function applyEditedHtml(html: string) {
  artifactHtml.value = html
}

watch(() => route.query.q, (value) => {
  if (typeof value === 'string' && value) prompt.value = value
})
</script>

<template>
  <main class="pt-8">
    <GenerationBrief :prompt="prompt" @update:prompt="prompt = $event" />
    <div v-if="recoveryVisible" class="mx-auto mt-5 flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
      <div class="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.055] p-4">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div><p class="text-xs font-semibold text-ink">生成没有完整结束，但已有内容不会丢失</p><p class="mt-1 text-[11px] leading-5 text-mut">可原样重试；已有页面内容时，也可以先进入编辑器继续完善，避免重新开始。</p></div>
      </div>
      <div class="flex shrink-0 gap-2">
        <button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line/10 bg-soft/60 px-4 py-3 text-xs font-semibold text-sub lg:flex-none" @click="retryGeneration"><RotateCcw class="h-3.5 w-3.5" />重试生成</button>
        <button v-if="artifactHtml" class="bg-brand-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold text-white lg:flex-none" @click="editRetainedArtifact"><PencilRuler class="h-3.5 w-3.5" />编辑已保留页面</button>
      </div>
    </div>
    <GeneratorDemo
      ref="generatorRef"
      v-model:prompt="prompt"
      @artifact="artifactHtml = $event"
      @site-type="siteType = $event"
      @recovery="recoveryVisible = $event"
      @edit-artifact="editRetainedArtifact"
    />
    <GeneratorArtifactBar ref="artifactBarRef" :html="artifactHtml" :prompt="prompt" :site-type="siteType" @update:html="applyEditedHtml" />
  </main>
</template>

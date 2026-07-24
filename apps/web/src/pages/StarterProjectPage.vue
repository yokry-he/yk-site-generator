<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Monitor,
  RotateCcw,
  Smartphone,
  Sparkles,
  WandSparkles,
} from 'lucide-vue-next'
import {
  getOfficialTemplate,
  getStarterProject,
  renderStarterProject,
} from 'shared'
import GeneratorArtifactBar from '../components/GeneratorArtifactBar.vue'
import { useToast } from '../composables/useToast'
import {
  loadStarterProjectDraft,
  removeStarterProjectDraft,
  saveStarterProjectDraft,
} from '../lib/starterProjectDrafts'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const slug = computed(() => String(route.params.slug ?? ''))
const project = computed(() => getStarterProject(slug.value) ?? null)
const template = computed(() => project.value ? getOfficialTemplate(project.value.templateId) ?? null : null)
const html = ref('')
const viewport = ref<'desktop' | 'mobile'>('desktop')
const restoredDraft = ref(false)
const lastSavedAt = ref('')
const saveError = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let hydrating = false

const defaultHtml = computed(() => project.value ? renderStarterProject(project.value) : '')
const previewWidth = computed(() => viewport.value === 'mobile' ? '390px' : '1180px')
const projectPrompt = computed(() => project.value
  ? `内置项目：${project.value.name}。${project.value.description} 使用场景：${project.value.useCase}`
  : '')
const savedLabel = computed(() => {
  if (saveError.value) return saveError.value
  if (!lastSavedAt.value) return '修改会自动保存在当前浏览器'
  return `已自动保存 · ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastSavedAt.value))}`
})

function loadProject() {
  hydrating = true
  const draft = project.value ? loadStarterProjectDraft(project.value.slug) : null
  html.value = draft?.html || defaultHtml.value
  restoredDraft.value = Boolean(draft)
  lastSavedAt.value = draft?.updatedAt ?? ''
  saveError.value = ''
  queueMicrotask(() => { hydrating = false })
}

function scheduleSave() {
  if (hydrating || !project.value || !html.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      const draft = saveStarterProjectDraft(project.value!.slug, html.value)
      lastSavedAt.value = draft.updatedAt
      restoredDraft.value = true
      saveError.value = ''
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : '本地自动保存失败'
      toast.error('自动保存失败', saveError.value)
    }
  }, 350)
}

function resetProject() {
  if (!project.value) return
  if (!window.confirm('确定恢复为内置初始版本吗？当前浏览器中的编辑草稿会被清除。')) return
  if (saveTimer) clearTimeout(saveTimer)
  removeStarterProjectDraft(project.value.slug)
  hydrating = true
  html.value = defaultHtml.value
  restoredDraft.value = false
  lastSavedAt.value = ''
  saveError.value = ''
  queueMicrotask(() => { hydrating = false })
  toast.success('已恢复内置版本', '你可以重新编辑，新的修改仍会自动保存。')
}

function openInNewTab() {
  if (!html.value) return
  const url = URL.createObjectURL(new Blob([html.value], { type: 'text/html' }))
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function customizeWithAi() {
  if (!project.value) return
  void router.push({
    name: 'generator',
    query: { q: `基于内置项目「${project.value.name}」继续深度定制。保留成熟结构与响应式体验，并按以下方向修改：${project.value.description}` },
  })
}

watch(slug, loadProject, { immediate: true })
watch(html, scheduleSave)
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<template>
  <main class="min-h-screen pt-16 pb-20">
    <section v-if="!project || !template" class="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <Sparkles class="h-10 w-10 text-faint" />
      <h1 class="mt-5 text-2xl font-bold text-ink">内置项目不存在</h1>
      <p class="mt-3 text-sm text-mut">返回内置项目库选择一个可直接使用的成品。</p>
      <RouterLink to="/starters" class="bg-brand-gradient mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white">返回内置项目</RouterLink>
    </section>

    <template v-else>
      <section class="border-b border-line/8 bg-soft/35">
        <div class="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
          <button class="flex items-center gap-1.5 text-xs text-faint transition hover:text-brand1" @click="router.push('/starters')">
            <ArrowLeft class="h-3.5 w-3.5" />内置项目
          </button>
          <div class="mt-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div class="max-w-4xl">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold text-emerald-500"><CheckCircle2 class="h-3 w-3" />无需配置即可使用</span>
                <span class="rounded-full bg-ink/5 px-3 py-1 text-[10px] text-faint">{{ template.industry }}</span>
                <span v-if="restoredDraft" class="rounded-full bg-brand1/10 px-3 py-1 text-[10px] font-semibold text-brand1">已恢复本地草稿</span>
              </div>
              <h1 class="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-5xl">{{ project.name }}</h1>
              <p class="mt-3 max-w-3xl text-sm leading-7 text-mut sm:text-base">{{ project.description }}</p>
              <p class="mt-3 text-xs text-sub"><strong>适合：</strong>{{ project.useCase }}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="flex items-center gap-2 rounded-xl border border-line/12 px-4 py-3 text-sm font-medium text-sub transition hover:border-brand1/25 hover:text-brand1" @click="resetProject"><RotateCcw class="h-4 w-4" />恢复内置版本</button>
              <button class="flex items-center gap-2 rounded-xl border border-line/12 px-4 py-3 text-sm font-medium text-sub transition hover:border-brand1/25 hover:text-brand1" @click="openInNewTab"><ExternalLink class="h-4 w-4" />新标签预览</button>
              <button class="bg-brand-gradient flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/20" @click="customizeWithAi"><WandSparkles class="h-4 w-4" />AI 深度定制</button>
            </div>
          </div>
          <p class="mt-4 text-[11px]" :class="saveError ? 'text-red-500' : 'text-faint'">{{ savedLabel }}</p>
        </div>
      </section>

      <section class="mx-auto max-w-[1500px] px-3 py-6 sm:px-5 lg:px-8">
        <div class="overflow-hidden rounded-3xl border border-line/10 bg-soft/55 shadow-2xl shadow-black/[0.05]">
          <header class="flex items-center gap-3 border-b border-line/10 bg-app/55 px-4 py-3">
            <div class="flex gap-1.5"><span v-for="item in 3" :key="item" class="h-2.5 w-2.5 rounded-full bg-line/25" /></div>
            <div class="min-w-0 flex-1 truncate rounded-md bg-ink/[0.04] px-3 py-1.5 text-[10px] text-faint">local.siteforge/{{ project.slug }}</div>
            <div class="flex rounded-lg bg-ink/[0.04] p-1">
              <button aria-label="桌面预览" title="桌面预览" class="rounded-md p-1.5" :class="viewport === 'desktop' ? 'bg-soft text-sub shadow-sm' : 'text-faint'" @click="viewport = 'desktop'"><Monitor class="h-3.5 w-3.5" /></button>
              <button aria-label="手机预览" title="手机预览" class="rounded-md p-1.5" :class="viewport === 'mobile' ? 'bg-soft text-sub shadow-sm' : 'text-faint'" @click="viewport = 'mobile'"><Smartphone class="h-3.5 w-3.5" /></button>
            </div>
          </header>
          <div class="h-[680px] bg-ink/[0.035] p-3 sm:h-[760px]">
            <div class="mx-auto h-full overflow-hidden rounded-xl border border-line/10 bg-white shadow-2xl transition-[max-width]" :style="{ maxWidth: previewWidth }">
              <iframe :srcdoc="html" sandbox="allow-scripts" referrerpolicy="no-referrer" class="h-full w-full" title="内置项目预览" />
            </div>
          </div>
        </div>
      </section>

      <GeneratorArtifactBar
        :html="html"
        :prompt="projectPrompt"
        :site-type="template.siteType"
        @update:html="html = $event"
      />
    </template>
  </main>
</template>

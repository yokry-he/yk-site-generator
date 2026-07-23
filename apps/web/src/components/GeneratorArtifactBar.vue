<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Check,
  Cloud,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Package,
  PencilRuler,
  Save,
  UserRound,
} from 'lucide-vue-next'
import VisualEditor from './VisualEditor.vue'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import { downloadSiteZip } from '../lib/exportArtifact'
import { createTemporaryShare, type TemporaryShare } from '../lib/shares'
import { addProjectVersion, createProject } from '../lib/workspace'

const props = defineProps<{
  html: string
  prompt: string
  siteType: string
}>()
const emit = defineEmits<{ (event: 'update:html', html: string): void }>()

const { isAuthenticated } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const busy = ref('')
const share = ref<TemporaryShare | null>(null)
const copied = ref(false)
const editorOpen = ref(false)
const cloudProjectId = ref<string | null>(null)
const cloudVersion = ref(0)

const title = computed(() => {
  if (!props.html) return '未命名网站'
  try {
    const document = new DOMParser().parseFromString(props.html, 'text/html')
    return document.title.trim() || document.querySelector('h1')?.textContent?.trim() || 'SiteForge 网站'
  } catch {
    return 'SiteForge 网站'
  }
})
const expiresText = computed(() =>
  share.value
    ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(share.value.expiresAt))
    : '',
)

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '操作失败'
}

async function exportZip() {
  busy.value = 'zip'
  try {
    const file = await downloadSiteZip({
      html: props.html,
      title: title.value,
      siteType: props.siteType,
      requirement: props.prompt,
    })
    toast.success('ZIP 已导出', file)
  } catch (err) {
    toast.error('导出失败', messageOf(err))
  } finally {
    busy.value = ''
  }
}

async function createShare() {
  busy.value = 'share'
  try {
    share.value = await createTemporaryShare({
      html: props.html,
      title: title.value,
      siteType: props.siteType,
    })
    await copyShare()
    toast.success('7 天分享链接已生成', `有效期至 ${expiresText.value}`)
  } catch (err) {
    toast.error('分享创建失败', messageOf(err))
  } finally {
    busy.value = ''
  }
}

async function copyShare() {
  if (!share.value) return
  try {
    await navigator.clipboard.writeText(share.value.url)
    copied.value = true
    window.setTimeout(() => (copied.value = false), 1600)
  } catch {
    toast.error('复制失败', '请手动选择分享地址复制。')
  }
}

async function saveCloud(html = props.html, source: 'generate' | 'editor' = 'generate') {
  if (!isAuthenticated.value) {
    showAuth()
    return
  }
  busy.value = 'cloud'
  try {
    if (!cloudProjectId.value) {
      const project = await createProject({
        title: title.value,
        siteType: props.siteType,
        requirement: props.prompt,
        html,
        source,
        instruction: source === 'editor' ? '可视化编辑器修改' : props.prompt,
      })
      cloudProjectId.value = project.id
      cloudVersion.value = project.latestVersion?.version ?? 1
      toast.success('已保存到云端项目', `创建第 ${cloudVersion.value} 版,可在“我的项目”继续管理。`)
    } else {
      const version = await addProjectVersion(cloudProjectId.value, {
        html,
        source,
        instruction: source === 'editor' ? '可视化编辑器修改' : '保存当前生成产物',
      })
      cloudVersion.value = version.version
      toast.success('云端版本已保存', `当前为第 ${version.version} 版。`)
    }
  } catch (err) {
    toast.error('云端保存失败', messageOf(err))
  } finally {
    busy.value = ''
  }
}

async function saveEdited(html: string) {
  emit('update:html', html)
  editorOpen.value = false
  if (isAuthenticated.value) await saveCloud(html, 'editor')
  else toast.success('编辑已应用到当前预览', '登录后可将编辑结果保存为云端版本。')
}

watch(
  () => props.html,
  () => {
    share.value = null
    copied.value = false
  },
)
</script>

<template>
  <section v-if="html" class="mx-auto -mt-4 mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
    <div class="overflow-hidden rounded-2xl border border-line/10 bg-soft/85 shadow-xl shadow-black/[0.04] backdrop-blur">
      <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div class="flex min-w-0 items-center gap-3">
          <span class="bg-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-brand1/20">
            <Package class="h-4.5 w-4.5 text-white" />
          </span>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink">{{ title }}</p>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
              <span>{{ siteType }}</span>
              <span>·</span>
              <span>{{ (new Blob([html]).size / 1024).toFixed(1) }} KB</span>
              <template v-if="cloudProjectId">
                <span>·</span>
                <span class="text-emerald-500">云端第 {{ cloudVersion }} 版</span>
              </template>
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            :disabled="busy === 'zip'"
            class="flex items-center justify-center gap-1.5 rounded-xl border border-line/12 bg-ink/[0.04] px-3.5 py-2.5 text-xs font-medium text-sub transition-colors hover:bg-ink/[0.08] hover:text-ink disabled:opacity-50"
            @click="exportZip"
          >
            <Loader2 v-if="busy === 'zip'" class="h-3.5 w-3.5 animate-spin" />
            <Package v-else class="h-3.5 w-3.5" />
            导出 ZIP
          </button>
          <button
            :disabled="busy === 'share'"
            class="flex items-center justify-center gap-1.5 rounded-xl border border-line/12 bg-ink/[0.04] px-3.5 py-2.5 text-xs font-medium text-sub transition-colors hover:bg-ink/[0.08] hover:text-ink disabled:opacity-50"
            @click="share ? copyShare() : createShare()"
          >
            <Loader2 v-if="busy === 'share'" class="h-3.5 w-3.5 animate-spin" />
            <Check v-else-if="copied" class="h-3.5 w-3.5 text-emerald-500" />
            <Link2 v-else class="h-3.5 w-3.5" />
            {{ share ? (copied ? '已复制' : '复制链接') : '7 天分享' }}
          </button>
          <button
            class="flex items-center justify-center gap-1.5 rounded-xl border border-brand1/20 bg-brand1/[0.07] px-3.5 py-2.5 text-xs font-semibold text-brand1 transition-colors hover:bg-brand1/[0.13]"
            @click="editorOpen = true"
          >
            <PencilRuler class="h-3.5 w-3.5" />
            可视化编辑
          </button>
          <button
            :disabled="busy === 'cloud'"
            class="bg-brand-gradient flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white shadow-md shadow-brand1/20 disabled:opacity-50"
            @click="saveCloud()"
          >
            <Loader2 v-if="busy === 'cloud'" class="h-3.5 w-3.5 animate-spin" />
            <Cloud v-else-if="isAuthenticated" class="h-3.5 w-3.5" />
            <UserRound v-else class="h-3.5 w-3.5" />
            {{ isAuthenticated ? (cloudProjectId ? '保存新版本' : '保存到云端') : '登录并保存' }}
          </button>
        </div>
      </div>

      <div v-if="share" class="flex flex-col gap-2 border-t border-line/10 bg-brand1/[0.035] px-4 py-3 text-xs sm:flex-row sm:items-center sm:px-5">
        <Link2 class="h-3.5 w-3.5 shrink-0 text-brand1" />
        <input
          :value="share.url"
          readonly
          class="min-w-0 flex-1 truncate bg-transparent font-mono text-[11px] text-sub outline-none"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <span class="shrink-0 text-[10px] text-faint">到期:{{ expiresText }}</span>
        <a :href="share.url" target="_blank" rel="noopener noreferrer" class="flex shrink-0 items-center gap-1 text-brand1 hover:underline">
          <ExternalLink class="h-3 w-3" />打开
        </a>
      </div>
    </div>

    <VisualEditor :open="editorOpen" :html="html" :title="title" @close="editorOpen = false" @save="saveEdited" />
  </section>
</template>

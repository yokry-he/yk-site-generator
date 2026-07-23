<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  CheckCircle2,
  CloudOff,
  Download,
  ExternalLink,
  History,
  Loader2,
  PencilRuler,
  RefreshCw,
  Rocket,
  RotateCcw,
  UserRound,
} from 'lucide-vue-next'
import VisualEditor from '../components/VisualEditor.vue'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import { downloadSiteZip } from '../lib/exportArtifact'
import {
  addProjectVersion,
  createPublication,
  getProject,
  getProjectVersion,
  listPublications,
  republish,
  rollbackProject,
  updatePublication,
  type ProjectDetail,
  type ProjectVersion,
  type ProjectVersionSummary,
  type Publication,
} from '../lib/workspace'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, loading: authLoading } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const detail = ref<ProjectDetail | null>(null)
const selected = ref<ProjectVersion | null>(null)
const publication = ref<Publication | null>(null)
const loading = ref(false)
const previewLoading = ref(false)
const actionBusy = ref('')
const error = ref('')
const editorOpen = ref(false)
const previewWidth = ref<'desktop' | 'mobile'>('desktop')

const projectId = computed(() => String(route.params.id ?? ''))
const versions = computed(() => detail.value?.versions ?? [])
const selectedSummary = computed(() =>
  versions.value.find((version) => version.id === selected.value?.id) ?? null,
)

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '操作失败'
}

async function selectVersion(version: ProjectVersionSummary) {
  if (previewLoading.value || selected.value?.id === version.id) return
  previewLoading.value = true
  try {
    selected.value = await getProjectVersion(projectId.value, version.id)
  } catch (err) {
    toast.error('版本加载失败', messageOf(err))
  } finally {
    previewLoading.value = false
  }
}

async function load(preferredVersionId?: string) {
  if (!isAuthenticated.value || !projectId.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const [projectDetail, publications] = await Promise.all([
      getProject(projectId.value),
      listPublications(),
    ])
    detail.value = projectDetail
    publication.value = publications.find((item) => item.projectId === projectId.value) ?? null
    const target =
      projectDetail.versions.find((version) => version.id === preferredVersionId) ??
      projectDetail.versions[0]
    if (target) selected.value = await getProjectVersion(projectId.value, target.id)
    else selected.value = null
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

async function rollback(version: ProjectVersionSummary) {
  actionBusy.value = `rollback:${version.id}`
  try {
    const created = await rollbackProject(projectId.value, version.id)
    toast.success('已创建回滚版本', `第 ${created.version} 版基于第 ${version.version} 版生成。`)
    await load(created.id)
  } catch (err) {
    toast.error('回滚失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function saveEdited(html: string) {
  actionBusy.value = 'editor'
  try {
    const created = await addProjectVersion(projectId.value, {
      html,
      source: 'editor',
      instruction: '可视化编辑器修改',
    })
    editorOpen.value = false
    toast.success('编辑已保存', `已创建第 ${created.version} 版,原版本保持不变。`)
    await load(created.id)
  } catch (err) {
    toast.error('保存失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function publish() {
  const version = selectedSummary.value
  if (!detail.value || !version) return
  actionBusy.value = 'publish'
  try {
    if (publication.value) {
      publication.value = await republish(publication.value.id, { versionId: version.id })
      toast.success('重新发布完成', `线上站点已更新为第 ${version.version} 版。`)
    } else {
      publication.value = await createPublication({
        title: detail.value.project.title,
        projectId: detail.value.project.id,
        versionId: version.id,
      })
      toast.success('站点已发布', '已生成独立访问地址。')
    }
  } catch (err) {
    toast.error('发布失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function togglePublication() {
  if (!publication.value) return
  actionBusy.value = 'status'
  try {
    const next = publication.value.status === 'published' ? 'offline' : 'published'
    publication.value = await updatePublication(publication.value.id, { status: next })
    toast.success(next === 'published' ? '站点已恢复上线' : '站点已下线')
  } catch (err) {
    toast.error('状态更新失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function exportZip() {
  if (!selected.value || !detail.value) return
  actionBusy.value = 'export'
  try {
    const fileName = await downloadSiteZip({
      html: selected.value.html,
      title: detail.value.project.title,
      siteType: detail.value.project.siteType,
      requirement: detail.value.project.requirement,
      model: selected.value.model,
      generatedAt: selected.value.createdAt,
    })
    toast.success('ZIP 已导出', fileName)
  } catch (err) {
    toast.error('导出失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

watch(isAuthenticated, (value) => value && void load())
watch(projectId, () => void load())
onMounted(load)
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-20 pb-16">
    <div v-if="authLoading && !isAuthenticated" class="flex min-h-[60vh] items-center justify-center">
      <Loader2 class="h-7 w-7 animate-spin text-brand1" />
    </div>

    <section v-else-if="!isAuthenticated" class="mx-auto mt-16 max-w-lg px-4 text-center">
      <div class="rounded-3xl border border-line/10 bg-soft/70 p-10">
        <UserRound class="mx-auto h-10 w-10 text-brand1" />
        <h1 class="mt-4 text-xl font-semibold text-ink">登录后打开云端项目</h1>
        <p class="mt-2 text-sm text-mut">项目版本和发布状态仅对项目所有者可见。</p>
        <button class="bg-brand-gradient mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="showAuth">
          登录 SiteForge
        </button>
      </div>
    </section>

    <div v-else class="mx-auto max-w-[1500px] px-3 sm:px-5 lg:px-7">
      <div class="flex flex-wrap items-center gap-3 border-b border-line/10 py-4">
        <button
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-mut transition-colors hover:bg-ink/5 hover:text-ink"
          @click="router.push('/projects')"
        >
          <ArrowLeft class="h-4 w-4" />
          项目列表
        </button>
        <div v-if="detail" class="min-w-0 flex-1">
          <h1 class="truncate text-base font-semibold text-ink">{{ detail.project.title }}</h1>
          <p class="truncate text-xs text-faint">{{ detail.project.requirement || '暂无需求描述' }}</p>
        </div>
        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button
            :disabled="loading"
            class="rounded-lg p-2 text-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
            title="刷新项目"
            @click="load(selected?.id)"
          >
            <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
          </button>
          <button
            v-if="selected"
            :disabled="actionBusy === 'export'"
            class="flex items-center gap-1.5 rounded-xl border border-line/12 bg-ink/[0.04] px-3.5 py-2.5 text-xs font-medium text-sub hover:bg-ink/[0.08]"
            @click="exportZip"
          >
            <Loader2 v-if="actionBusy === 'export'" class="h-3.5 w-3.5 animate-spin" />
            <Download v-else class="h-3.5 w-3.5" />
            导出 ZIP
          </button>
          <button
            v-if="selected"
            class="flex items-center gap-1.5 rounded-xl border border-brand1/20 bg-brand1/[0.08] px-3.5 py-2.5 text-xs font-semibold text-brand1 hover:bg-brand1/[0.14]"
            @click="editorOpen = true"
          >
            <PencilRuler class="h-3.5 w-3.5" />
            可视化编辑
          </button>
          <button
            v-if="selected"
            :disabled="actionBusy === 'publish'"
            class="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand1/20 disabled:opacity-50"
            @click="publish"
          >
            <Loader2 v-if="actionBusy === 'publish'" class="h-3.5 w-3.5 animate-spin" />
            <Rocket v-else class="h-3.5 w-3.5" />
            {{ publication ? '发布当前版本' : '一键发布' }}
          </button>
        </div>
      </div>

      <div v-if="error" class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">
        {{ error }}
      </div>

      <div v-if="loading && !detail" class="flex min-h-[65vh] items-center justify-center">
        <Loader2 class="h-7 w-7 animate-spin text-brand1" />
      </div>

      <div v-else-if="detail" class="mt-5 grid min-h-[680px] gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside class="overflow-hidden rounded-2xl border border-line/10 bg-soft/65">
          <div class="flex items-center justify-between border-b border-line/10 px-4 py-3">
            <p class="flex items-center gap-2 text-sm font-semibold text-ink">
              <History class="h-4 w-4 text-brand1" />
              版本历史
            </p>
            <span class="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] text-faint">{{ versions.length }}</span>
          </div>
          <div v-if="versions.length" class="max-h-[610px] space-y-1 overflow-y-auto p-2">
            <button
              v-for="version in versions"
              :key="version.id"
              class="group w-full rounded-xl border p-3 text-left transition-colors"
              :class="selected?.id === version.id ? 'border-brand1/25 bg-brand1/[0.09]' : 'border-transparent hover:border-line/10 hover:bg-ink/[0.035]'"
              @click="selectVersion(version)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold" :class="selected?.id === version.id ? 'text-brand1' : 'text-ink'">
                  第 {{ version.version }} 版
                </span>
                <span class="rounded-md bg-ink/[0.05] px-1.5 py-0.5 text-[9px] text-faint">{{ version.source }}</span>
              </div>
              <p class="mt-1.5 line-clamp-2 text-[11px] leading-5 text-mut">{{ version.instruction || '初始版本' }}</p>
              <div class="mt-2 flex items-center justify-between text-[10px] text-faint">
                <span>{{ formatDate(version.createdAt) }}</span>
                <span>{{ (version.sizeBytes / 1024).toFixed(1) }} KB</span>
              </div>
              <button
                v-if="selected?.id !== version.id"
                :disabled="actionBusy === `rollback:${version.id}`"
                class="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-faint opacity-0 transition-all hover:bg-brand1/10 hover:text-brand1 group-hover:opacity-100"
                @click.stop="rollback(version)"
              >
                <Loader2 v-if="actionBusy === `rollback:${version.id}`" class="h-3 w-3 animate-spin" />
                <RotateCcw v-else class="h-3 w-3" />
                以此版本创建新版本
              </button>
            </button>
          </div>
          <div v-else class="p-8 text-center text-xs text-faint">该项目还没有可预览的版本</div>

          <div v-if="publication" class="border-t border-line/10 p-4">
            <div class="flex items-center justify-between gap-2">
              <p class="flex items-center gap-1.5 text-xs font-medium text-ink">
                <span class="h-2 w-2 rounded-full" :class="publication.status === 'published' ? 'bg-emerald-500' : 'bg-zinc-400'" />
                {{ publication.status === 'published' ? '线上运行中' : '当前已下线' }}
              </p>
              <button
                :disabled="actionBusy === 'status'"
                class="text-[10px] text-faint hover:text-brand1"
                @click="togglePublication"
              >
                {{ publication.status === 'published' ? '下线' : '恢复上线' }}
              </button>
            </div>
            <a
              v-if="publication.status === 'published'"
              :href="publication.url"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 flex items-center gap-1.5 truncate text-[11px] text-brand1 hover:underline"
            >
              <ExternalLink class="h-3 w-3 shrink-0" />
              {{ publication.url }}
            </a>
            <p v-else class="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
              <CloudOff class="h-3 w-3" />访问地址暂不可用
            </p>
          </div>
        </aside>

        <section class="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-line/10 bg-soft/60">
          <div class="flex items-center gap-3 border-b border-line/10 bg-app/60 px-4 py-3">
            <div class="flex gap-1.5"><span v-for="item in 3" :key="item" class="h-2.5 w-2.5 rounded-full bg-line/25" /></div>
            <div class="min-w-0 flex-1 truncate rounded-md bg-ink/[0.04] px-3 py-1.5 text-[11px] text-faint">
              {{ selected ? `${detail.project.title} / v${selected.version}` : '暂无版本' }}
            </div>
            <div class="flex rounded-lg bg-ink/[0.04] p-1">
              <button class="rounded-md px-2 py-1 text-[10px]" :class="previewWidth === 'desktop' ? 'bg-soft text-ink shadow' : 'text-faint'" @click="previewWidth = 'desktop'">桌面</button>
              <button class="rounded-md px-2 py-1 text-[10px]" :class="previewWidth === 'mobile' ? 'bg-soft text-ink shadow' : 'text-faint'" @click="previewWidth = 'mobile'">手机</button>
            </div>
          </div>
          <div class="relative min-h-0 flex-1 bg-ink/[0.035] p-3 sm:p-5">
            <div v-if="previewLoading" class="absolute inset-0 z-10 flex items-center justify-center bg-app/45 backdrop-blur-sm">
              <Loader2 class="h-6 w-6 animate-spin text-brand1" />
            </div>
            <div
              v-if="selected"
              class="mx-auto h-full min-h-[610px] overflow-hidden rounded-xl border border-line/12 bg-white shadow-2xl shadow-black/15 transition-all"
              :class="previewWidth === 'mobile' ? 'max-w-[390px]' : 'max-w-none'"
            >
              <iframe :srcdoc="selected.html" sandbox="allow-scripts" referrerpolicy="no-referrer" class="h-full min-h-[610px] w-full" title="项目版本预览" />
            </div>
            <div v-else class="flex h-full min-h-[610px] flex-col items-center justify-center text-center">
              <CheckCircle2 class="h-8 w-8 text-faint" />
              <p class="mt-3 text-sm text-mut">尚无项目版本</p>
              <RouterLink to="/generator" class="mt-3 text-xs text-brand1 hover:underline">前往生成器创建内容</RouterLink>
            </div>
          </div>
        </section>
      </div>
    </div>

    <VisualEditor
      v-if="selected"
      :open="editorOpen"
      :html="selected.html"
      :title="`${detail?.project.title ?? '项目'} · 第 ${selected.version} 版`"
      @close="editorOpen = false"
      @save="saveEdited"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Clock3,
  Cloud,
  FolderKanban,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { typeById } from '../data/siteTypes'
import { ApiError } from '../lib/api'
import { deleteProject, listProjects, updateProject, type CloudProject } from '../lib/workspace'

const router = useRouter()
const { user, isAuthenticated, loading: authLoading } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const projects = ref<CloudProject[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const editingId = ref<string | null>(null)
const editingTitle = ref('')
const deletingId = ref<string | null>(null)
const actionBusyId = ref<string | null>(null)

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return projects.value
  return projects.value.filter((project) =>
    [project.title, project.requirement, typeName(project.siteType)].some((value) =>
      value.toLowerCase().includes(keyword),
    ),
  )
})

function typeName(id: string): string {
  return typeById(id)?.name ?? typeById(id === 'corporate' ? 'business' : id)?.name ?? id
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '请求失败'
}

async function load() {
  if (!isAuthenticated.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    projects.value = await listProjects()
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

function startRename(project: CloudProject) {
  editingId.value = project.id
  editingTitle.value = project.title
  deletingId.value = null
}

async function saveRename(project: CloudProject) {
  const title = editingTitle.value.trim()
  if (!title || title === project.title) {
    editingId.value = null
    return
  }
  actionBusyId.value = project.id
  try {
    const updated = await updateProject(project.id, { title })
    projects.value = projects.value.map((item) => (item.id === project.id ? { ...item, ...updated } : item))
    editingId.value = null
    toast.success('项目已重命名', title)
  } catch (err) {
    toast.error('重命名失败', messageOf(err))
  } finally {
    actionBusyId.value = null
  }
}

async function remove(project: CloudProject) {
  if (deletingId.value !== project.id) {
    deletingId.value = project.id
    editingId.value = null
    return
  }
  actionBusyId.value = project.id
  try {
    await deleteProject(project.id)
    projects.value = projects.value.filter((item) => item.id !== project.id)
    deletingId.value = null
    toast.success('项目已删除', `「${project.title}」及其全部版本已移除。`)
  } catch (err) {
    toast.error('删除失败', messageOf(err))
  } finally {
    actionBusyId.value = null
  }
}

watch(isAuthenticated, (value) => {
  if (value) void load()
  else projects.value = []
})
onMounted(load)
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-24 pb-20">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-5 border-b border-line/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm font-semibold text-brand1">
            <Cloud class="h-4 w-4" />
            云端工作区
          </p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">我的项目</h1>
          <p class="mt-3 max-w-2xl text-sm leading-7 text-mut">
            每次生成、对话修改和可视化编辑都会形成独立版本,随时预览、回滚或发布。
          </p>
        </div>
        <RouterLink
          v-if="isAuthenticated"
          to="/generator"
          class="bg-brand-gradient flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/25 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <Plus class="h-4 w-4" />
          新建项目
        </RouterLink>
      </div>

      <section v-if="authLoading && !isAuthenticated" class="flex min-h-80 items-center justify-center">
        <Loader2 class="h-6 w-6 animate-spin text-brand1" />
      </section>

      <section
        v-else-if="!isAuthenticated"
        class="mx-auto mt-14 max-w-xl rounded-3xl border border-line/10 bg-soft/70 px-6 py-12 text-center shadow-xl shadow-black/5"
      >
        <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand1/10">
          <UserRound class="h-7 w-7 text-brand1" />
        </span>
        <h2 class="mt-5 text-xl font-semibold text-ink">登录后查看云端项目</h2>
        <p class="mt-2 text-sm leading-7 text-mut">本地历史不会消失。登录后可以选择将已有生成记录迁移到账号。</p>
        <button
          class="bg-brand-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/25"
          @click="showAuth"
        >
          登录或创建账号
          <ArrowRight class="h-4 w-4" />
        </button>
      </section>

      <template v-else>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="relative w-full sm:max-w-sm">
            <Search class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              v-model="query"
              type="search"
              placeholder="搜索项目、需求或站点类型"
              class="w-full rounded-xl border border-line/12 bg-soft/60 py-2.5 pr-4 pl-10 text-sm text-ink outline-none placeholder:text-faint focus:border-brand1/45"
            />
          </div>
          <div class="flex items-center gap-3 text-xs text-faint">
            <span>{{ filtered.length }} / {{ projects.length }} 个项目</span>
            <button
              :disabled="loading"
              class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              @click="load"
            >
              <RefreshCw class="h-3.5 w-3.5" :class="loading && 'animate-spin'" />
              刷新
            </button>
          </div>
        </div>

        <div v-if="error" class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">
          <p class="font-medium">加载项目失败</p>
          <p class="mt-1 text-xs opacity-80">{{ error }}</p>
        </div>

        <div v-if="loading && projects.length === 0" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="item in 6" :key="item" class="h-60 animate-pulse rounded-2xl border border-line/8 bg-ink/[0.04]" />
        </div>

        <section
          v-else-if="projects.length === 0"
          class="mt-10 rounded-3xl border border-dashed border-line/15 bg-ink/[0.025] px-6 py-16 text-center"
        >
          <FolderKanban class="mx-auto h-10 w-10 text-faint" />
          <h2 class="mt-4 text-lg font-semibold text-ink">你的云端工作区还是空的</h2>
          <p class="mt-2 text-sm text-mut">生成第一个网站后,选择“保存到云端”即可在这里管理版本。</p>
          <RouterLink
            to="/generator"
            class="bg-brand-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
          >
            开始生成
            <ArrowRight class="h-4 w-4" />
          </RouterLink>
        </section>

        <section v-else-if="filtered.length === 0" class="mt-12 py-16 text-center">
          <Search class="mx-auto h-9 w-9 text-faint" />
          <p class="mt-3 text-sm text-mut">没有找到与“{{ query }}”匹配的项目</p>
        </section>

        <div v-else class="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="project in filtered"
            :key="project.id"
            class="group overflow-hidden rounded-2xl border border-line/10 bg-soft/65 shadow-lg shadow-black/[0.03] transition-all hover:-translate-y-0.5 hover:border-brand1/25 hover:shadow-xl hover:shadow-brand1/[0.06]"
          >
            <button
              class="relative flex h-32 w-full items-center justify-center overflow-hidden border-b border-line/8 bg-gradient-to-br from-brand1/[0.12] via-brand2/[0.06] to-transparent text-left"
              @click="router.push(`/projects/${project.id}`)"
            >
              <div class="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:20px_20px] text-line/20" />
              <span class="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-line/10 bg-app/75 shadow-xl backdrop-blur">
                <FolderKanban class="h-6 w-6 text-brand1" />
              </span>
              <span class="absolute top-3 right-3 rounded-full border border-line/10 bg-app/70 px-2.5 py-1 text-[10px] font-medium text-mut backdrop-blur">
                {{ typeName(project.siteType) }}
              </span>
            </button>

            <div class="p-5">
              <div v-if="editingId === project.id" class="flex items-center gap-2">
                <input
                  v-model="editingTitle"
                  class="min-w-0 flex-1 rounded-lg border border-brand1/35 bg-app/70 px-2.5 py-1.5 text-sm font-semibold text-ink outline-none"
                  maxlength="120"
                  autofocus
                  @keyup.enter="saveRename(project)"
                  @keyup.escape="editingId = null"
                />
                <button
                  :disabled="actionBusyId === project.id"
                  class="rounded-lg bg-brand1/12 px-2.5 py-1.5 text-xs font-medium text-brand1"
                  @click="saveRename(project)"
                >
                  保存
                </button>
              </div>
              <div v-else class="flex items-start justify-between gap-3">
                <button class="min-w-0 text-left" @click="router.push(`/projects/${project.id}`)">
                  <h2 class="truncate text-base font-semibold text-ink group-hover:text-brand1">{{ project.title }}</h2>
                  <p class="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-mut">{{ project.requirement || '暂无需求描述' }}</p>
                </button>
                <button
                  class="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                  title="重命名"
                  @click="startRename(project)"
                >
                  <Pencil class="h-3.5 w-3.5" />
                </button>
              </div>

              <div class="mt-4 flex items-center justify-between border-t border-line/8 pt-4 text-[11px] text-faint">
                <span class="flex items-center gap-1.5">
                  <Clock3 class="h-3.5 w-3.5" />
                  {{ formatDate(project.updatedAt) }}
                </span>
                <span v-if="project.latestVersion">第 {{ project.latestVersion.version }} 版</span>
                <span v-else>尚无版本</span>
              </div>

              <div class="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <button
                  class="flex items-center justify-center gap-1.5 rounded-lg border border-line/10 bg-ink/[0.04] px-3 py-2 text-xs font-medium text-sub transition-colors hover:bg-ink/[0.08] hover:text-ink"
                  @click="router.push(`/projects/${project.id}`)"
                >
                  打开项目
                  <ArrowRight class="h-3.5 w-3.5" />
                </button>
                <button
                  :disabled="actionBusyId === project.id"
                  class="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-50"
                  :class="deletingId === project.id ? 'border-red-500/30 bg-red-500/10 font-medium text-red-500' : 'border-line/10 text-faint hover:bg-red-500/[0.06] hover:text-red-500'"
                  :title="deletingId === project.id ? '再次点击确认删除' : '删除项目'"
                  @click="remove(project)"
                >
                  <Loader2 v-if="actionBusyId === project.id" class="h-3.5 w-3.5 animate-spin" />
                  <Trash2 v-else class="h-3.5 w-3.5" />
                  {{ deletingId === project.id ? '确认' : '' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>
  </main>
</template>

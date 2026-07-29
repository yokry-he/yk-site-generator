<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Archive,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Copy,
  FolderKanban,
  Grid2X2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { confirmDialog } from '../composables/useConfirmDialog'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { typeById } from '../data/siteTypes'
import { ApiError } from '../lib/api'
import {
  deleteProject,
  duplicateProject,
  listProjects,
  updateProject,
  type CloudProject,
  type ProjectLifecycleStatus,
} from '../lib/workspace'

const router = useRouter()
const { isAuthenticated, loading: authLoading } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const projects = ref<CloudProject[]>([])
const loading = ref(false)
const error = ref('')
const query = ref('')
const status = ref<ProjectLifecycleStatus>('active')
const siteType = ref('all')
const origin = ref<'all' | 'template' | 'ai'>('all')
const sort = ref<'updated' | 'opened' | 'created' | 'name'>('updated')
const view = ref<'grid' | 'list'>((localStorage.getItem('siteforge:project-view') as 'grid' | 'list') || 'grid')
const editingId = ref('')
const editingTitle = ref('')
const actionBusyId = ref('')
const openMenu = ref('')

const counts = computed(() => ({
  active: projects.value.filter((project) => project.status === 'active').length,
  archived: projects.value.filter((project) => project.status === 'archived').length,
  trashed: projects.value.filter((project) => project.status === 'trashed').length,
  starred: projects.value.filter((project) => project.starred).length,
}))
const siteTypes = computed(() => [...new Set(projects.value.map((project) => project.siteType))])
const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return projects.value
    .filter((project) => project.status === status.value)
    .filter((project) => siteType.value === 'all' || project.siteType === siteType.value)
    .filter((project) => origin.value === 'all' || (origin.value === 'template' ? Boolean(project.templateId) : !project.templateId))
    .filter((project) => !keyword || [project.title, project.requirement, typeName(project.siteType)].some((value) => value.toLowerCase().includes(keyword)))
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1
      if (sort.value === 'name') return a.title.localeCompare(b.title, 'zh-CN')
      if (sort.value === 'created') return Date.parse(b.createdAt) - Date.parse(a.createdAt)
      if (sort.value === 'opened') return Date.parse(b.openedAt || b.updatedAt) - Date.parse(a.openedAt || a.updatedAt)
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    })
})

function typeName(id: string): string {
  return typeById(id)?.name ?? typeById(id === 'corporate' ? 'business' : id)?.name ?? id
}

function formatDate(value?: string): string {
  if (!value) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '请求失败'
}

async function load() {
  if (!isAuthenticated.value || loading.value) return
  loading.value = true
  error.value = ''
  try { projects.value = await listProjects('all') } catch (err) { error.value = messageOf(err) } finally { loading.value = false }
}

function startRename(project: CloudProject) {
  editingId.value = project.id
  editingTitle.value = project.title
  openMenu.value = ''
}

async function saveRename(project: CloudProject) {
  const title = editingTitle.value.trim()
  if (!title || title === project.title) { editingId.value = ''; return }
  actionBusyId.value = project.id
  try {
    const updated = await updateProject(project.id, { title })
    projects.value = projects.value.map((item) => item.id === project.id ? { ...item, ...updated } : item)
    editingId.value = ''
    toast.success('项目已重命名', title)
  } catch (err) { toast.error('重命名失败', messageOf(err)) } finally { actionBusyId.value = '' }
}

async function patch(project: CloudProject, input: Partial<Pick<CloudProject, 'status' | 'starred'>>) {
  actionBusyId.value = project.id
  openMenu.value = ''
  try {
    const updated = await updateProject(project.id, input)
    projects.value = projects.value.map((item) => item.id === project.id ? { ...item, ...updated } : item)
    if (input.status === 'archived') toast.success('项目已归档', '可从“已归档”恢复。')
    if (input.status === 'trashed') toast.success('项目已移入回收站', '永久删除前仍可恢复。')
    if (input.status === 'active' && project.status !== 'active') toast.success('项目已恢复')
  } catch (err) { toast.error('操作失败', messageOf(err)) } finally { actionBusyId.value = '' }
}

async function clone(project: CloudProject) {
  actionBusyId.value = project.id
  openMenu.value = ''
  try {
    const created = await duplicateProject(project.id)
    projects.value = [created, ...projects.value]
    toast.success('项目副本已创建', created.title)
  } catch (err) { toast.error('复制失败', messageOf(err)) } finally { actionBusyId.value = '' }
}

async function permanentlyDelete(project: CloudProject) {
  openMenu.value = ''
  const confirmed = await confirmDialog({
    title: `永久删除「${project.title}」？`,
    description: '项目、全部不可变版本、质量反馈和发布关联都会被移除，且无法恢复。',
    confirmLabel: '永久删除',
    tone: 'danger',
    verificationText: project.title,
    verificationLabel: `请输入项目名称「${project.title}」确认`,
  })
  if (!confirmed) return
  actionBusyId.value = project.id
  try {
    await deleteProject(project.id)
    projects.value = projects.value.filter((item) => item.id !== project.id)
    toast.success('项目已永久删除')
  } catch (err) { toast.error('删除失败', messageOf(err)) } finally { actionBusyId.value = '' }
}

function setView(next: 'grid' | 'list') {
  view.value = next
  localStorage.setItem('siteforge:project-view', next)
}

function handleProjectsUpdated() { void load() }
watch(isAuthenticated, (value) => value ? void load() : (projects.value = []))
onMounted(() => { void load(); window.addEventListener('siteforge:projects-updated', handleProjectsUpdated) })
onBeforeUnmount(() => window.removeEventListener('siteforge:projects-updated', handleProjectsUpdated))
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-24 pb-20">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-5 border-b border-line/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div><p class="flex items-center gap-2 text-sm font-semibold text-brand1"><Cloud class="h-4 w-4" />云端工作区</p><h1 class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">我的项目</h1><p class="mt-3 max-w-2xl text-sm leading-7 text-mut">管理静态站点与工程项目。现在可通过手动向导确定性生成包含 Vue 前端和多种后端框架的完整源码。</p></div>
        <div v-if="isAuthenticated" class="flex flex-wrap gap-2"><RouterLink to="/generator" class="flex items-center justify-center gap-2 rounded-xl border border-line/12 bg-soft/60 px-4 py-3 text-sm font-semibold text-sub hover:border-brand1/25 hover:text-brand1">AI 静态站</RouterLink><RouterLink to="/projects/new" class="bg-brand-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/25"><Plus class="h-4 w-4" />手动创建工程</RouterLink></div>
      </header>

      <section v-if="authLoading && !isAuthenticated" class="flex min-h-80 items-center justify-center"><Loader2 class="h-6 w-6 animate-spin text-brand1" /></section>
      <section v-else-if="!isAuthenticated" class="mx-auto mt-14 max-w-xl rounded-3xl border border-line/10 bg-soft/70 px-6 py-12 text-center shadow-xl shadow-black/5"><span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand1/10"><UserRound class="h-7 w-7 text-brand1" /></span><h2 class="mt-5 text-xl font-semibold text-ink">登录后查看云端项目</h2><p class="mt-2 text-sm leading-7 text-mut">手动工程向导可以直接使用；登录后还可以管理已有云端项目与版本。</p><div class="mt-6 flex flex-wrap justify-center gap-2"><RouterLink to="/projects/new" class="rounded-xl border border-brand1/20 bg-brand1/[0.07] px-5 py-3 text-sm font-semibold text-brand1">先创建工程</RouterLink><button class="bg-brand-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="showAuth">登录或创建账号<ArrowRight class="h-4 w-4" /></button></div></section>

      <template v-else>
        <div class="mt-7 grid gap-3 sm:grid-cols-4">
          <button v-for="tab in [{id:'active',label:'进行中',count:counts.active},{id:'archived',label:'已归档',count:counts.archived},{id:'trashed',label:'回收站',count:counts.trashed}]" :key="tab.id" class="rounded-2xl border p-4 text-left" :class="status === tab.id ? 'border-brand1/30 bg-brand1/[0.065]' : 'border-line/10 bg-soft/55 hover:border-brand1/18'" @click="status = tab.id as ProjectLifecycleStatus"><span class="text-xs text-mut">{{ tab.label }}</span><strong class="mt-2 block text-2xl text-ink">{{ tab.count }}</strong></button>
          <div class="rounded-2xl border border-line/10 bg-soft/55 p-4"><span class="flex items-center gap-1.5 text-xs text-mut"><Star class="h-3.5 w-3.5 text-amber-500" />已收藏</span><strong class="mt-2 block text-2xl text-ink">{{ counts.starred }}</strong></div>
        </div>

        <div class="mt-6 flex flex-col gap-3 rounded-2xl border border-line/10 bg-soft/45 p-3 lg:flex-row lg:items-center">
          <label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-app/65 px-3.5 py-2.5 focus-within:border-brand1/35"><Search class="h-4 w-4 text-faint" /><input v-model="query" type="search" placeholder="搜索项目、需求或站点类型" class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" /></label>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <label class="relative"><select v-model="siteType" class="w-full appearance-none rounded-xl border border-line/10 bg-app/65 py-2.5 pr-8 pl-3 text-xs text-sub outline-none"><option value="all">全部类型</option><option v-for="item in siteTypes" :key="item" :value="item">{{ typeName(item) }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
            <label class="relative"><select v-model="origin" class="w-full appearance-none rounded-xl border border-line/10 bg-app/65 py-2.5 pr-8 pl-3 text-xs text-sub outline-none"><option value="all">全部来源</option><option value="template">官方模板</option><option value="ai">AI 生成</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
            <label class="relative"><select v-model="sort" class="w-full appearance-none rounded-xl border border-line/10 bg-app/65 py-2.5 pr-8 pl-3 text-xs text-sub outline-none"><option value="updated">最近更新</option><option value="opened">最近打开</option><option value="created">创建时间</option><option value="name">项目名称</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
            <div class="flex rounded-xl border border-line/10 bg-app/65 p-1"><button class="flex-1 rounded-lg p-1.5" :class="view === 'grid' ? 'bg-soft text-brand1 shadow' : 'text-faint'" @click="setView('grid')"><Grid2X2 class="mx-auto h-4 w-4" /></button><button class="flex-1 rounded-lg p-1.5" :class="view === 'list' ? 'bg-soft text-brand1 shadow' : 'text-faint'" @click="setView('list')"><List class="mx-auto h-4 w-4" /></button></div>
          </div>
          <button :disabled="loading" class="flex items-center justify-center gap-1.5 rounded-xl border border-line/10 px-3 py-2.5 text-xs text-faint hover:text-ink disabled:opacity-45" @click="load"><RefreshCw class="h-3.5 w-3.5" :class="loading && 'animate-spin'" />刷新</button>
        </div>

        <div v-if="error" class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">{{ error }}</div>
        <div v-if="loading && !projects.length" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><div v-for="item in 6" :key="item" class="h-64 animate-pulse rounded-2xl border border-line/8 bg-ink/[0.04]" /></div>

        <section v-else-if="!visible.length" class="mt-10 rounded-3xl border border-dashed border-line/15 bg-ink/[0.025] px-6 py-16 text-center"><FolderKanban class="mx-auto h-10 w-10 text-faint" /><h2 class="mt-4 text-lg font-semibold text-ink">{{ status === 'active' ? '没有匹配的进行中项目' : status === 'archived' ? '归档区还是空的' : '回收站是空的' }}</h2><p class="mt-2 text-sm text-mut">{{ query ? '调整搜索或筛选条件。' : status === 'active' ? '通过手动向导生成一个完整前后端工程，或从模板中心选择静态站点。' : '项目会在这里等待恢复或永久删除。' }}</p><RouterLink v-if="status === 'active' && !query" to="/projects/new" class="bg-brand-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white">创建全栈工程<ArrowRight class="h-4 w-4" /></RouterLink></section>

        <div v-else :class="view === 'grid' ? 'mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'mt-7 grid gap-3'">
          <article v-for="project in visible" :key="project.id" class="group relative overflow-visible rounded-2xl border border-line/10 bg-soft/65 shadow-lg shadow-black/[0.03] transition hover:border-brand1/25" :class="view === 'list' && 'flex items-center gap-4 p-3'">
            <button class="relative overflow-hidden bg-gradient-to-br from-brand1/[0.13] via-brand2/[0.06] to-transparent" :class="view === 'grid' ? 'flex h-36 w-full items-center justify-center rounded-t-2xl border-b border-line/8' : 'h-20 w-28 shrink-0 rounded-xl'" @click="router.push(`/projects/${project.id}`)"><img v-if="project.coverDataUrl" :src="project.coverDataUrl" class="h-full w-full object-cover" /><template v-else><div class="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:20px_20px] text-line/20" /><span class="relative grid h-12 w-12 place-items-center rounded-2xl border border-line/10 bg-app/75 shadow-xl"><FolderKanban class="h-5 w-5 text-brand1" /></span></template><span class="absolute top-2 right-2 rounded-full border border-line/10 bg-app/75 px-2 py-1 text-[9px] text-mut">{{ typeName(project.siteType) }}</span></button>

            <div class="min-w-0 flex-1" :class="view === 'grid' ? 'p-5' : 'py-1 pr-2'">
              <div class="flex items-start gap-2">
                <div v-if="editingId === project.id" class="flex min-w-0 flex-1 items-center gap-2"><input v-model="editingTitle" maxlength="120" autofocus class="min-w-0 flex-1 rounded-lg border border-brand1/35 bg-app/70 px-2.5 py-1.5 text-sm font-semibold outline-none" @keyup.enter="saveRename(project)" @keyup.escape="editingId = ''" /><button class="rounded-lg bg-brand1/12 p-2 text-brand1" @click="saveRename(project)"><Check class="h-3.5 w-3.5" /></button></div>
                <button v-else class="min-w-0 flex-1 text-left" @click="router.push(`/projects/${project.id}`)"><h2 class="truncate text-base font-semibold text-ink group-hover:text-brand1">{{ project.title }}</h2><p class="mt-1 line-clamp-2 text-xs leading-5 text-mut">{{ project.requirement || '暂无需求描述' }}</p></button>
                <button class="rounded-lg p-1.5" :class="project.starred ? 'text-amber-500' : 'text-faint hover:text-amber-500'" :title="project.starred ? '取消收藏' : '收藏项目'" @click="patch(project,{starred:!project.starred})"><Star class="h-4 w-4" :fill="project.starred ? 'currentColor' : 'none'" /></button>
                <div class="relative"><button class="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-ink" @click="openMenu = openMenu === project.id ? '' : project.id"><MoreHorizontal class="h-4 w-4" /></button><div v-if="openMenu === project.id" class="absolute top-8 right-0 z-20 w-44 rounded-xl border border-line/10 bg-soft/98 p-1.5 shadow-2xl"><button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-sub hover:bg-ink/5" @click="startRename(project)"><Pencil class="h-3.5 w-3.5" />重命名</button><button class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-sub hover:bg-ink/5" @click="clone(project)"><Copy class="h-3.5 w-3.5" />创建副本</button><button v-if="project.status === 'active'" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-sub hover:bg-ink/5" @click="patch(project,{status:'archived'})"><Archive class="h-3.5 w-3.5" />归档</button><button v-if="project.status !== 'active'" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-sub hover:bg-ink/5" @click="patch(project,{status:'active'})"><RotateCcw class="h-3.5 w-3.5" />恢复到进行中</button><button v-if="project.status !== 'trashed'" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/[0.06]" @click="patch(project,{status:'trashed'})"><Trash2 class="h-3.5 w-3.5" />移入回收站</button><button v-else class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/[0.06]" @click="permanentlyDelete(project)"><X class="h-3.5 w-3.5" />永久删除</button></div></div>
              </div>

              <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/8 pt-3 text-[10px] text-faint"><span class="flex items-center gap-1"><Clock3 class="h-3 w-3" />更新 {{ formatDate(project.updatedAt) }}</span><span>{{ project.latestVersion ? `第 ${project.latestVersion.version} 版` : '尚无版本' }}</span><span v-if="project.templateId" class="rounded bg-violet-500/10 px-1.5 py-0.5 text-violet-500">官方模板</span><Loader2 v-if="actionBusyId === project.id" class="ml-auto h-3.5 w-3.5 animate-spin text-brand1" /></div>
              <button v-if="view === 'grid'" class="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line/10 bg-ink/[0.035] px-3 py-2.5 text-xs font-medium text-sub hover:bg-ink/[0.07] hover:text-ink" @click="router.push(`/projects/${project.id}`)">打开工作区<ArrowRight class="h-3.5 w-3.5" /></button>
            </div>
          </article>
        </div>
      </template>
    </div>
  </main>
</template>

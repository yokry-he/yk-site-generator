<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Archive,
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  Eye,
  LayoutTemplate,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import {
  listAdminTemplates,
  updateAdminTemplate,
  type AdminTemplate,
  type TemplateOperationsSummary,
} from '../lib/admin'

const router = useRouter()
const { isAuthenticated, isOperator, hasPermission, loading: authLoading, user } = useAuth()
const toast = useToast()
const templates = ref<AdminTemplate[]>([])
const summary = ref<TemplateOperationsSummary>({ total: 0, published: 0, draft: 0, archived: 0, featured: 0 })
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const query = ref('')
const status = ref('all')
const selected = ref<AdminTemplate | null>(null)
const draftStatus = ref<AdminTemplate['status']>('published')
const draftFeatured = ref(false)
const draftSortOrder = ref(100)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const canPublish = computed(() => hasPermission('templates.publish'))
const dirty = computed(() => Boolean(selected.value) && (
  draftStatus.value !== selected.value?.status
  || draftFeatured.value !== selected.value?.featured
  || draftSortOrder.value !== selected.value?.sortOrder
))

function messageOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function formatDate(value?: string): string {
  if (!value) return '使用默认配置'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function statusMeta(value: AdminTemplate['status']) {
  if (value === 'published') return { label: '已发布', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' }
  if (value === 'draft') return { label: '草稿', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' }
  return { label: '已归档', class: 'bg-slate-500/10 text-slate-500' }
}

function openTemplate(template: AdminTemplate) {
  selected.value = template
  draftStatus.value = template.status
  draftFeatured.value = template.featured
  draftSortOrder.value = template.sortOrder
}

function closeDrawer() {
  if (dirty.value && !window.confirm('当前模板运营设置尚未保存，确定关闭吗？')) return
  selected.value = null
}

async function load(silent = false) {
  if (!isOperator.value) return
  if (!silent) loading.value = true
  error.value = ''
  try {
    const result = await listAdminTemplates({ q: query.value, status: status.value })
    templates.value = result.templates
    summary.value = result.summary
    if (selected.value) {
      const current = result.templates.find((item) => item.id === selected.value?.id)
      if (current) openTemplate(current)
      else selected.value = null
    }
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!selected.value || !canPublish.value || !dirty.value) return
  if (
    selected.value.status === 'published'
    && draftStatus.value !== 'published'
    && !window.confirm('该模板将立即从公开模板中心隐藏，现有项目不会受影响。继续吗？')
  ) return

  saving.value = true
  try {
    const updated = await updateAdminTemplate(selected.value.id, {
      status: draftStatus.value,
      featured: draftFeatured.value,
      sortOrder: draftSortOrder.value,
      expectedVersion: selected.value.operationVersion,
    })
    templates.value = templates.value.map((item) => item.id === updated.id ? updated : item)
    openTemplate(updated)
    toast.success('模板运营设置已保存', `${updated.name} · ${statusMeta(updated.status).label}`)
    await load(true)
  } catch (err) {
    toast.error('保存失败', messageOf(err))
    if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') await load(true)
  } finally {
    saving.value = false
  }
}

watch(status, () => void load(true))
watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void load(true), 280)
})
onMounted(() => void load())
</script>

<template>
  <main class="min-h-screen bg-app pt-16 text-ink">
    <div v-if="authLoading" class="flex min-h-[70vh] items-center justify-center">
      <Loader2 class="h-7 w-7 animate-spin text-brand1" />
    </div>

    <section v-else-if="!isAuthenticated || !isOperator" class="mx-auto flex min-h-[72vh] max-w-xl items-center px-4 text-center">
      <div class="w-full rounded-3xl border border-line/10 bg-soft/65 p-9 shadow-2xl shadow-black/5">
        <LockKeyhole class="mx-auto h-10 w-10 text-amber-500" />
        <h1 class="mt-5 text-2xl font-bold">没有模板运营权限</h1>
        <p class="mt-3 text-sm leading-7 text-mut">该工作区只对管理员和支持人员开放，写入操作还需要模板发布权限。</p>
        <RouterLink to="/" class="mt-6 inline-flex rounded-xl border border-line/12 px-5 py-3 text-sm font-semibold text-sub">返回首页</RouterLink>
      </div>
    </section>

    <div v-else class="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <header class="flex flex-wrap items-start justify-between gap-4 border-b border-line/10 pb-6">
        <div>
          <button class="flex items-center gap-1.5 text-xs font-medium text-mut hover:text-ink" @click="router.push(user?.role === 'admin' ? '/admin' : '/')">
            <ArrowLeft class="h-3.5 w-3.5" />{{ user?.role === 'admin' ? '运营控制台' : '返回首页' }}
          </button>
          <div class="mt-4 flex items-center gap-3">
            <span class="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10 text-violet-500"><LayoutTemplate class="h-5 w-5" /></span>
            <div><h1 class="text-2xl font-bold tracking-tight sm:text-3xl">官方模板运营</h1><p class="mt-1 text-sm text-mut">控制可见性、精选排序和模板供给质量。</p></div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="!canPublish" class="rounded-full bg-sky-500/10 px-3 py-1.5 text-[10px] font-semibold text-sky-500">只读模式</span>
          <button :disabled="loading" class="flex items-center gap-2 rounded-xl border border-line/12 bg-soft/55 px-3.5 py-2.5 text-xs font-semibold text-sub disabled:opacity-50" @click="load(true)">
            <RefreshCw class="h-3.5 w-3.5" :class="loading && 'animate-spin'" />刷新
          </button>
        </div>
      </header>

      <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article v-for="item in [
          ['全部模板', summary.total], ['已发布', summary.published], ['草稿', summary.draft], ['已归档', summary.archived], ['精选', summary.featured],
        ]" :key="String(item[0])" class="rounded-2xl border border-line/10 bg-soft/60 p-4">
          <p class="text-[10px] font-medium text-faint">{{ item[0] }}</p><p class="mt-2 text-2xl font-bold">{{ item[1] }}</p>
        </article>
      </div>

      <div class="mt-5 flex flex-col gap-3 sm:flex-row">
        <label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-soft/60 px-3.5 py-2.5 focus-within:border-brand1/35 focus-within:ring-4 focus-within:ring-brand1/7">
          <Search class="h-4 w-4 text-faint" /><input v-model="query" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" placeholder="搜索名称、行业、分类或站点类型" />
        </label>
        <label class="relative"><span class="sr-only">模板状态</span><select v-model="status" class="appearance-none rounded-xl border border-line/10 bg-soft/60 py-2.5 pr-9 pl-3 text-xs text-sub outline-none"><option value="all">全部状态</option><option value="published">已发布</option><option value="draft">草稿</option><option value="archived">已归档</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
      </div>

      <div v-if="error" class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">{{ error }}</div>
      <div v-if="loading" class="flex min-h-[45vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>

      <div v-else class="mt-5 overflow-hidden rounded-2xl border border-line/10 bg-soft/55">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[980px] text-left">
            <thead class="border-b border-line/10 bg-ink/[0.025] text-[10px] font-semibold tracking-wider text-faint uppercase"><tr><th class="px-4 py-3">模板</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">使用表现</th><th class="px-4 py-3">质量信号</th><th class="px-4 py-3">最近配置</th><th class="px-4 py-3 text-right">操作</th></tr></thead>
            <tbody class="divide-y divide-line/8">
              <tr v-for="item in templates" :key="item.id" class="transition hover:bg-ink/[0.025]">
                <td class="px-4 py-4"><div class="flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-brand1/10 text-brand1"><LayoutTemplate class="h-4.5 w-4.5" /></span><div><p class="text-xs font-semibold">{{ item.name }}</p><p class="mt-1 text-[10px] text-faint">{{ item.industry }} · {{ item.siteType }}</p></div></div></td>
                <td class="px-4 py-4"><div class="flex flex-wrap items-center gap-2"><span class="rounded-md px-2 py-1 text-[10px] font-semibold" :class="statusMeta(item.status).class">{{ statusMeta(item.status).label }}</span><span v-if="item.featured" class="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-500"><Sparkles class="h-3 w-3" />精选</span></div></td>
                <td class="px-4 py-4"><p class="text-xs font-semibold">{{ item.useCount }} 次创建</p><p class="mt-1 text-[10px] text-faint">{{ item.publicationCount }} 个已发布项目</p></td>
                <td class="px-4 py-4"><p class="text-xs font-semibold" :class="item.negativeFeedbackCount ? 'text-amber-500' : 'text-emerald-500'">{{ item.negativeFeedbackCount }} 条负向反馈</p><p class="mt-1 text-[10px] text-faint">排序权重 {{ item.sortOrder }}</p></td>
                <td class="px-4 py-4"><p class="text-xs text-sub">{{ formatDate(item.operationUpdatedAt) }}</p><p class="mt-1 text-[10px] text-faint">配置版本 {{ item.operationVersion }}</p></td>
                <td class="px-4 py-4 text-right"><button class="inline-flex items-center gap-1.5 rounded-lg border border-line/10 px-3 py-2 text-[10px] font-semibold text-sub hover:border-brand1/25 hover:text-brand1" @click="openTemplate(item)"><SlidersHorizontal class="h-3.5 w-3.5" />{{ canPublish ? '管理' : '查看' }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="!templates.length" class="p-14 text-center text-sm text-faint">没有匹配的官方模板</div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="selected" class="fixed inset-0 z-[140] bg-black/45 backdrop-blur-[2px]" @mousedown.self="closeDrawer">
          <aside role="dialog" aria-modal="true" aria-label="模板运营详情" class="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line/10 bg-app shadow-2xl">
            <header class="flex items-start justify-between gap-4 border-b border-line/10 p-5 sm:p-6"><div><p class="text-[10px] font-semibold tracking-wider text-brand1 uppercase">Template Operations</p><h2 class="mt-2 text-xl font-bold">{{ selected.name }}</h2><p class="mt-1 text-xs text-mut">{{ selected.description }}</p></div><button class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭" @click="closeDrawer"><X class="h-5 w-5" /></button></header>
            <div class="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6">
              <section><h3 class="text-xs font-semibold">公开状态</h3><div class="mt-3 grid grid-cols-3 gap-2"><button v-for="option in ['published','draft','archived'] as const" :key="option" :disabled="!canPublish" class="rounded-xl border px-3 py-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50" :class="draftStatus === option ? 'border-brand1/40 bg-brand1/10 text-brand1' : 'border-line/10 bg-soft/45 text-mut'" @click="draftStatus = option">{{ statusMeta(option).label }}</button></div><p class="mt-2 text-[10px] leading-5 text-faint">草稿与归档状态会立即从公开目录、预览接口和创建项目接口隐藏。</p></section>
              <section class="grid gap-4 sm:grid-cols-2"><label class="rounded-2xl border border-line/10 bg-soft/50 p-4"><span class="flex items-center justify-between gap-3"><span><strong class="block text-xs">精选模板</strong><small class="mt-1 block text-[10px] text-faint">在模板中心优先展示</small></span><input v-model="draftFeatured" type="checkbox" :disabled="!canPublish" class="h-5 w-5 accent-violet-500" /></span></label><label class="rounded-2xl border border-line/10 bg-soft/50 p-4"><span class="text-xs font-semibold">排序权重</span><input v-model.number="draftSortOrder" type="number" min="0" max="999" :disabled="!canPublish" class="mt-2 w-full rounded-xl border border-line/10 bg-app/60 px-3 py-2.5 text-sm outline-none focus:border-brand1/35" /><small class="mt-1 block text-[10px] text-faint">数字越小越靠前</small></label></section>
              <section class="rounded-2xl border border-line/10 bg-soft/50 p-4"><h3 class="text-xs font-semibold">表现与质量</h3><div class="mt-4 grid grid-cols-3 gap-3 text-center"><div><strong class="text-lg">{{ selected.useCount }}</strong><p class="mt-1 text-[9px] text-faint">创建项目</p></div><div><strong class="text-lg">{{ selected.publicationCount }}</strong><p class="mt-1 text-[9px] text-faint">发布站点</p></div><div><strong class="text-lg" :class="selected.negativeFeedbackCount && 'text-amber-500'">{{ selected.negativeFeedbackCount }}</strong><p class="mt-1 text-[9px] text-faint">负向反馈</p></div></div></section>
              <section class="rounded-2xl border border-line/10 bg-soft/50 p-4"><div class="flex items-center justify-between"><div><h3 class="text-xs font-semibold">用户侧预览</h3><p class="mt-1 text-[10px] text-faint">只有已发布模板可通过公开接口访问。</p></div><RouterLink v-if="selected.status === 'published'" to="/templates" class="flex items-center gap-1.5 rounded-lg border border-line/10 px-3 py-2 text-[10px] font-semibold text-brand1"><Eye class="h-3.5 w-3.5" />打开模板中心</RouterLink><Archive v-else class="h-4 w-4 text-faint" /></div></section>
            </div>
            <footer class="flex items-center justify-between gap-3 border-t border-line/10 bg-soft/35 p-5 sm:p-6"><div class="text-[10px] text-faint"><span v-if="dirty" class="font-semibold text-amber-500">有未保存修改</span><span v-else>配置版本 {{ selected.operationVersion }}</span></div><div class="flex gap-2"><button class="rounded-xl border border-line/10 px-4 py-2.5 text-sm text-sub" @click="closeDrawer">关闭</button><button v-if="canPublish" :disabled="!dirty || saving" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45" @click="save"><Loader2 v-if="saving" class="h-4 w-4 animate-spin" /><BadgeCheck v-else class="h-4 w-4" />保存设置</button></div></footer>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.drawer-enter-active,.drawer-leave-active{transition:opacity .18s ease}.drawer-enter-active aside,.drawer-leave-active aside{transition:transform .24s cubic-bezier(.22,1,.36,1)}.drawer-enter-from,.drawer-leave-to{opacity:0}.drawer-enter-from aside,.drawer-leave-to aside{transform:translateX(28px)}
</style>

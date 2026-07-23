<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  CloudOff,
  Columns2,
  Download,
  ExternalLink,
  FileClock,
  Gauge,
  History,
  LayoutDashboard,
  Loader2,
  Monitor,
  Note,
  Palette,
  Pencil,
  PencilRuler,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Star,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import VisualEditor from '../components/VisualEditor.vue'
import SiteQualityPanel from '../components/SiteQualityPanel.vue'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useFeatures } from '../composables/useFeatures'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import { downloadSiteZip } from '../lib/exportArtifact'
import {
  analyzeSiteQuality,
  applyAllSafeQualityFixes,
  applyQualityFix,
  type QualityIssue,
} from '../lib/siteQuality'
import {
  addProjectVersion,
  createPublication,
  getProject,
  getProjectVersion,
  listPublications,
  republish,
  rollbackProject,
  updateProjectVersion,
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
const { enabled } = useFeatures()
const toast = useToast()

type WorkspaceTab = 'overview' | 'preview' | 'quality' | 'versions' | 'compare'
const TABS = [
  { id: 'overview' as const, label: '项目概览', icon: LayoutDashboard },
  { id: 'preview' as const, label: '页面预览', icon: Monitor },
  { id: 'quality' as const, label: '质量检查', icon: ShieldCheck },
  { id: 'versions' as const, label: '版本管理', icon: FileClock },
  { id: 'compare' as const, label: '版本对比', icon: Columns2 },
]

const detail = ref<ProjectDetail | null>(null)
const selected = ref<ProjectVersion | null>(null)
const publication = ref<Publication | null>(null)
const compareVersion = ref<ProjectVersion | null>(null)
const loading = ref(false)
const previewLoading = ref(false)
const compareLoading = ref(false)
const actionBusy = ref('')
const error = ref('')
const editorOpen = ref(false)
const activeTab = ref<WorkspaceTab>((route.query.tab as WorkspaceTab) || 'overview')
const previewWidth = ref<'desktop' | 'mobile'>('desktop')
const compareWidth = ref<'split' | 'current' | 'other'>('split')
const compareVersionId = ref('')
const editingVersionId = ref('')
const versionName = ref('')
const versionNote = ref('')
const ignoredQualityRules = ref<string[]>([])

const projectId = computed(() => String(route.params.id ?? ''))
const preferredVersionId = computed(() => typeof route.query.version === 'string' ? route.query.version : '')
const versions = computed(() => detail.value?.versions ?? [])
const selectedSummary = computed(() => versions.value.find((version) => version.id === selected.value?.id) ?? null)
const quality = computed(() => selected.value ? analyzeSiteQuality(selected.value.html) : null)
const publishedVersion = computed(() => versions.value.find((version) => version.id === publication.value?.versionId) ?? null)
const nextActions = computed(() => {
  const result: Array<{ label: string; description: string; action: WorkspaceTab | 'publish' | 'brand' | 'edit' }> = []
  if (!selected.value) result.push({ label: '创建第一个页面版本', description: '从生成器或模板中心建立项目内容。', action: 'preview' })
  if (quality.value && quality.value.counts.error > 0) result.push({ label: `修复 ${quality.value.counts.error} 个严重问题`, description: '先处理会影响发布、移动端或无障碍的问题。', action: 'quality' })
  if (selected.value && enabled('visual-editor')) result.push({ label: '继续完善页面内容', description: '使用结构树、区块库和响应式样式编辑。', action: 'edit' })
  if (selected.value && enabled('brand-kits') && !detail.value?.project.brandKitId) result.push({ label: '应用品牌套件', description: '统一颜色、字体和视觉语言。', action: 'brand' })
  if (selected.value && !publication.value && enabled('site-publishing')) result.push({ label: '发布网站', description: '质量检查完成后生成独立访问地址。', action: 'publish' })
  if (versions.value.length > 1) result.push({ label: '对比最近版本', description: '并排检查修改是否符合预期。', action: 'compare' })
  return result.slice(0, 4)
})

function formatDate(value?: string): string {
  if (!value) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '操作失败'
}

function sourceLabel(source: ProjectVersionSummary['source']): string {
  return { generate: 'AI 生成', iterate: 'AI 迭代', editor: '可视化编辑', import: '模板/导入' }[source]
}

async function setTab(tab: WorkspaceTab) {
  activeTab.value = tab
  await router.replace({ query: { ...route.query, tab } })
}

async function selectVersion(version: ProjectVersionSummary) {
  if (previewLoading.value || selected.value?.id === version.id) return
  previewLoading.value = true
  try {
    selected.value = await getProjectVersion(projectId.value, version.id)
    if (preferredVersionId.value !== version.id) await router.replace({ query: { ...route.query, version: version.id } })
  } catch (err) {
    toast.error('版本加载失败', messageOf(err))
  } finally {
    previewLoading.value = false
  }
}

async function load(preferredId = preferredVersionId.value) {
  if (!isAuthenticated.value || !projectId.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const [projectDetail, publications] = await Promise.all([getProject(projectId.value), listPublications()])
    detail.value = projectDetail
    publication.value = publications.find((item) => item.projectId === projectId.value) ?? null
    const target = projectDetail.versions.find((version) => version.id === preferredId) ?? projectDetail.versions[0]
    if (target) {
      selected.value = await getProjectVersion(projectId.value, target.id)
      if (preferredVersionId.value !== target.id) await router.replace({ query: { ...route.query, version: target.id } })
    } else selected.value = null
    if (!compareVersionId.value && projectDetail.versions.length > 1) compareVersionId.value = projectDetail.versions.find((item) => item.id !== target?.id)?.id ?? ''
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

async function loadCompare() {
  if (!compareVersionId.value || compareVersionId.value === selected.value?.id) {
    compareVersion.value = null
    return
  }
  compareLoading.value = true
  try { compareVersion.value = await getProjectVersion(projectId.value, compareVersionId.value) }
  catch (err) { toast.error('对比版本加载失败', messageOf(err)) }
  finally { compareLoading.value = false }
}

async function rollback(version: ProjectVersionSummary) {
  actionBusy.value = `rollback:${version.id}`
  try {
    const created = await rollbackProject(projectId.value, version.id)
    toast.success('已创建回滚版本', `第 ${created.version} 版基于第 ${version.version} 版生成。`)
    await load(created.id)
  } catch (err) { toast.error('回滚失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function saveEdited(html: string) {
  if (!enabled('visual-editor') || !selected.value) return
  actionBusy.value = 'editor'
  try {
    const created = await addProjectVersion(projectId.value, {
      html,
      source: 'editor',
      instruction: '可视化编辑器修改',
      name: `编辑版本 ${versions.value.length + 1}`,
      parentVersionId: selected.value.id,
    })
    toast.success('编辑已保存', `已创建第 ${created.version} 版；编辑器保持打开，可继续修改。`)
    await load(created.id)
  } catch (err) { toast.error('保存失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

function openBrandKits() {
  if (!selected.value || !enabled('brand-kits')) return
  void router.push({ name: 'brand-kits', query: { project: projectId.value, version: selected.value.id } })
}

async function publish() {
  if (!enabled('site-publishing')) return
  const version = selectedSummary.value
  if (!detail.value || !version) return
  actionBusy.value = 'publish'
  try {
    if (publication.value) {
      publication.value = await republish(publication.value.id, { versionId: version.id })
      toast.success('重新发布完成', `线上站点已更新为第 ${version.version} 版。`)
    } else {
      publication.value = await createPublication({ title: detail.value.project.title, projectId: detail.value.project.id, versionId: version.id })
      toast.success('站点已发布', '已生成独立访问地址。')
    }
  } catch (err) { toast.error('发布失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function togglePublication() {
  if (!publication.value) return
  const next = publication.value.status === 'published' ? 'offline' : 'published'
  if (next === 'published' && !enabled('site-publishing')) {
    toast.error('暂时无法恢复上线', '发布能力当前处于关闭或灰度未命中状态。')
    return
  }
  actionBusy.value = 'status'
  try {
    publication.value = await updatePublication(publication.value.id, { status: next })
    toast.success(next === 'published' ? '站点已恢复上线' : '站点已下线')
  } catch (err) { toast.error('状态更新失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function exportZip() {
  if (!selected.value || !detail.value) return
  actionBusy.value = 'export'
  try {
    const fileName = await downloadSiteZip({ html: selected.value.html, title: detail.value.project.title, siteType: detail.value.project.siteType, requirement: detail.value.project.requirement, model: selected.value.model, generatedAt: selected.value.createdAt })
    toast.success('ZIP 已导出', fileName)
  } catch (err) { toast.error('导出失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

function editMetadata(version: ProjectVersionSummary) {
  editingVersionId.value = version.id
  versionName.value = version.name || `第 ${version.version} 版`
  versionNote.value = version.note || ''
}

async function saveVersionMetadata(version: ProjectVersionSummary) {
  actionBusy.value = `meta:${version.id}`
  try {
    const updated = await updateProjectVersion(projectId.value, version.id, { name: versionName.value.trim() || null, note: versionNote.value.trim() || null })
    if (detail.value) detail.value.versions = detail.value.versions.map((item) => item.id === updated.id ? updated : item)
    if (selected.value?.id === updated.id) selected.value = { ...selected.value, name: updated.name, note: updated.note }
    editingVersionId.value = ''
    toast.success('版本信息已更新')
  } catch (err) { toast.error('保存失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function toggleVersionStar(version: ProjectVersionSummary) {
  actionBusy.value = `star:${version.id}`
  try {
    const updated = await updateProjectVersion(projectId.value, version.id, { starred: !version.starred })
    if (detail.value) detail.value.versions = detail.value.versions.map((item) => item.id === updated.id ? updated : item)
  } catch (err) { toast.error('操作失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function createQualityVersion(html: string, name: string, summary: string[]) {
  if (!selected.value) return
  actionBusy.value = 'quality'
  try {
    const created = await addProjectVersion(projectId.value, { html, source: 'editor', instruction: name, name, parentVersionId: selected.value.id, changeSummary: summary })
    toast.success('质量修复已保存', `已创建第 ${created.version} 版，原版本保持不变。`)
    await load(created.id)
  } catch (err) { toast.error('修复保存失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

function applyIssue(issue: QualityIssue) {
  if (!selected.value) return
  void createQualityVersion(applyQualityFix(selected.value.html, issue), `修复：${issue.title}`, [issue.title])
}

function applyAllIssues(issues: QualityIssue[]) {
  if (!selected.value) return
  void createQualityVersion(applyAllSafeQualityFixes(selected.value.html, issues), '站点质量自动修复', issues.map((item) => item.title).slice(0, 12))
}

function ignoreRule(rule: string) {
  if (!ignoredQualityRules.value.includes(rule)) ignoredQualityRules.value.push(rule)
}

function focusIssue(issue: QualityIssue) {
  void setTab('preview')
  toast.info('已切换到页面预览', issue.elementLabel || issue.title)
}

function runNextAction(action: (typeof nextActions.value)[number]['action']) {
  if (action === 'publish') void publish()
  else if (action === 'brand') openBrandKits()
  else if (action === 'edit') editorOpen.value = true
  else void setTab(action)
}

watch(isAuthenticated, (value) => value && void load())
watch(projectId, () => void load())
watch(preferredVersionId, (value) => {
  if (value && value !== selected.value?.id && versions.value.some((version) => version.id === value)) void load(value)
})
watch(compareVersionId, () => void loadCompare())
watch(() => route.query.tab, (value) => {
  if (TABS.some((item) => item.id === value)) activeTab.value = value as WorkspaceTab
})
onMounted(() => void load())
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-20 pb-16">
    <div v-if="authLoading && !isAuthenticated" class="flex min-h-[60vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>
    <section v-else-if="!isAuthenticated" class="mx-auto mt-16 max-w-lg px-4 text-center"><div class="rounded-3xl border border-line/10 bg-soft/70 p-10"><UserRound class="mx-auto h-10 w-10 text-brand1" /><h1 class="mt-4 text-xl font-semibold">登录后打开云端项目</h1><p class="mt-2 text-sm text-mut">项目版本和发布状态仅对项目所有者可见。</p><button class="bg-brand-gradient mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="showAuth">登录 SiteForge</button></div></section>

    <div v-else class="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-7">
      <header class="flex flex-wrap items-center gap-3 border-b border-line/10 py-4">
        <button class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-mut hover:bg-ink/5 hover:text-ink" @click="router.push('/projects')"><ArrowLeft class="h-4 w-4" />项目列表</button>
        <div v-if="detail" class="min-w-0 flex-1"><div class="flex items-center gap-2"><h1 class="truncate text-base font-semibold">{{ detail.project.title }}</h1><span v-if="detail.project.templateId" class="rounded bg-violet-500/10 px-2 py-0.5 text-[9px] text-violet-500">官方模板</span></div><p class="truncate text-xs text-faint">{{ detail.project.requirement || '暂无需求描述' }}</p></div>
        <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button :disabled="loading" class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink disabled:opacity-40" title="刷新项目" @click="load(selected?.id)"><RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /></button>
          <button v-if="selected" :disabled="actionBusy === 'export'" class="flex items-center gap-1.5 rounded-xl border border-line/12 bg-ink/[0.04] px-3.5 py-2.5 text-xs font-medium text-sub" @click="exportZip"><Loader2 v-if="actionBusy === 'export'" class="h-3.5 w-3.5 animate-spin" /><Download v-else class="h-3.5 w-3.5" />导出 ZIP</button>
          <button v-if="selected && enabled('brand-kits')" class="flex items-center gap-1.5 rounded-xl border border-brand2/20 bg-brand2/[0.07] px-3.5 py-2.5 text-xs font-semibold text-brand2" @click="openBrandKits"><Palette class="h-3.5 w-3.5" />应用品牌</button>
          <button v-if="selected && enabled('visual-editor')" class="flex items-center gap-1.5 rounded-xl border border-brand1/20 bg-brand1/[0.08] px-3.5 py-2.5 text-xs font-semibold text-brand1" @click="editorOpen = true"><PencilRuler class="h-3.5 w-3.5" />可视化编辑</button>
          <button v-if="selected && enabled('site-publishing')" :disabled="actionBusy === 'publish'" class="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50" @click="publish"><Loader2 v-if="actionBusy === 'publish'" class="h-3.5 w-3.5 animate-spin" /><Rocket v-else class="h-3.5 w-3.5" />{{ publication ? '发布当前版本' : '一键发布' }}</button>
        </div>
      </header>

      <div v-if="error" class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">{{ error }}</div>
      <div v-if="loading && !detail" class="flex min-h-[65vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>

      <div v-else-if="detail" class="mt-5 grid min-h-[720px] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside class="overflow-hidden rounded-2xl border border-line/10 bg-soft/65">
          <div class="flex items-center justify-between border-b border-line/10 px-4 py-3"><p class="flex items-center gap-2 text-sm font-semibold"><History class="h-4 w-4 text-brand1" />版本历史</p><span class="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] text-faint">{{ versions.length }}</span></div>
          <div v-if="versions.length" class="max-h-[570px] space-y-1 overflow-y-auto p-2">
            <button v-for="version in versions" :key="version.id" class="group w-full rounded-xl border p-3 text-left" :class="selected?.id === version.id ? 'border-brand1/25 bg-brand1/[0.09]' : 'border-transparent hover:border-line/10 hover:bg-ink/[0.035]'" @click="selectVersion(version)">
              <div class="flex items-center justify-between gap-2"><span class="truncate text-xs font-semibold" :class="selected?.id === version.id ? 'text-brand1' : 'text-ink'">{{ version.name || `第 ${version.version} 版` }}</span><Star v-if="version.starred" class="h-3 w-3 shrink-0 fill-current text-amber-500" /></div>
              <p class="mt-1 line-clamp-2 text-[10px] leading-4 text-mut">{{ version.note || version.instruction || '未添加版本说明' }}</p>
              <div class="mt-2 flex items-center justify-between text-[9px] text-faint"><span>{{ sourceLabel(version.source) }}</span><span>v{{ version.version }} · {{ (version.sizeBytes / 1024).toFixed(1) }}KB</span></div>
              <button v-if="selected?.id !== version.id" :disabled="actionBusy === `rollback:${version.id}`" class="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[9px] text-faint opacity-0 hover:bg-brand1/10 hover:text-brand1 group-hover:opacity-100" @click.stop="rollback(version)"><Loader2 v-if="actionBusy === `rollback:${version.id}`" class="h-3 w-3 animate-spin" /><RotateCcw v-else class="h-3 w-3" />以此版本创建新版本</button>
            </button>
          </div>
          <div v-else class="p-8 text-center text-xs text-faint">该项目还没有可预览的版本</div>

          <div v-if="publication" class="border-t border-line/10 p-4"><div class="flex items-center justify-between gap-2"><p class="flex items-center gap-1.5 text-xs font-medium"><span class="h-2 w-2 rounded-full" :class="publication.status === 'published' ? 'bg-emerald-500' : 'bg-zinc-400'" />{{ publication.status === 'published' ? '线上运行中' : '当前已下线' }}</p><button :disabled="actionBusy === 'status'" class="text-[10px] text-faint hover:text-brand1" @click="togglePublication">{{ publication.status === 'published' ? '下线' : '恢复上线' }}</button></div><a v-if="publication.status === 'published'" :href="publication.url" target="_blank" rel="noopener noreferrer" class="mt-2 flex items-center gap-1.5 truncate text-[11px] text-brand1 hover:underline"><ExternalLink class="h-3 w-3" />{{ publication.url }}</a><p v-else class="mt-2 flex items-center gap-1.5 text-[11px] text-faint"><CloudOff class="h-3 w-3" />访问地址暂不可用</p></div>
        </aside>

        <section class="min-w-0 overflow-hidden rounded-2xl border border-line/10 bg-soft/60">
          <nav class="flex gap-1 overflow-x-auto border-b border-line/10 bg-app/45 p-2" aria-label="项目工作区">
            <button v-for="tab in TABS" :key="tab.id" class="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs" :class="activeTab === tab.id ? 'bg-brand1/10 font-semibold text-brand1' : 'text-faint hover:bg-ink/5 hover:text-ink'" @click="setTab(tab.id)"><component :is="tab.icon" class="h-3.5 w-3.5" />{{ tab.label }}</button>
          </nav>

          <div v-if="activeTab === 'overview'" class="p-5 sm:p-7">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article class="rounded-2xl border border-line/10 bg-app/45 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><FileClock class="h-4.5 w-4.5" /></span><strong class="mt-4 block text-2xl">{{ versions.length }}</strong><p class="mt-1 text-[10px] text-faint">不可变项目版本</p></article>
              <article class="rounded-2xl border border-line/10 bg-app/45 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><Gauge class="h-4.5 w-4.5" /></span><strong class="mt-4 block text-2xl">{{ quality?.score ?? '—' }}</strong><p class="mt-1 text-[10px] text-faint">当前版本质量分</p></article>
              <article class="rounded-2xl border border-line/10 bg-app/45 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-500"><Rocket class="h-4.5 w-4.5" /></span><strong class="mt-4 block text-sm">{{ publication ? (publication.status === 'published' ? '已发布' : '已下线') : '未发布' }}</strong><p class="mt-1 text-[10px] text-faint">{{ publishedVersion ? `线上为第 ${publishedVersion.version} 版` : '尚无线上版本' }}</p></article>
              <article class="rounded-2xl border border-line/10 bg-app/45 p-4"><span class="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><BadgeCheck class="h-4.5 w-4.5" /></span><strong class="mt-4 block truncate text-sm">{{ selectedSummary?.name || (selectedSummary ? `第 ${selectedSummary.version} 版` : '暂无版本') }}</strong><p class="mt-1 text-[10px] text-faint">当前工作版本</p></article>
            </div>

            <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
              <article class="rounded-2xl border border-line/10 bg-app/45 p-5"><h2 class="text-sm font-semibold">当前版本摘要</h2><div v-if="selectedSummary" class="mt-4 grid gap-3"><div class="flex items-center justify-between rounded-xl border border-line/8 bg-soft/55 p-3"><span class="text-xs text-mut">来源</span><strong class="text-xs">{{ sourceLabel(selectedSummary.source) }}</strong></div><div class="flex items-center justify-between rounded-xl border border-line/8 bg-soft/55 p-3"><span class="text-xs text-mut">创建时间</span><strong class="text-xs">{{ formatDate(selectedSummary.createdAt) }}</strong></div><div class="rounded-xl border border-line/8 bg-soft/55 p-3"><span class="text-xs text-mut">变更摘要</span><ul class="mt-2 grid gap-1.5 text-[11px] text-sub"><li v-for="item in selectedSummary.changeSummary" :key="item" class="flex gap-2"><CheckCircle2 class="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />{{ item }}</li><li v-if="!selectedSummary.changeSummary.length" class="text-faint">暂无自动摘要</li></ul></div></div></article>
              <article class="rounded-2xl border border-line/10 bg-app/45 p-5"><div class="flex items-center justify-between"><h2 class="text-sm font-semibold">推荐下一步</h2><WandSparkles class="h-4 w-4 text-brand1" /></div><div class="mt-4 grid gap-2"><button v-for="item in nextActions" :key="item.label" class="rounded-xl border border-line/8 bg-soft/55 p-3 text-left hover:border-brand1/25" @click="runNextAction(item.action)"><strong class="text-xs">{{ item.label }}</strong><span class="mt-1 block text-[10px] leading-4 text-faint">{{ item.description }}</span></button><p v-if="!nextActions.length" class="py-8 text-center text-xs text-faint">当前项目已完成主要步骤。</p></div></article>
            </div>
          </div>

          <div v-else-if="activeTab === 'preview'" class="flex min-h-[680px] flex-col">
            <div class="flex items-center gap-3 border-b border-line/10 bg-app/45 px-4 py-3"><div class="flex gap-1.5"><span v-for="item in 3" :key="item" class="h-2.5 w-2.5 rounded-full bg-line/25" /></div><div class="min-w-0 flex-1 truncate rounded-md bg-ink/[0.04] px-3 py-1.5 text-[11px] text-faint">{{ selected ? `${detail.project.title} / v${selected.version}` : '暂无版本' }}</div><div class="flex rounded-lg bg-ink/[0.04] p-1"><button class="rounded-md px-2 py-1 text-[10px]" :class="previewWidth === 'desktop' ? 'bg-soft text-ink shadow' : 'text-faint'" @click="previewWidth = 'desktop'"><Monitor class="h-3.5 w-3.5" /></button><button class="rounded-md px-2 py-1 text-[10px]" :class="previewWidth === 'mobile' ? 'bg-soft text-ink shadow' : 'text-faint'" @click="previewWidth = 'mobile'"><Smartphone class="h-3.5 w-3.5" /></button></div></div>
            <div class="relative min-h-0 flex-1 bg-ink/[0.035] p-3 sm:p-5"><div v-if="previewLoading" class="absolute inset-0 z-10 flex items-center justify-center bg-app/45 backdrop-blur-sm"><Loader2 class="h-6 w-6 animate-spin text-brand1" /></div><div v-if="selected" class="mx-auto h-full min-h-[610px] overflow-hidden rounded-xl border border-line/12 bg-white shadow-2xl shadow-black/15" :class="previewWidth === 'mobile' ? 'max-w-[390px]' : 'max-w-none'"><iframe :srcdoc="selected.html" sandbox="allow-scripts" referrerpolicy="no-referrer" class="h-full min-h-[610px] w-full" title="项目版本预览" /></div><div v-else class="flex h-full min-h-[610px] flex-col items-center justify-center text-center"><CheckCircle2 class="h-8 w-8 text-faint" /><p class="mt-3 text-sm text-mut">尚无项目版本</p><RouterLink to="/generator" class="mt-3 text-xs text-brand1">前往生成器创建内容</RouterLink></div></div>
          </div>

          <SiteQualityPanel v-else-if="activeTab === 'quality' && selected" class="min-h-[680px] rounded-none border-0" :html="selected.html" :ignored-rules="ignoredQualityRules" @apply="applyIssue" @apply-all="applyAllIssues" @focus="focusIssue" @ignore="ignoreRule" />

          <div v-else-if="activeTab === 'versions'" class="p-5 sm:p-7"><div class="flex items-end justify-between"><div><h2 class="text-lg font-semibold">版本管理</h2><p class="mt-1 text-xs text-faint">为重要版本命名、添加备注或收藏。</p></div><span class="text-[10px] text-faint">共 {{ versions.length }} 版</span></div><div class="mt-5 grid gap-3"><article v-for="version in versions" :key="version.id" class="rounded-2xl border border-line/10 bg-app/45 p-4"><div v-if="editingVersionId === version.id" class="grid gap-3"><input v-model="versionName" maxlength="80" placeholder="版本名称" class="rounded-xl border border-line/10 bg-soft/65 px-3 py-2.5 text-sm outline-none" /><textarea v-model="versionNote" rows="3" maxlength="500" placeholder="记录这版解决了什么问题、需要继续关注什么。" class="resize-y rounded-xl border border-line/10 bg-soft/65 p-3 text-xs leading-5 outline-none" /><div class="flex justify-end gap-2"><button class="rounded-lg border border-line/10 px-3 py-2 text-xs text-faint" @click="editingVersionId = ''">取消</button><button :disabled="actionBusy === `meta:${version.id}`" class="bg-brand-gradient flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white" @click="saveVersionMetadata(version)"><Loader2 v-if="actionBusy === `meta:${version.id}`" class="h-3.5 w-3.5 animate-spin" /><Check v-else class="h-3.5 w-3.5" />保存</button></div></div><template v-else><div class="flex items-start gap-3"><span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand1/10 text-brand1"><FileClock class="h-4.5 w-4.5" /></span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h3 class="text-sm font-semibold">{{ version.name || `第 ${version.version} 版` }}</h3><span class="rounded bg-ink/5 px-2 py-0.5 text-[9px] text-faint">{{ sourceLabel(version.source) }}</span><span v-if="selected?.id === version.id" class="rounded bg-emerald-500/10 px-2 py-0.5 text-[9px] text-emerald-500">当前版本</span></div><p class="mt-2 text-xs leading-5 text-mut">{{ version.note || version.instruction || '未添加版本备注' }}</p><div class="mt-3 flex flex-wrap gap-2 text-[9px] text-faint"><span>{{ formatDate(version.createdAt) }}</span><span>{{ (version.sizeBytes / 1024).toFixed(1) }}KB</span><span v-for="item in version.changeSummary.slice(0,3)" :key="item" class="rounded bg-ink/5 px-1.5 py-0.5">{{ item }}</span></div></div><div class="flex gap-1"><button class="rounded-lg p-2" :class="version.starred ? 'text-amber-500' : 'text-faint hover:text-amber-500'" @click="toggleVersionStar(version)"><Star class="h-4 w-4" :fill="version.starred ? 'currentColor' : 'none'" /></button><button class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-brand1" @click="editMetadata(version)"><Pencil class="h-4 w-4" /></button></div></div></template></article></div></div>

          <div v-else-if="activeTab === 'compare'" class="flex min-h-[680px] flex-col"><div class="flex flex-wrap items-center gap-3 border-b border-line/10 bg-app/45 p-3"><label class="relative min-w-56"><select v-model="compareVersionId" class="w-full appearance-none rounded-xl border border-line/10 bg-soft/65 py-2.5 pr-9 pl-3 text-xs outline-none"><option value="">选择对比版本</option><option v-for="version in versions.filter(item => item.id !== selected?.id)" :key="version.id" :value="version.id">{{ version.name || `第 ${version.version} 版` }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label><div class="flex rounded-xl bg-ink/[0.04] p-1"><button v-for="mode in [{id:'split',label:'并排'},{id:'current',label:'当前版'},{id:'other',label:'对比版'}]" :key="mode.id" class="rounded-lg px-3 py-2 text-[10px]" :class="compareWidth === mode.id ? 'bg-soft font-semibold text-brand1 shadow' : 'text-faint'" @click="compareWidth = mode.id as typeof compareWidth">{{ mode.label }}</button></div><span v-if="compareVersion" class="ml-auto text-[10px] text-faint">{{ selected?.name || `第 ${selected?.version} 版` }} ↔ {{ compareVersion.name || `第 ${compareVersion.version} 版` }}</span></div><div v-if="compareLoading" class="flex flex-1 items-center justify-center"><Loader2 class="h-6 w-6 animate-spin text-brand1" /></div><div v-else-if="selected && compareVersion" class="grid min-h-0 flex-1 gap-3 bg-ink/[0.035] p-3" :class="compareWidth === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'"><div v-show="compareWidth !== 'other'" class="overflow-hidden rounded-xl border border-line/10 bg-white"><div class="border-b border-line/10 bg-app/80 px-3 py-2 text-[10px] font-semibold text-ink">当前：{{ selected.name || `第 ${selected.version} 版` }}</div><iframe :srcdoc="selected.html" sandbox="allow-scripts" class="h-[610px] w-full" title="当前版本" /></div><div v-show="compareWidth !== 'current'" class="overflow-hidden rounded-xl border border-line/10 bg-white"><div class="border-b border-line/10 bg-app/80 px-3 py-2 text-[10px] font-semibold text-ink">对比：{{ compareVersion.name || `第 ${compareVersion.version} 版` }}</div><iframe :srcdoc="compareVersion.html" sandbox="allow-scripts" class="h-[610px] w-full" title="对比版本" /></div></div><div v-else class="flex flex-1 flex-col items-center justify-center p-8 text-center"><Columns2 class="h-9 w-9 text-faint" /><h3 class="mt-4 text-sm font-semibold">选择一个版本开始对比</h3><p class="mt-2 text-xs text-mut">可并排查看视觉结果，也可单独放大任一版本。</p></div></div>
        </section>
      </div>
    </div>

    <VisualEditor v-if="selected" :open="editorOpen" :html="selected.html" :title="`${detail?.project.title ?? '项目'} · ${selected.name || `第 ${selected.version} 版`}`" :draft-key="`${projectId}:${selected.id}`" :site-type="detail?.project.siteType" @close="editorOpen = false" @save="saveEdited" />
  </main>
</template>

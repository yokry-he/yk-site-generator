<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Archive,
  ArrowRight,
  Command,
  FileSearch,
  FlaskConical,
  FolderKanban,
  Gauge,
  Image,
  LayoutTemplate,
  Loader2,
  MessageSquareText,
  Palette,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useFeatures } from '../composables/useFeatures'
import { listProjects, type CloudProject } from '../lib/workspace'

interface CommandItem {
  id: string
  label: string
  description: string
  group: '快速操作' | '最近项目' | '品牌与内容' | '运营'
  icon: typeof Search
  keywords: string
  run: () => unknown | Promise<unknown>
}

const router = useRouter()
const { isAuthenticated, isAdmin, hasPermission } = useAuth()
const { enabled } = useFeatures()
const open = ref(false)
const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement>()
const projects = ref<CloudProject[]>([])
const loadingProjects = ref(false)

const baseCommands = computed<CommandItem[]>(() => {
  const items: CommandItem[] = [
    { id: 'new', label: '新建 AI 网站', description: '打开生成器并开始一个新项目', group: '快速操作', icon: Plus, keywords: '新建 生成 ai 网站', run: () => router.push('/generator') },
    { id: 'projects', label: '打开项目工作区', description: '搜索、收藏、归档和管理项目', group: '快速操作', icon: FolderKanban, keywords: '项目 工作区 最近', run: () => router.push('/projects') },
    { id: 'usage', label: '查看额度与用量', description: '检查生成与发布用量', group: '快速操作', icon: Gauge, keywords: '额度 用量 配额', run: () => router.push('/usage') },
  ]
  if (enabled('official-templates')) items.splice(1, 0, { id: 'templates', label: '浏览官方模板', description: '搜索 24 套官方模板与最近使用', group: '快速操作', icon: LayoutTemplate, keywords: '模板 官方 收藏 最近', run: () => router.push('/templates') })
  if (enabled('brand-kits')) {
    items.push({ id: 'brand', label: '管理品牌套件', description: '颜色、字体、Logo 和主题预设', group: '品牌与内容', icon: Palette, keywords: '品牌 套件 颜色 字体 logo', run: () => router.push('/brand') })
    items.push({ id: 'assets', label: '打开品牌资源库', description: '复用图片、图标、背景和文档', group: '品牌与内容', icon: Image, keywords: '素材 资源 图片 图标 背景', run: () => router.push('/brand/assets') })
  }
  if (enabled('onboarding-guide')) items.push({ id: 'guide', label: '重新打开新手引导', description: '回到目标、模板和品牌的启动路径', group: '品牌与内容', icon: WandSparkles, keywords: '引导 新手 开始', run: () => window.dispatchEvent(new CustomEvent('siteforge:open-onboarding')) })
  if (isAdmin.value) items.push({ id: 'admin', label: '运营总览', description: '用户、系统事件和基础设施状态', group: '运营', icon: ShieldCheck, keywords: '管理 后台 运营 总览', run: () => router.push('/admin') })
  if (hasPermission('templates.read')) items.push({ id: 'admin-templates', label: '模板运营', description: '管理模板状态、精选和排序', group: '运营', icon: LayoutTemplate, keywords: '管理 模板 发布 下架', run: () => router.push('/admin/templates') })
  if (hasPermission('feedback.read')) items.push({ id: 'quality', label: '质量反馈工作区', description: '查看并处理用户版本反馈', group: '运营', icon: MessageSquareText, keywords: '质量 反馈 问题', run: () => router.push('/admin/quality') })
  if (hasPermission('feature_flags.read')) items.push({ id: 'flags', label: '功能开关与灰度', description: '检查能力开放范围和版本', group: '运营', icon: FlaskConical, keywords: '功能 开关 灰度', run: () => router.push('/admin/feature-flags') })
  return items
})

const projectCommands = computed<CommandItem[]>(() => projects.value.slice(0, 12).map((project) => ({
  id: `project:${project.id}`,
  label: project.title,
  description: `${project.latestVersion ? `第 ${project.latestVersion.version} 版` : '暂无版本'} · ${project.status === 'archived' ? '已归档' : project.status === 'trashed' ? '回收站' : '最近更新'}`,
  group: '最近项目',
  icon: project.status === 'archived' ? Archive : FolderKanban,
  keywords: `${project.title} ${project.requirement} ${project.siteType}`,
  run: () => router.push(`/projects/${project.id}`),
})))

const results = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return [...baseCommands.value, ...projectCommands.value]
    .filter((item) => !keyword || `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(keyword))
    .slice(0, 24)
})
const groups = computed(() => {
  const order: CommandItem['group'][] = ['快速操作', '最近项目', '品牌与内容', '运营']
  return order.map((group) => ({ group, items: results.value.filter((item) => item.group === group) })).filter((entry) => entry.items.length)
})

async function loadProjects() {
  if (!isAuthenticated.value || loadingProjects.value) return
  loadingProjects.value = true
  try {
    projects.value = (await listProjects('all'))
      .filter((project) => project.status !== 'trashed')
      .sort((a, b) => Date.parse(b.openedAt || b.updatedAt) - Date.parse(a.openedAt || a.updatedAt))
  } catch { projects.value = [] }
  finally { loadingProjects.value = false }
}

async function show() {
  open.value = true
  query.value = ''
  activeIndex.value = 0
  void loadProjects()
  document.body.style.overflow = 'hidden'
  await nextTick()
  inputRef.value?.focus()
}

function close() {
  open.value = false
  document.body.style.overflow = ''
}

async function run(item: CommandItem) {
  close()
  await item.run()
}

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value ? close() : void show()
    return
  }
  if (!open.value) return
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key === 'ArrowDown') { event.preventDefault(); activeIndex.value = Math.min(results.value.length - 1, activeIndex.value + 1); return }
  if (event.key === 'ArrowUp') { event.preventDefault(); activeIndex.value = Math.max(0, activeIndex.value - 1); return }
  if (event.key === 'Enter' && !typing) {
    const item = results.value[activeIndex.value]
    if (item) { event.preventDefault(); void run(item) }
  }
}

watch(query, () => { activeIndex.value = 0 })
watch(results, () => { if (activeIndex.value >= results.value.length) activeIndex.value = Math.max(0, results.value.length - 1) })
watch(isAuthenticated, (value) => value ? void loadProjects() : (projects.value = []))
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('siteforge:open-command-palette', show as EventListener)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('siteforge:open-command-palette', show as EventListener)
  document.body.style.overflow = ''
})
</script>

<template>
  <button class="fixed right-5 bottom-5 z-40 hidden items-center gap-2 rounded-full border border-line/10 bg-soft/90 px-3.5 py-2 text-xs text-mut shadow-xl backdrop-blur transition hover:border-brand1/25 hover:text-brand1 lg:flex" title="打开命令面板" @click="show"><Command class="h-3.5 w-3.5" /><span>快速操作</span><kbd class="rounded bg-ink/5 px-1.5 py-0.5 text-[9px]">⌘K</kbd></button>
  <Teleport to="body"><Transition name="command"><div v-if="open" class="fixed inset-0 z-[200] bg-black/55 p-3 pt-[9vh] backdrop-blur-sm" @mousedown.self="close"><section role="dialog" aria-modal="true" aria-label="全局命令面板" class="mx-auto flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-app shadow-2xl"><header class="flex items-center gap-3 border-b border-line/10 px-4 py-3"><Search class="h-5 w-5 text-faint" /><input ref="inputRef" v-model="query" placeholder="搜索命令、项目或工作区…" class="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint" /><kbd class="rounded-lg border border-line/10 bg-ink/5 px-2 py-1 text-[10px] text-faint">ESC</kbd><button class="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭命令面板" @click="close"><X class="h-4 w-4" /></button></header>
      <div class="min-h-0 flex-1 overflow-y-auto p-2"><div v-if="loadingProjects && !projects.length" class="flex items-center justify-center gap-2 p-4 text-xs text-faint"><Loader2 class="h-4 w-4 animate-spin" />正在载入最近项目</div><template v-for="entry in groups" :key="entry.group"><p class="px-3 pt-3 pb-1.5 text-[9px] font-semibold tracking-wider text-faint uppercase">{{ entry.group }}</p><button v-for="item in entry.items" :key="item.id" class="flex w-full items-center gap-3 rounded-xl p-3 text-left" :class="results[activeIndex]?.id === item.id ? 'bg-brand1/[0.08] text-brand1' : 'text-sub hover:bg-ink/[0.04]'" @mouseenter="activeIndex = results.findIndex(result => result.id === item.id)" @click="run(item)"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="results[activeIndex]?.id === item.id ? 'bg-brand1/12' : 'bg-ink/5'"><component :is="item.icon" class="h-4 w-4" /></span><span class="min-w-0 flex-1"><strong class="block truncate text-sm">{{ item.label }}</strong><span class="mt-0.5 block truncate text-[10px] text-faint">{{ item.description }}</span></span><ArrowRight class="h-3.5 w-3.5 shrink-0 opacity-50" /></button></template><div v-if="!results.length" class="flex min-h-52 flex-col items-center justify-center text-center"><FileSearch class="h-8 w-8 text-faint" /><h3 class="mt-4 text-sm font-semibold">没有匹配的命令</h3><p class="mt-2 text-xs text-mut">尝试搜索“项目”“品牌”“模板”或项目名称。</p></div></div>
      <footer class="flex items-center justify-between border-t border-line/10 bg-soft/45 px-4 py-2.5 text-[9px] text-faint"><span class="flex items-center gap-1.5"><Sparkles class="h-3 w-3 text-brand1" />命令会根据账号权限和功能开关自动变化</span><span>↑↓ 选择 · Enter 执行</span></footer></section></div></Transition></Teleport>
</template>

<style scoped>
.command-enter-active,.command-leave-active{transition:opacity .16s ease}.command-enter-active section,.command-leave-active section{transition:transform .2s cubic-bezier(.22,1,.36,1),opacity .16s ease}.command-enter-from,.command-leave-to{opacity:0}.command-enter-from section,.command-leave-to section{transform:translateY(-10px) scale(.985);opacity:0}
</style>

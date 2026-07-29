<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  FilePlus2,
  Home,
  Loader2,
  Monitor,
  PencilRuler,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-vue-next'
import {
  MAX_SITE_PAGES,
  SITE_PROJECT_SCHEMA_VERSION,
  isCanonicalSitePath,
  normalizeSitePath,
  pageSlugFromTitle,
  siteProjectByteLength,
  type SitePage,
} from 'shared'
import VisualEditor from './VisualEditor.vue'
import { useToast } from '../composables/useToast'
import { addProjectVersion, type ProjectVersion } from '../lib/workspace'

const props = defineProps<{
  projectId: string
  version: ProjectVersion
  siteType: string
  brandKitId?: string
  visualEditorEnabled: boolean
}>()
const emit = defineEmits<{ (event: 'saved', versionId: string): void }>()

const toast = useToast()
const pages = ref<SitePage[]>([])
const homePageId = ref('')
const activePageId = ref('')
const previewWidth = ref<'desktop' | 'mobile'>('desktop')
const editorOpen = ref(false)
const saving = ref(false)
const dirty = ref(false)

const activePage = computed(() => pages.value.find((page) => page.id === activePageId.value) ?? pages.value[0])
const totalSize = computed(() => siteProjectByteLength({
  schemaVersion: SITE_PROJECT_SCHEMA_VERSION,
  homePageId: homePageId.value,
  pages: pages.value,
}))

function clonePages(value: SitePage[]): SitePage[] {
  return value.map((page) => ({ ...page }))
}

function resetFromVersion() {
  pages.value = clonePages(props.version.pages)
  homePageId.value = props.version.homePageId
  activePageId.value = pages.value.find((page) => page.id === homePageId.value)?.id ?? pages.value[0]?.id ?? ''
  dirty.value = false
  editorOpen.value = false
}

watch(() => props.version.id, resetFromVersion, { immediate: true })

function markDirty() {
  dirty.value = true
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function uniquePath(base: string, ignoreId?: string): string {
  const normalized = normalizeSitePath(base)
  const used = new Set(pages.value.filter((page) => page.id !== ignoreId).map((page) => page.path))
  if (!used.has(normalized) && normalized !== '/') return normalized
  const root = normalized === '/' ? '/page' : normalized
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${root}-${index}`
    if (!used.has(candidate)) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}

function navigationMarkup(items = pages.value): string {
  const links = items.map((page) => `<a href="${page.path}" style="color:inherit;text-decoration:none;font-weight:600">${escapeHtml(page.title)}</a>`).join('')
  return `<nav data-siteforge-page-navigation style="display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:18px 24px;border-bottom:1px solid color-mix(in srgb,currentColor 14%,transparent);font:14px/1.4 system-ui">${links}</nav>`
}

function blankPageHtml(title: string, navigationPages = pages.value): string {
  const safeTitle = escapeHtml(title)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>body{margin:0;background:#f8fafc;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui}main{min-height:70vh;display:grid;place-items:center;padding:64px 24px}.card{max-width:720px;border:1px solid #e2e8f0;border-radius:28px;background:#fff;padding:48px;box-shadow:0 24px 70px #0f172a12}h1{font-size:clamp(2.2rem,7vw,4.8rem);margin:0 0 18px}p{font-size:1.05rem;line-height:1.8;color:#475569}</style></head><body>${navigationMarkup(navigationPages)}<main><section class="card"><h1>${safeTitle}</h1><p>这是一个新页面。使用可视化编辑器添加内容、区块和品牌样式，然后保存为新的整站版本。</p></section></main></body></html>`
}

function addPage() {
  if (pages.value.length >= MAX_SITE_PAGES) {
    toast.error('页面数量已达上限', `当前版本最多包含 ${MAX_SITE_PAGES} 个页面。`)
    return
  }
  const number = pages.value.length + 1
  const title = `页面 ${number}`
  const page: SitePage = {
    id: crypto.randomUUID(),
    title,
    path: uniquePath(`/page-${number}`),
    html: '',
  }
  page.html = blankPageHtml(title, [...pages.value, page])
  pages.value.push(page)
  activePageId.value = page.id
  markDirty()
}

function duplicatePage() {
  const source = activePage.value
  if (!source) return
  if (pages.value.length >= MAX_SITE_PAGES) {
    toast.error('页面数量已达上限', `当前版本最多包含 ${MAX_SITE_PAGES} 个页面。`)
    return
  }
  const title = `${source.title} 副本`.slice(0, 80)
  const page: SitePage = {
    ...source,
    id: crypto.randomUUID(),
    title,
    path: uniquePath(`${source.path === '/' ? `/${pageSlugFromTitle(source.title, 'page')}` : source.path}-copy`),
  }
  pages.value.push(page)
  activePageId.value = page.id
  markDirty()
}

function normalizeActivePath() {
  const page = activePage.value
  if (!page || page.id === homePageId.value) return
  const next = uniquePath(page.path || `/${pageSlugFromTitle(page.title, 'page')}`, page.id)
  if (page.path !== next) {
    page.path = next
    markDirty()
  }
}

function setHome(page: SitePage) {
  if (page.id === homePageId.value) return
  const oldHome = pages.value.find((item) => item.id === homePageId.value)
  if (oldHome) oldHome.path = uniquePath(`/${pageSlugFromTitle(oldHome.title, 'home')}`, oldHome.id)
  page.path = '/'
  homePageId.value = page.id
  markDirty()
}

function deletePage(page: SitePage) {
  if (pages.value.length <= 1) {
    toast.error('至少保留一个页面')
    return
  }
  if (!window.confirm(`确定删除页面「${page.title}」吗？删除后需保存新版本才会生效。`)) return
  pages.value = pages.value.filter((item) => item.id !== page.id)
  if (page.id === homePageId.value) {
    const nextHome = pages.value[0]
    nextHome.path = '/'
    homePageId.value = nextHome.id
  }
  if (activePageId.value === page.id) activePageId.value = homePageId.value
  markDirty()
}

function movePage(page: SitePage, direction: -1 | 1) {
  const index = pages.value.findIndex((item) => item.id === page.id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= pages.value.length) return
  const next = [...pages.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  pages.value = next
  markDirty()
}

function saveEditedHtml(html: string) {
  const page = activePage.value
  if (!page) return
  page.html = html
  editorOpen.value = false
  markDirty()
}

function openInNewTab() {
  const page = activePage.value
  if (!page) return
  const url = URL.createObjectURL(new Blob([page.html], { type: 'text/html' }))
  window.open(url, '_blank', 'noopener')
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function syncNavigation() {
  const markup = navigationMarkup()
  pages.value = pages.value.map((page) => {
    const withoutExisting = page.html.replace(/<nav\s+data-siteforge-page-navigation[\s\S]*?<\/nav>/iu, '')
    const html = /<body[^>]*>/iu.test(withoutExisting)
      ? withoutExisting.replace(/<body([^>]*)>/iu, `<body$1>${markup}`)
      : `${markup}${withoutExisting}`
    return { ...page, html }
  })
  markDirty()
  toast.success('页面导航已同步', '已在所有页面写入同一组站内链接。')
}

function validationError(): string | null {
  if (!pages.value.length) return '项目至少需要一个页面。'
  if (!pages.value.some((page) => page.id === homePageId.value)) return '请选择有效首页。'
  const ids = new Set<string>()
  const paths = new Set<string>()
  for (const page of pages.value) {
    if (!page.title.trim()) return '所有页面都需要名称。'
    if (!isCanonicalSitePath(page.path)) return `页面「${page.title}」的路径格式不正确。`
    if (ids.has(page.id)) return '页面 ID 不能重复。'
    if (paths.has(page.path)) return `页面路径 ${page.path} 重复。`
    if (page.html.length < 20) return `页面「${page.title}」缺少有效 HTML。`
    ids.add(page.id)
    paths.add(page.path)
  }
  return null
}

async function saveSiteVersion() {
  const error = validationError()
  if (error) {
    toast.error('无法保存多页面版本', error)
    return
  }
  saving.value = true
  try {
    const created = await addProjectVersion(props.projectId, {
      pages: clonePages(pages.value),
      homePageId: homePageId.value,
      source: 'editor',
      instruction: '多页面工作区修改',
      name: `多页面版本 ${props.version.version + 1}`,
      parentVersionId: props.version.id,
    })
    dirty.value = false
    toast.success('整站版本已保存', `第 ${created.version} 版包含 ${created.pageCount} 个页面。`)
    emit('saved', created.id)
  } catch (error) {
    toast.error('保存失败', error instanceof Error ? error.message : '请稍后重试')
  } finally {
    saving.value = false
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <div class="grid min-h-[650px] lg:grid-cols-[280px_minmax(0,1fr)]">
    <aside class="border-b border-line/10 bg-app/35 p-4 lg:border-r lg:border-b-0">
      <div class="flex items-center justify-between gap-2">
        <div><h2 class="text-sm font-semibold">页面管理</h2><p class="mt-1 text-[10px] text-faint">{{ pages.length }}/{{ MAX_SITE_PAGES }} 个页面 · {{ (totalSize / 1024).toFixed(1) }}KB</p></div>
        <button class="flex items-center gap-1 rounded-lg bg-brand1/10 px-2.5 py-2 text-[10px] font-semibold text-brand1" @click="addPage"><FilePlus2 class="h-3.5 w-3.5" />新增</button>
      </div>

      <div class="mt-4 space-y-1.5">
        <button v-for="(page,index) in pages" :key="page.id" class="group w-full rounded-xl border p-3 text-left" :class="activePageId === page.id ? 'border-brand1/25 bg-brand1/[0.08]' : 'border-line/8 bg-soft/45 hover:border-line/15'" @click="activePageId = page.id">
          <div class="flex items-center gap-2"><Home v-if="page.id === homePageId" class="h-3.5 w-3.5 shrink-0 text-brand1" /><span class="min-w-0 flex-1 truncate text-xs font-semibold">{{ page.title }}</span><span class="text-[9px] text-faint">{{ index + 1 }}</span></div>
          <p class="mt-1 truncate font-mono text-[9px] text-faint">{{ page.path }}</p>
          <div v-if="activePageId === page.id" class="mt-2 flex flex-wrap gap-1" @click.stop>
            <button :disabled="index === 0" class="rounded p-1 text-faint hover:bg-ink/5 disabled:opacity-25" title="上移" @click="movePage(page,-1)"><ArrowUp class="h-3 w-3" /></button>
            <button :disabled="index === pages.length - 1" class="rounded p-1 text-faint hover:bg-ink/5 disabled:opacity-25" title="下移" @click="movePage(page,1)"><ArrowDown class="h-3 w-3" /></button>
            <button v-if="page.id !== homePageId" class="rounded px-1.5 py-1 text-[9px] text-faint hover:bg-brand1/10 hover:text-brand1" @click="setHome(page)">设为首页</button>
            <button class="rounded p-1 text-faint hover:bg-ink/5" title="复制页面" @click="duplicatePage"><Copy class="h-3 w-3" /></button>
            <button class="rounded p-1 text-red-500 hover:bg-red-500/10" title="删除页面" @click="deletePage(page)"><Trash2 class="h-3 w-3" /></button>
          </div>
        </button>
      </div>

      <button class="mt-4 w-full rounded-xl border border-line/10 bg-soft/50 px-3 py-2.5 text-[10px] font-semibold text-sub hover:border-brand1/20" @click="syncNavigation">同步所有页面导航</button>
      <p class="mt-2 text-[9px] leading-4 text-faint">保存会创建不可变的整站新版本；回滚会同时恢复所有页面。</p>
    </aside>

    <section v-if="activePage" class="min-w-0 p-4 sm:p-5">
      <div class="flex flex-wrap items-end gap-3 rounded-2xl border border-line/10 bg-app/40 p-4">
        <label class="min-w-[180px] flex-1 text-[10px] font-semibold text-sub">页面名称<input v-model="activePage.title" maxlength="80" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/70 px-3 py-2.5 text-xs outline-none focus:border-brand1/35" @input="markDirty" /></label>
        <label class="min-w-[180px] flex-1 text-[10px] font-semibold text-sub">访问路径<input v-model="activePage.path" :disabled="activePage.id === homePageId" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/70 px-3 py-2.5 font-mono text-xs outline-none focus:border-brand1/35 disabled:opacity-55" @input="markDirty" @blur="normalizeActivePath" /></label>
        <span v-if="activePage.id === homePageId" class="flex items-center gap-1 rounded-full bg-brand1/10 px-3 py-2 text-[10px] font-semibold text-brand1"><Home class="h-3 w-3" />首页固定为 /</span>
      </div>

      <div class="mt-4 overflow-hidden rounded-2xl border border-line/10 bg-soft/60">
        <header class="flex flex-wrap items-center gap-2 border-b border-line/10 bg-app/55 px-3 py-2.5">
          <div class="flex rounded-lg bg-ink/[0.04] p-1"><button class="rounded-md p-1.5" :class="previewWidth === 'desktop' ? 'bg-soft text-ink shadow' : 'text-faint'" aria-label="桌面预览" @click="previewWidth = 'desktop'"><Monitor class="h-3.5 w-3.5" /></button><button class="rounded-md p-1.5" :class="previewWidth === 'mobile' ? 'bg-soft text-ink shadow' : 'text-faint'" aria-label="手机预览" @click="previewWidth = 'mobile'"><Smartphone class="h-3.5 w-3.5" /></button></div>
          <span class="min-w-0 flex-1 truncate rounded-md bg-ink/[0.04] px-3 py-1.5 font-mono text-[10px] text-faint">{{ activePage.path }}</span>
          <button class="rounded-lg border border-line/10 px-2.5 py-2 text-[10px] text-sub" @click="openInNewTab"><ExternalLink class="mr-1 inline h-3 w-3" />新标签</button>
          <button v-if="visualEditorEnabled" class="rounded-lg border border-brand1/20 bg-brand1/[0.07] px-2.5 py-2 text-[10px] font-semibold text-brand1" @click="editorOpen = true"><PencilRuler class="mr-1 inline h-3 w-3" />编辑当前页</button>
          <button :disabled="!dirty || saving" class="bg-brand-gradient rounded-lg px-3 py-2 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45" @click="saveSiteVersion"><Loader2 v-if="saving" class="mr-1 inline h-3 w-3 animate-spin" /><Save v-else class="mr-1 inline h-3 w-3" />保存整站版本</button>
        </header>
        <div class="h-[510px] bg-ink/[0.035] p-3"><div class="mx-auto h-full overflow-hidden rounded-xl border border-line/10 bg-white shadow-xl transition-[max-width]" :style="{maxWidth: previewWidth === 'mobile' ? '390px' : '100%'}"><iframe :srcdoc="activePage.html" sandbox="allow-scripts" referrerpolicy="no-referrer" class="h-full w-full" :title="`${activePage.title} 页面预览`" /></div></div>
      </div>

      <p class="mt-3 flex items-center gap-1.5 text-[10px]" :class="dirty ? 'text-amber-600' : 'text-emerald-600'"><Check class="h-3 w-3" />{{ dirty ? '存在未保存的页面修改' : '当前页面集合与版本一致' }}</p>

      <VisualEditor v-if="visualEditorEnabled" :open="editorOpen" :html="activePage.html" :title="`${activePage.title} · 页面编辑`" :draft-key="`project:${projectId}:page:${activePage.id}`" :site-type="siteType" :brand-kit-id="brandKitId" @close="editorOpen = false" @save="saveEditedHtml" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Eye,
  Heart,
  LayoutGrid,
  Loader2,
  Monitor,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import {
  SITEFORGE_TEMPLATES,
  applyBrandKitToHtml,
  officialTemplateDefaults,
  renderOfficialTemplate,
  type BrandKit,
  type OfficialTemplateDefinition,
} from 'shared'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import { listBrandKits } from '../lib/brandKits'
import {
  listOfficialTemplates,
  listTemplateFavorites,
  setTemplateFavorite,
  useOfficialTemplate,
  type OfficialTemplateFilters,
} from '../lib/officialTemplates'
import { listProjects } from '../lib/workspace'
import { typeById } from '../data/siteTypes'

const route = useRoute()
const router = useRouter()
const { isAuthenticated } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()

const searchRef = ref<HTMLInputElement>()
const dialogRef = ref<HTMLElement>()
const templates = ref<OfficialTemplateDefinition[]>([])
const filters = ref<OfficialTemplateFilters>({ categories: [], industries: [], styles: [] })
const brandKits = ref<BrandKit[]>([])
const loading = ref(true)
const refreshing = ref(false)
const error = ref('')
const query = ref('')
const category = ref('all')
const industry = ref('all')
const style = ref('all')
const sort = ref<'featured' | 'recent' | 'favorites' | 'name' | 'type'>('featured')
const mobileFiltersOpen = ref(false)
const selected = ref<OfficialTemplateDefinition | null>(null)
const variables = ref<Record<string, string>>({})
const selectedBrandKitId = ref('')
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const colorVariant = ref<'original' | 'cool' | 'warm'>('original')
const creating = ref(false)
const favorites = ref<Set<string>>(new Set())
const recentTemplateIds = ref<string[]>([])
let lastFocused: HTMLElement | null = null

const categoryOptions = computed(() => ['all', ...filters.value.categories])
const activeFilterCount = computed(() => [category.value, industry.value, style.value].filter((value) => value !== 'all').length)
const selectedBrandKit = computed(() => brandKits.value.find((kit) => kit.id === selectedBrandKitId.value) ?? null)
const recentRank = computed(() => new Map(recentTemplateIds.value.map((id, index) => [id, index])))
const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const rows = templates.value.filter((template) => {
    const haystack = [template.name, template.description, template.industry, template.category, typeById(template.siteType)?.name ?? template.siteType, ...template.styleTags].join(' ').toLowerCase()
    return (!keyword || haystack.includes(keyword))
      && (category.value === 'all' || template.category === category.value)
      && (industry.value === 'all' || template.industry === industry.value)
      && (style.value === 'all' || template.styleTags.includes(style.value))
      && (sort.value !== 'favorites' || favorites.value.has(template.id))
  })
  return [...rows].sort((a, b) => {
    if (sort.value === 'recent') return (recentRank.value.get(a.id) ?? 9999) - (recentRank.value.get(b.id) ?? 9999)
    if (sort.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sort.value === 'type') return a.siteType.localeCompare(b.siteType)
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
})
const previewMap = computed(() => Object.fromEntries(templates.value.map((template) => [template.id, renderOfficialTemplate(template)])))
const variantTemplate = computed(() => {
  if (!selected.value || colorVariant.value === 'original') return selected.value
  const palette = colorVariant.value === 'cool'
    ? { ...selected.value.palette, primary: '#2563eb', secondary: '#7c3aed', accent: '#06b6d4', background: selected.value.dark ? '#070b16' : '#f5f8ff', surface: selected.value.dark ? '#11182a' : '#ffffff' }
    : { ...selected.value.palette, primary: '#ea580c', secondary: '#be123c', accent: '#eab308', background: selected.value.dark ? '#160b08' : '#fff8f3', surface: selected.value.dark ? '#27140e' : '#ffffff' }
  return { ...selected.value, palette }
})
const previewHtml = computed(() => {
  if (!variantTemplate.value) return ''
  const html = renderOfficialTemplate(variantTemplate.value, variables.value)
  return selectedBrandKit.value ? applyBrandKitToHtml(html, selectedBrandKit.value) : html
})
const previewWidth = computed(() => viewport.value === 'mobile' ? '390px' : viewport.value === 'tablet' ? '820px' : '1180px')
const selectedTypeName = computed(() => selected.value ? typeById(selected.value.siteType)?.name ?? selected.value.siteType : '')
const similarTemplates = computed(() => {
  if (!selected.value) return []
  return templates.value
    .filter((item) => item.id !== selected.value?.id)
    .map((item) => ({ item, score: (item.category === selected.value?.category ? 3 : 0) + (item.industry === selected.value?.industry ? 3 : 0) + item.styleTags.filter((tag) => selected.value?.styleTags.includes(tag)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.item)
})

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '操作失败，请稍后重试'
}

function localFavorites(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem('siteforge:template-favorites') ?? '[]') as unknown
    return new Set(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [])
  } catch { return new Set() }
}

async function loadCatalog(silent = false) {
  if (silent) refreshing.value = true
  else loading.value = true
  error.value = ''
  try {
    const response = await listOfficialTemplates()
    templates.value = response.templates
    filters.value = response.filters
  } catch (err) {
    templates.value = SITEFORGE_TEMPLATES
    filters.value = {
      categories: [...new Set(SITEFORGE_TEMPLATES.map((item) => item.category))],
      industries: [...new Set(SITEFORGE_TEMPLATES.map((item) => item.industry))],
      styles: [...new Set(SITEFORGE_TEMPLATES.flatMap((item) => item.styleTags))],
    }
    error.value = `模板服务暂时不可用，当前展示内置目录。${messageOf(err)}`
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

async function loadAccountData() {
  if (!isAuthenticated.value) {
    brandKits.value = []
    favorites.value = localFavorites()
    recentTemplateIds.value = []
    return
  }
  const [brands, cloudFavorites, projects] = await Promise.allSettled([listBrandKits(), listTemplateFavorites(), listProjects('all')])
  brandKits.value = brands.status === 'fulfilled' ? brands.value : []
  if (cloudFavorites.status === 'fulfilled') favorites.value = new Set(cloudFavorites.value)
  else favorites.value = localFavorites()
  if (projects.status === 'fulfilled') {
    recentTemplateIds.value = [...new Set(projects.value.filter((project) => project.templateId).sort((a, b) => Date.parse(b.openedAt || b.updatedAt) - Date.parse(a.openedAt || a.updatedAt)).map((project) => project.templateId!))]
  } else recentTemplateIds.value = []
  const defaultKit = brandKits.value.find((kit) => kit.isDefault)
  if (!selectedBrandKitId.value && defaultKit) selectedBrandKitId.value = defaultKit.id
}

async function toggleFavorite(template: OfficialTemplateDefinition) {
  const next = new Set(favorites.value)
  const value = !next.has(template.id)
  value ? next.add(template.id) : next.delete(template.id)
  favorites.value = next
  localStorage.setItem('siteforge:template-favorites', JSON.stringify([...next]))
  if (isAuthenticated.value) {
    try { await setTemplateFavorite(template.id, value) }
    catch (err) {
      value ? next.delete(template.id) : next.add(template.id)
      favorites.value = new Set(next)
      toast.error('收藏同步失败', messageOf(err))
    }
  }
}

async function openTemplate(template: OfficialTemplateDefinition) {
  lastFocused = document.activeElement as HTMLElement | null
  selected.value = template
  variables.value = officialTemplateDefaults(template)
  viewport.value = 'desktop'
  colorVariant.value = 'original'
  mobileFiltersOpen.value = false
  document.body.style.overflow = 'hidden'
  await router.replace({ query: { ...route.query, template: template.slug } })
  await nextTick()
  dialogRef.value?.focus()
}

async function closeTemplate() {
  if (!selected.value) return
  selected.value = null
  document.body.style.overflow = ''
  const nextQuery = { ...route.query }
  delete nextQuery.template
  await router.replace({ query: nextQuery })
  await nextTick()
  lastFocused?.focus()
}

function resetFilters() {
  query.value = ''
  category.value = 'all'
  industry.value = 'all'
  style.value = 'all'
  sort.value = 'featured'
  mobileFiltersOpen.value = false
  searchRef.value?.focus()
}

async function createFromSelected() {
  if (!selected.value) return
  if (!isAuthenticated.value) {
    showAuth()
    toast.info('登录后创建项目', '登录后可保存模板、品牌套件和后续版本。')
    return
  }
  creating.value = true
  try {
    const project = await useOfficialTemplate(selected.value.id, { title: variables.value.brandName || selected.value.name, brandKitId: selectedBrandKitId.value || undefined, variables: variables.value })
    toast.success('项目已创建', `「${project.title}」已保存到你的工作区。`)
    await router.push({ name: 'project-detail', params: { id: project.id } })
  } catch (err) { toast.error('创建失败', messageOf(err)) }
  finally { creating.value = false }
}

function focusableElements(): HTMLElement[] {
  if (!dialogRef.value) return []
  return [...dialogRef.value.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('hidden'))
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  if (!selected.value && event.key === '/' && !typing) { event.preventDefault(); searchRef.value?.focus(); return }
  if (!selected.value) return
  if (event.key === 'Escape') { event.preventDefault(); void closeTemplate(); return }
  if (event.key === 'Tab') {
    const focusables = focusableElements()
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables.at(-1)!
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
}

watch(isAuthenticated, () => void loadAccountData())
watch(() => route.query.template, (value) => {
  if (typeof value !== 'string' || selected.value?.slug === value || !templates.value.length) return
  const template = templates.value.find((item) => item.slug === value)
  if (template) void openTemplate(template)
})

onMounted(async () => {
  favorites.value = localFavorites()
  window.addEventListener('keydown', onKeydown)
  await Promise.all([loadCatalog(), loadAccountData()])
  const slug = typeof route.query.template === 'string' ? route.query.template : ''
  const template = templates.value.find((item) => item.slug === slug)
  if (template) await openTemplate(template)
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); document.body.style.overflow = '' })
</script>

<template>
  <main class="min-h-screen pt-16 pb-24">
    <section class="relative overflow-hidden border-b border-line/8 bg-soft/35"><div class="pointer-events-none absolute -top-40 left-[12%] h-96 w-96 rounded-full bg-brand1/14 blur-3xl" /><div class="pointer-events-none absolute -right-32 -bottom-56 h-[430px] w-[430px] rounded-full bg-brand2/10 blur-3xl" /><div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8"><div class="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_360px]"><div class="max-w-3xl"><span class="inline-flex items-center gap-2 rounded-full border border-brand1/18 bg-brand1/[0.07] px-3 py-1.5 text-[11px] font-semibold text-brand1"><Sparkles class="h-3.5 w-3.5" />官方精选模板 2.0</span><h1 class="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">从经过打磨的起点开始，<span class="text-brand-gradient">更快做出好网站</span></h1><p class="mt-5 max-w-2xl text-sm leading-7 text-mut sm:text-base">24 套响应式模板覆盖商业、内容、专业服务与活动场景。可切换配色变体、应用品牌套件并从相似模板继续探索。</p></div><div class="grid grid-cols-3 gap-3"><div class="rounded-2xl border border-line/10 bg-app/55 p-4"><p class="text-[10px] text-faint">官方模板</p><p class="mt-2 text-2xl font-bold">{{ templates.length }}</p></div><div class="rounded-2xl border border-line/10 bg-app/55 p-4"><p class="text-[10px] text-faint">最近使用</p><p class="mt-2 text-2xl font-bold">{{ recentTemplateIds.length }}</p></div><div class="rounded-2xl border border-line/10 bg-app/55 p-4"><p class="text-[10px] text-faint">我的收藏</p><p class="mt-2 text-2xl font-bold">{{ favorites.size }}</p></div></div></div></div></section>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="sticky top-16 z-20 mt-6 rounded-2xl border border-line/10 bg-app/85 p-3 shadow-lg backdrop-blur-xl"><div class="flex flex-col gap-3 lg:flex-row lg:items-center"><label class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line/10 bg-soft/65 px-3.5 py-2.5 focus-within:border-brand1/35"><Search class="h-4 w-4 text-faint" /><input ref="searchRef" v-model="query" placeholder="搜索模板、行业、风格或目标" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" /><kbd class="hidden rounded bg-ink/5 px-1.5 py-0.5 text-[9px] text-faint sm:block">/</kbd></label><button class="flex items-center justify-center gap-2 rounded-xl border border-line/10 px-3 py-2.5 text-xs text-sub lg:hidden" @click="mobileFiltersOpen = !mobileFiltersOpen"><SlidersHorizontal class="h-3.5 w-3.5" />筛选<span v-if="activeFilterCount" class="rounded-full bg-brand1 px-1.5 text-[9px] text-white">{{ activeFilterCount }}</span></button><div class="gap-2" :class="mobileFiltersOpen ? 'grid grid-cols-2' : 'hidden lg:flex'"><label class="relative"><select v-model="category" aria-label="模板分类" class="w-full appearance-none rounded-xl border border-line/10 bg-soft/65 py-2.5 pr-8 pl-3 text-xs outline-none"><option v-for="item in categoryOptions" :key="item" :value="item">{{ item === 'all' ? '全部分类' : item }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label><label class="relative"><select v-model="industry" aria-label="模板行业" class="w-full appearance-none rounded-xl border border-line/10 bg-soft/65 py-2.5 pr-8 pl-3 text-xs outline-none"><option value="all">全部行业</option><option v-for="item in filters.industries" :key="item">{{ item }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label><label class="relative"><select v-model="style" aria-label="模板风格" class="w-full appearance-none rounded-xl border border-line/10 bg-soft/65 py-2.5 pr-8 pl-3 text-xs outline-none"><option value="all">全部风格</option><option v-for="item in filters.styles" :key="item">{{ item }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label><label class="relative"><select v-model="sort" aria-label="模板排序" class="w-full appearance-none rounded-xl border border-line/10 bg-soft/65 py-2.5 pr-8 pl-3 text-xs outline-none"><option value="featured">精选优先</option><option value="recent">最近使用</option><option value="favorites">只看收藏</option><option value="name">按名称</option><option value="type">按类型</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label></div><button :disabled="refreshing" aria-label="刷新模板目录" class="hidden rounded-xl border border-line/10 p-2.5 text-faint hover:text-ink lg:block" @click="loadCatalog(true)"><RefreshCw class="h-4 w-4" :class="refreshing && 'animate-spin'" /></button></div></div>

      <div v-if="error" class="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-600">{{ error }}</div>
      <div v-if="loading" class="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"><div v-for="item in 9" :key="item" class="h-80 animate-pulse rounded-3xl bg-ink/[0.04]" /></div>
      <section v-else-if="!visible.length" class="mt-8 rounded-3xl border border-dashed border-line/15 p-16 text-center"><LayoutGrid class="mx-auto h-9 w-9 text-faint" /><h2 class="mt-4 text-lg font-semibold">没有匹配的模板</h2><p class="mt-2 text-sm text-mut">调整筛选条件，或恢复查看全部模板。</p><button class="mt-4 text-sm font-semibold text-brand1" @click="resetFilters">重置筛选</button></section>

      <div v-else class="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article v-for="template in visible" :key="template.id" class="group overflow-hidden rounded-3xl border border-line/10 bg-soft/60 shadow-lg shadow-black/[0.035] transition hover:-translate-y-0.5 hover:border-brand1/25 hover:shadow-xl"><div class="relative h-52 overflow-hidden border-b border-line/8 bg-white"><iframe :srcdoc="previewMap[template.id]" sandbox="" loading="lazy" class="pointer-events-none h-[780px] w-[1440px] origin-top-left scale-[.29]" :title="`${template.name} 缩略图`" /><div class="absolute inset-0 bg-gradient-to-t from-black/15 to-transparent opacity-0 transition group-hover:opacity-100" /><button class="absolute inset-0" :aria-label="`预览 ${template.name}`" @click="openTemplate(template)" /><button class="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur" :aria-label="favorites.has(template.id) ? '取消收藏' : '收藏模板'" @click.stop="toggleFavorite(template)"><Heart class="h-4 w-4" :fill="favorites.has(template.id) ? 'currentColor' : 'none'" /></button><span v-if="recentTemplateIds.includes(template.id)" class="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-sky-500/90 px-2.5 py-1 text-[9px] font-semibold text-white"><Clock3 class="h-3 w-3" />最近使用</span></div><div class="p-5"><div class="flex items-start justify-between gap-3"><div><div class="flex flex-wrap gap-1.5"><span class="rounded bg-brand1/10 px-2 py-0.5 text-[9px] font-semibold text-sub">{{ typeById(template.siteType)?.name || template.siteType }}</span><span v-if="template.featured" class="rounded bg-violet-500/10 px-2 py-0.5 text-[9px] font-semibold text-sub">精选</span></div><h2 class="mt-3 text-lg font-semibold">{{ template.name }}</h2></div><span class="text-[10px] text-faint">{{ template.industry }}</span></div><p class="mt-2 line-clamp-2 text-xs leading-5 text-mut">{{ template.description }}</p><div class="mt-4 flex flex-wrap gap-1.5"><span v-for="tag in template.styleTags" :key="tag" class="rounded-full border border-line/10 px-2 py-1 text-[9px] text-faint">{{ tag }}</span></div><div class="mt-5 grid grid-cols-2 gap-2"><button class="flex items-center justify-center gap-1.5 rounded-xl border border-line/10 bg-app/45 px-3 py-2.5 text-xs font-semibold text-sub hover:border-brand1/25 hover:text-brand1" @click="openTemplate(template)"><Eye class="h-3.5 w-3.5" />快速预览</button><RouterLink :to="`/templates/${template.slug}`" class="flex items-center justify-center gap-1.5 rounded-xl bg-brand1/10 px-3 py-2.5 text-xs font-semibold text-sub hover:bg-brand1/15 hover:text-ink">完整详情<ArrowRight class="h-3.5 w-3.5" /></RouterLink></div></div></article>
      </div>
    </div>

    <Teleport to="body"><Transition name="modal"><div v-if="selected" class="fixed inset-0 z-[150] bg-black/55 p-2 backdrop-blur-sm sm:p-5"><section ref="dialogRef" role="dialog" aria-modal="true" tabindex="-1" class="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-app shadow-2xl"><header class="flex items-center gap-3 border-b border-line/10 px-4 py-3 sm:px-5"><button class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭模板预览" @click="closeTemplate"><X class="h-5 w-5" /></button><div class="min-w-0"><h2 class="truncate text-sm font-semibold">{{ selected.name }}</h2><p class="text-[10px] text-faint">{{ selectedTypeName }} · {{ selected.industry }}</p></div><div class="ml-auto hidden rounded-xl bg-ink/[0.04] p-1 sm:flex"><button v-for="item in [{id:'desktop',label:'桌面',icon:Monitor},{id:'tablet',label:'平板',icon:Tablet},{id:'mobile',label:'手机',icon:Smartphone}]" :key="item.id" class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px]" :class="viewport === item.id ? 'bg-soft font-semibold text-brand1 shadow' : 'text-faint'" @click="viewport = item.id as typeof viewport"><component :is="item.icon" class="h-3.5 w-3.5" />{{ item.label }}</button></div><button class="rounded-xl border border-line/10 p-2.5" :class="favorites.has(selected.id) ? 'text-red-500' : 'text-faint'" @click="toggleFavorite(selected)"><Heart class="h-4 w-4" :fill="favorites.has(selected.id) ? 'currentColor' : 'none'" /></button></header>
      <div class="flex min-h-0 flex-1"><aside class="hidden w-[360px] shrink-0 overflow-y-auto border-r border-line/10 bg-soft/55 p-5 lg:block"><div><h3 class="text-xs font-semibold">快速定制</h3><p class="mt-1 text-[10px] text-faint">修改内容和配色后，预览会立即更新。</p></div><div class="mt-4 grid grid-cols-3 gap-2"><button v-for="variant in [{id:'original',label:'原始'},{id:'cool',label:'冷色'},{id:'warm',label:'暖色'}]" :key="variant.id" class="rounded-xl border px-2 py-2.5 text-[10px]" :class="colorVariant === variant.id ? 'border-brand1/30 bg-brand1/10 font-semibold text-brand1' : 'border-line/10 text-faint'" @click="colorVariant = variant.id as typeof colorVariant">{{ variant.label }}</button></div><label v-if="brandKits.length" class="mt-4 block text-[10px] font-semibold text-sub">品牌套件<select v-model="selectedBrandKitId" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs outline-none"><option value="">不应用品牌</option><option v-for="kit in brandKits" :key="kit.id" :value="kit.id">{{ kit.name }}{{ kit.isDefault ? ' · 默认' : '' }}</option></select></label><div class="mt-5 grid gap-4"><label v-for="variable in selected.variables" :key="variable.key" class="text-[10px] font-semibold text-sub">{{ variable.label }}<textarea v-if="variable.type === 'textarea'" v-model="variables[variable.key]" :maxlength="variable.maxLength" rows="4" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 text-xs leading-5 outline-none" /><input v-else v-model="variables[variable.key]" :maxlength="variable.maxLength" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs outline-none" /></label></div><button :disabled="creating" class="bg-brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" @click="createFromSelected"><Loader2 v-if="creating" class="h-4 w-4 animate-spin" /><WandSparkles v-else class="h-4 w-4" />{{ creating ? '正在创建项目' : '使用此模板创建项目' }}</button><div class="mt-6 border-t border-line/10 pt-5"><div class="flex items-center justify-between"><h3 class="text-xs font-semibold">相似模板</h3><span class="text-[9px] text-faint">根据场景与风格</span></div><div class="mt-3 grid gap-2"><button v-for="item in similarTemplates" :key="item.id" class="rounded-xl border border-line/10 bg-app/45 p-3 text-left hover:border-brand1/25" @click="openTemplate(item)"><strong class="text-xs">{{ item.name }}</strong><span class="mt-1 block text-[9px] text-faint">{{ item.industry }} · {{ item.styleTags.slice(0,2).join('、') }}</span></button></div></div></aside><main class="min-w-0 flex-1 overflow-auto bg-ink/[0.04] p-3 sm:p-5"><div class="mx-auto h-full min-h-[680px] overflow-hidden rounded-xl border border-line/12 bg-white shadow-2xl transition-all" :style="{ maxWidth: previewWidth }"><iframe :srcdoc="previewHtml" sandbox="allow-scripts" class="h-full min-h-[680px] w-full" title="模板实时预览" /></div></main></div><footer class="flex items-center justify-between border-t border-line/10 bg-soft/70 px-4 py-3 lg:hidden"><div class="text-[10px] text-faint">{{ selected.variables.length }} 个可编辑字段 · {{ colorVariant === 'original' ? '原始配色' : colorVariant === 'cool' ? '冷色变体' : '暖色变体' }}</div><button class="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white" @click="createFromSelected"><ArrowRight class="h-3.5 w-3.5" />创建项目</button></footer></section></div></Transition></Teleport>
  </main>
</template>

<style scoped>
.modal-enter-active,.modal-leave-active{transition:opacity .18s ease}.modal-enter-from,.modal-leave-to{opacity:0}
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Command,
  Eye,
  Heart,
  LayoutGrid,
  Loader2,
  Monitor,
  Palette,
  Search,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tablet,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import {
  OFFICIAL_TEMPLATES,
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
  useOfficialTemplate,
  type OfficialTemplateFilters,
} from '../lib/officialTemplates'
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
const error = ref('')
const query = ref('')
const category = ref('all')
const industry = ref('all')
const style = ref('all')
const sort = ref<'featured' | 'name' | 'type'>('featured')
const mobileFiltersOpen = ref(false)
const selected = ref<OfficialTemplateDefinition | null>(null)
const variables = ref<Record<string, string>>({})
const selectedBrandKitId = ref('')
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const creating = ref(false)
const favorites = ref<Set<string>>(new Set())
let lastFocused: HTMLElement | null = null

const categoryOptions = computed(() => ['all', ...filters.value.categories])
const filtered = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase()
  const rows = templates.value.filter((template) => {
    const haystack = [
      template.name,
      template.description,
      template.industry,
      template.category,
      typeById(template.siteType)?.name ?? template.siteType,
      ...template.styleTags,
    ].join(' ').toLowerCase()
    return (
      (!normalizedQuery || haystack.includes(normalizedQuery)) &&
      (category.value === 'all' || template.category === category.value) &&
      (industry.value === 'all' || template.industry === industry.value) &&
      (style.value === 'all' || template.styleTags.includes(style.value))
    )
  })
  return [...rows].sort((a, b) => {
    if (sort.value === 'name') return a.name.localeCompare(b.name, 'zh-CN')
    if (sort.value === 'type') return a.siteType.localeCompare(b.siteType)
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.name.localeCompare(b.name, 'zh-CN')
  })
})
const activeFilterCount = computed(() =>
  [category.value, industry.value, style.value].filter((value) => value !== 'all').length,
)
const previewMap = computed(() =>
  Object.fromEntries(templates.value.map((template) => [template.id, renderOfficialTemplate(template)])),
)
const selectedBrandKit = computed(() =>
  brandKits.value.find((kit) => kit.id === selectedBrandKitId.value) ?? null,
)
const previewHtml = computed(() => {
  if (!selected.value) return ''
  const html = renderOfficialTemplate(selected.value, variables.value)
  return selectedBrandKit.value ? applyBrandKitToHtml(html, selectedBrandKit.value) : html
})
const previewWidth = computed(() => {
  if (viewport.value === 'mobile') return '390px'
  if (viewport.value === 'tablet') return '820px'
  return '1180px'
})
const selectedTypeName = computed(() =>
  selected.value ? typeById(selected.value.siteType)?.name ?? selected.value.siteType : '',
)

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '操作失败，请稍后重试'
}

async function loadCatalog() {
  loading.value = true
  error.value = ''
  try {
    const response = await listOfficialTemplates()
    templates.value = response.templates
    filters.value = response.filters
  } catch (err) {
    // 保持目录可浏览，创建项目仍会通过服务端再次校验模板。
    templates.value = OFFICIAL_TEMPLATES
    filters.value = {
      categories: [...new Set(OFFICIAL_TEMPLATES.map((item) => item.category))],
      industries: [...new Set(OFFICIAL_TEMPLATES.map((item) => item.industry))],
      styles: [...new Set(OFFICIAL_TEMPLATES.flatMap((item) => item.styleTags))],
    }
    error.value = `模板服务暂时不可用，当前展示内置目录。${messageOf(err)}`
  } finally {
    loading.value = false
  }
}

async function loadBrands() {
  if (!isAuthenticated.value) {
    brandKits.value = []
    selectedBrandKitId.value = ''
    return
  }
  try {
    brandKits.value = await listBrandKits()
    const defaultKit = brandKits.value.find((kit) => kit.isDefault)
    if (!selectedBrandKitId.value && defaultKit) selectedBrandKitId.value = defaultKit.id
  } catch {
    brandKits.value = []
  }
}

function persistFavorites() {
  localStorage.setItem('siteforge:template-favorites', JSON.stringify([...favorites.value]))
}

function toggleFavorite(template: OfficialTemplateDefinition) {
  const next = new Set(favorites.value)
  if (next.has(template.id)) next.delete(template.id)
  else next.add(template.id)
  favorites.value = next
  persistFavorites()
}

async function openTemplate(template: OfficialTemplateDefinition) {
  lastFocused = document.activeElement as HTMLElement | null
  selected.value = template
  variables.value = officialTemplateDefaults(template)
  viewport.value = 'desktop'
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
    const project = await useOfficialTemplate(selected.value.id, {
      title: variables.value.brandName || selected.value.name,
      brandKitId: selectedBrandKitId.value || undefined,
      variables: variables.value,
    })
    toast.success('项目已创建', `「${project.title}」已保存到你的工作区。`)
    await router.push({ name: 'project-detail', params: { id: project.id } })
  } catch (err) {
    toast.error('创建失败', messageOf(err))
  } finally {
    creating.value = false
  }
}

function focusableElements(): HTMLElement[] {
  if (!dialogRef.value) return []
  return [...dialogRef.value.querySelectorAll<HTMLElement>(
    'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute('hidden'))
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  if (!selected.value && event.key === '/' && !isTyping) {
    event.preventDefault()
    searchRef.value?.focus()
    return
  }
  if (!selected.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    void closeTemplate()
    return
  }
  if (event.key === 'Tab') {
    const focusables = focusableElements()
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

watch(isAuthenticated, () => void loadBrands())
watch(
  () => route.query.template,
  (value) => {
    if (typeof value !== 'string' || selected.value?.slug === value || !templates.value.length) return
    const template = templates.value.find((item) => item.slug === value)
    if (template) void openTemplate(template)
  },
)

onMounted(async () => {
  try {
    const stored = JSON.parse(localStorage.getItem('siteforge:template-favorites') ?? '[]') as unknown
    if (Array.isArray(stored)) favorites.value = new Set(stored.filter((item): item is string => typeof item === 'string'))
  } catch {
    favorites.value = new Set()
  }
  window.addEventListener('keydown', onKeydown)
  await Promise.all([loadCatalog(), loadBrands()])
  const slug = typeof route.query.template === 'string' ? route.query.template : ''
  const template = templates.value.find((item) => item.slug === slug)
  if (template) await openTemplate(template)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <main class="min-h-screen pt-16 pb-24">
    <section class="relative overflow-hidden border-b border-line/8 bg-soft/35">
      <div class="pointer-events-none absolute -top-40 left-[12%] h-96 w-96 rounded-full bg-brand1/14 blur-3xl" />
      <div class="pointer-events-none absolute -right-32 -bottom-56 h-[430px] w-[430px] rounded-full bg-brand2/10 blur-3xl" />
      <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div class="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div class="max-w-3xl">
            <span class="inline-flex items-center gap-2 rounded-full border border-brand1/18 bg-brand1/[0.07] px-3 py-1.5 text-[11px] font-semibold text-brand1">
              <Sparkles class="h-3.5 w-3.5" />官方精选模板
            </span>
            <h1 class="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              从经过打磨的起点开始，<span class="text-brand-gradient">更快做出好网站</span>
            </h1>
            <p class="mt-5 max-w-2xl text-sm leading-7 text-mut sm:text-base">
              每套模板都包含完整响应式布局、清晰内容结构和可编辑变量。预览满意后，可直接应用品牌套件并创建云端项目。
            </p>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="rounded-2xl border border-line/10 bg-app/55 p-4 backdrop-blur">
              <p class="text-[10px] tracking-wider text-faint uppercase">官方模板</p>
              <p class="mt-2 text-2xl font-bold text-ink">{{ templates.length }}</p>
            </div>
            <div class="rounded-2xl border border-line/10 bg-app/55 p-4 backdrop-blur">
              <p class="text-[10px] tracking-wider text-faint uppercase">场景分类</p>
              <p class="mt-2 text-2xl font-bold text-ink">{{ filters.categories.length }}</p>
            </div>
            <div class="rounded-2xl border border-line/10 bg-app/55 p-4 backdrop-blur">
              <p class="text-[10px] tracking-wider text-faint uppercase">我的收藏</p>
              <p class="mt-2 text-2xl font-bold text-ink">{{ favorites.size }}</p>
            </div>
          </div>
        </div>

        <div class="mt-10 flex flex-col gap-3 sm:flex-row">
          <label class="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-line/12 bg-app/75 px-4 py-3 shadow-sm transition focus-within:border-brand1/40 focus-within:ring-4 focus-within:ring-brand1/8">
            <Search class="h-4.5 w-4.5 shrink-0 text-faint group-focus-within:text-brand1" />
            <input
              ref="searchRef"
              v-model="query"
              type="search"
              placeholder="搜索模板、行业或风格"
              class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint"
            />
            <span class="hidden items-center gap-1 rounded-md border border-line/10 bg-ink/[0.04] px-2 py-1 text-[10px] text-faint sm:flex">
              <Command class="h-3 w-3" /> /
            </span>
          </label>
          <button
            class="flex items-center justify-center gap-2 rounded-2xl border border-line/12 bg-app/75 px-4 py-3 text-sm font-medium text-sub transition hover:border-brand1/25 hover:text-brand1 lg:hidden"
            :aria-expanded="mobileFiltersOpen"
            @click="mobileFiltersOpen = !mobileFiltersOpen"
          >
            <SlidersHorizontal class="h-4 w-4" />筛选
            <span v-if="activeFilterCount" class="rounded-full bg-brand1 px-1.5 py-0.5 text-[10px] text-white">{{ activeFilterCount }}</span>
          </button>
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="sticky top-16 z-20 -mx-4 border-b border-line/8 bg-app/90 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div class="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            v-for="item in categoryOptions"
            :key="item"
            class="shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/50"
            :class="category === item ? 'bg-brand-gradient text-white shadow-lg shadow-brand1/20' : 'border border-line/10 bg-soft/55 text-mut hover:border-brand1/25 hover:text-ink'"
            @click="category = item"
          >
            {{ item === 'all' ? '全部模板' : item }}
          </button>
          <span class="mx-1 hidden h-6 w-px shrink-0 bg-line/10 lg:block" />
          <div class="ml-auto hidden items-center gap-2 lg:flex">
            <label class="relative">
              <span class="sr-only">行业筛选</span>
              <select v-model="industry" class="appearance-none rounded-xl border border-line/10 bg-soft/55 py-2 pr-8 pl-3 text-xs text-sub outline-none focus:border-brand1/35">
                <option value="all">全部行业</option>
                <option v-for="item in filters.industries" :key="item" :value="item">{{ item }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            </label>
            <label class="relative">
              <span class="sr-only">风格筛选</span>
              <select v-model="style" class="appearance-none rounded-xl border border-line/10 bg-soft/55 py-2 pr-8 pl-3 text-xs text-sub outline-none focus:border-brand1/35">
                <option value="all">全部风格</option>
                <option v-for="item in filters.styles" :key="item" :value="item">{{ item }}</option>
              </select>
              <ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            </label>
            <label class="relative">
              <span class="sr-only">排序方式</span>
              <select v-model="sort" class="appearance-none rounded-xl border border-line/10 bg-soft/55 py-2 pr-8 pl-3 text-xs text-sub outline-none focus:border-brand1/35">
                <option value="featured">精选优先</option>
                <option value="name">名称排序</option>
                <option value="type">类型排序</option>
              </select>
              <ChevronDown class="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            </label>
          </div>
        </div>

        <div v-if="mobileFiltersOpen" class="mt-3 grid gap-3 rounded-2xl border border-line/10 bg-soft/85 p-4 lg:hidden">
          <label class="grid gap-1.5 text-xs text-mut">
            行业
            <select v-model="industry" class="rounded-xl border border-line/10 bg-app px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/35">
              <option value="all">全部行业</option>
              <option v-for="item in filters.industries" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label class="grid gap-1.5 text-xs text-mut">
            风格
            <select v-model="style" class="rounded-xl border border-line/10 bg-app px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/35">
              <option value="all">全部风格</option>
              <option v-for="item in filters.styles" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <button v-if="activeFilterCount" class="justify-self-start text-xs font-medium text-brand1" @click="resetFilters">清除全部筛选</button>
        </div>
      </div>

      <div class="mt-7 flex items-center justify-between gap-4">
        <div>
          <h2 class="flex items-center gap-2 text-lg font-semibold text-ink">
            <LayoutGrid class="h-4.5 w-4.5 text-brand1" />模板目录
          </h2>
          <p class="mt-1 text-xs text-faint">找到 {{ filtered.length }} 套符合条件的模板</p>
        </div>
        <button v-if="query || activeFilterCount" class="text-xs font-medium text-brand1 hover:underline" @click="resetFilters">重置筛选</button>
      </div>

      <div v-if="error" class="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-600 dark:text-amber-300">
        {{ error }}
      </div>

      <div v-if="loading" class="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="index in 6" :key="index" class="overflow-hidden rounded-2xl border border-line/8 bg-soft/50">
          <div class="aspect-[16/11] animate-pulse bg-ink/[0.05]" />
          <div class="space-y-3 p-4"><div class="h-4 w-2/3 animate-pulse rounded bg-ink/[0.07]" /><div class="h-3 w-full animate-pulse rounded bg-ink/[0.05]" /></div>
        </div>
      </div>

      <div v-else-if="filtered.length" class="stagger mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="template in filtered"
          :key="template.id"
          class="group overflow-hidden rounded-2xl border border-line/10 bg-soft/60 transition-all duration-300 hover:-translate-y-1 hover:border-brand1/28 hover:shadow-2xl hover:shadow-brand1/8"
        >
          <div class="relative aspect-[16/11] overflow-hidden bg-white">
            <iframe
              :srcdoc="previewMap[template.id]"
              sandbox=""
              loading="lazy"
              tabindex="-1"
              aria-hidden="true"
              class="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50 border-0"
              title=""
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/28 via-transparent to-transparent opacity-55" />
            <div class="absolute top-3 left-3 flex flex-wrap gap-1.5">
              <span v-if="template.featured" class="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold text-zinc-900 shadow-sm backdrop-blur">
                <Sparkles class="h-3 w-3 text-violet-600" />官方精选
              </span>
              <span class="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur">{{ template.dark ? '深色' : '浅色' }}</span>
            </div>
            <button
              class="absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-zinc-600 opacity-0 shadow-lg backdrop-blur transition-all hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"
              :class="favorites.has(template.id) && '!opacity-100 text-rose-500'"
              :aria-label="favorites.has(template.id) ? `取消收藏 ${template.name}` : `收藏 ${template.name}`"
              @click="toggleFavorite(template)"
            >
              <Heart class="h-4 w-4" :fill="favorites.has(template.id) ? 'currentColor' : 'none'" />
            </button>
            <div class="absolute inset-x-3 bottom-3 flex translate-y-2 gap-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/94 px-3 py-2.5 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur hover:bg-white" @click="openTemplate(template)">
                <Eye class="h-3.5 w-3.5" />预览
              </button>
              <button class="bg-brand-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white shadow-lg" @click="openTemplate(template)">
                使用模板<ArrowRight class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div class="p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-semibold text-ink">{{ template.name }}</h3>
                <p class="mt-1 text-[11px] text-faint">{{ typeById(template.siteType)?.name || template.siteType }} · {{ template.industry }}</p>
              </div>
              <div class="flex shrink-0 gap-1">
                <span v-for="color in [template.palette.primary, template.palette.secondary, template.palette.accent]" :key="color" class="h-4 w-4 rounded-full border border-black/5" :style="{ backgroundColor: color }" />
              </div>
            </div>
            <p class="mt-3 line-clamp-2 text-xs leading-5 text-mut">{{ template.description }}</p>
            <div class="mt-4 flex flex-wrap gap-1.5">
              <span v-for="tag in template.styleTags" :key="tag" class="rounded-md border border-line/8 bg-ink/[0.035] px-2 py-1 text-[10px] text-faint">{{ tag }}</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="mt-10 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-line/15 bg-soft/35 px-6 text-center">
        <Search class="h-8 w-8 text-faint" />
        <h3 class="mt-4 text-base font-semibold text-ink">没有找到匹配模板</h3>
        <p class="mt-2 max-w-md text-sm leading-6 text-mut">尝试减少筛选条件，或者使用更宽泛的行业和风格关键词。</p>
        <button class="mt-5 rounded-xl border border-brand1/20 bg-brand1/[0.07] px-4 py-2.5 text-sm font-semibold text-brand1" @click="resetFilters">查看全部模板</button>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="template-dialog">
        <div v-if="selected" class="fixed inset-0 z-[110] bg-black/65 p-0 backdrop-blur-sm sm:p-3 lg:p-5" @mousedown.self="closeTemplate">
          <section
            ref="dialogRef"
            role="dialog"
            aria-modal="true"
            :aria-label="`预览模板 ${selected.name}`"
            tabindex="-1"
            class="mx-auto flex h-full max-w-[1700px] flex-col overflow-hidden bg-app text-ink outline-none sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl"
          >
            <header class="flex min-h-16 items-center gap-3 border-b border-line/10 bg-soft/92 px-3 py-2 backdrop-blur sm:px-5">
              <button class="rounded-xl p-2 text-faint transition hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand1/50" aria-label="关闭模板预览" @click="closeTemplate">
                <X class="h-5 w-5" />
              </button>
              <div class="min-w-0">
                <h2 class="truncate text-sm font-semibold text-ink">{{ selected.name }}</h2>
                <p class="truncate text-[11px] text-faint">{{ selectedTypeName }} · {{ selected.industry }}</p>
              </div>
              <div class="ml-auto hidden items-center gap-1 rounded-xl bg-ink/[0.045] p-1 sm:flex" role="group" aria-label="预览设备">
                <button
                  v-for="device in [
                    { id: 'desktop', label: '桌面', icon: Monitor },
                    { id: 'tablet', label: '平板', icon: Tablet },
                    { id: 'mobile', label: '手机', icon: Smartphone },
                  ]"
                  :key="device.id"
                  class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition focus-visible:ring-2 focus-visible:ring-brand1/45"
                  :class="viewport === device.id ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-faint hover:text-ink'"
                  :aria-pressed="viewport === device.id"
                  @click="viewport = device.id as typeof viewport"
                >
                  <component :is="device.icon" class="h-3.5 w-3.5" /><span class="hidden lg:inline">{{ device.label }}</span>
                </button>
              </div>
              <button
                :disabled="creating"
                class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand1/20 disabled:cursor-wait disabled:opacity-60 sm:text-sm"
                @click="createFromSelected"
              >
                <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
                <WandSparkles v-else class="h-4 w-4" />
                <span class="hidden sm:inline">{{ isAuthenticated ? '创建项目' : '登录并使用' }}</span>
                <span class="sm:hidden">使用</span>
              </button>
            </header>

            <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div class="relative min-h-[48vh] flex-1 overflow-auto bg-ink/[0.045] p-3 sm:p-5 lg:min-h-0 lg:p-7">
                <div class="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px] text-line/20" />
                <div class="relative mx-auto h-full min-h-[540px] overflow-hidden rounded-xl border border-line/14 bg-white shadow-2xl shadow-black/20 transition-[max-width] duration-300" :style="{ maxWidth: previewWidth }">
                  <iframe :srcdoc="previewHtml" sandbox="" referrerpolicy="no-referrer" class="h-full min-h-[540px] w-full border-0" :title="`${selected.name} 实时预览`" />
                </div>
              </div>

              <aside class="w-full shrink-0 overflow-y-auto border-t border-line/10 bg-soft/65 lg:w-[390px] lg:border-t-0 lg:border-l">
                <div class="space-y-7 p-5 sm:p-6">
                  <section>
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-[10px] font-semibold tracking-wider text-brand1 uppercase">模板说明</p>
                        <h3 class="mt-1 text-lg font-semibold text-ink">{{ selected.name }}</h3>
                      </div>
                      <button class="grid h-10 w-10 place-items-center rounded-full border border-line/10 text-faint hover:text-rose-500" :aria-label="favorites.has(selected.id) ? '取消收藏' : '收藏模板'" @click="toggleFavorite(selected)">
                        <Heart class="h-4.5 w-4.5" :fill="favorites.has(selected.id) ? 'currentColor' : 'none'" :class="favorites.has(selected.id) && 'text-rose-500'" />
                      </button>
                    </div>
                    <p class="mt-3 text-sm leading-6 text-mut">{{ selected.description }}</p>
                    <div class="mt-4 flex flex-wrap gap-1.5">
                      <span v-for="tag in selected.styleTags" :key="tag" class="rounded-lg border border-line/8 bg-app/50 px-2.5 py-1 text-[10px] text-faint">{{ tag }}</span>
                    </div>
                  </section>

                  <section class="border-t border-line/10 pt-6">
                    <div class="flex items-center gap-2">
                      <Palette class="h-4 w-4 text-brand1" />
                      <h3 class="text-sm font-semibold text-ink">品牌套件</h3>
                    </div>
                    <p class="mt-1 text-[11px] leading-5 text-faint">选择后实时更新预览，创建项目时自动生成品牌化首版。</p>
                    <label class="mt-3 block">
                      <span class="sr-only">选择品牌套件</span>
                      <select v-model="selectedBrandKitId" :disabled="!isAuthenticated" class="w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/40 disabled:cursor-not-allowed disabled:opacity-55">
                        <option value="">使用模板原始风格</option>
                        <option v-for="kit in brandKits" :key="kit.id" :value="kit.id">{{ kit.name }}{{ kit.isDefault ? ' · 默认' : '' }}</option>
                      </select>
                    </label>
                    <RouterLink v-if="isAuthenticated" to="/brand" class="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-brand1 hover:underline">
                      管理品牌套件<ArrowRight class="h-3 w-3" />
                    </RouterLink>
                    <button v-else class="mt-2 text-[11px] font-medium text-brand1 hover:underline" @click="showAuth">登录后使用品牌套件</button>
                  </section>

                  <section class="border-t border-line/10 pt-6">
                    <div class="flex items-center gap-2">
                      <SlidersHorizontal class="h-4 w-4 text-brand2" />
                      <h3 class="text-sm font-semibold text-ink">快速定制内容</h3>
                    </div>
                    <p class="mt-1 text-[11px] leading-5 text-faint">所有字段都会实时反映在预览中，之后仍可在项目编辑器继续修改。</p>
                    <div class="mt-4 space-y-4">
                      <label v-for="field in selected.variables" :key="field.key" class="grid gap-1.5">
                        <span class="flex items-center justify-between text-xs font-medium text-sub">
                          {{ field.label }}
                          <span class="font-normal text-faint">{{ (variables[field.key] || '').length }}/{{ field.maxLength }}</span>
                        </span>
                        <textarea
                          v-if="field.type === 'textarea'"
                          v-model="variables[field.key]"
                          rows="4"
                          :maxlength="field.maxLength"
                          :placeholder="field.placeholder"
                          class="resize-y rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm leading-6 text-ink outline-none transition focus:border-brand1/40 focus:ring-4 focus:ring-brand1/7"
                        />
                        <input
                          v-else
                          v-model="variables[field.key]"
                          :maxlength="field.maxLength"
                          :placeholder="field.placeholder"
                          class="rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand1/40 focus:ring-4 focus:ring-brand1/7"
                        />
                      </label>
                    </div>
                  </section>

                  <section class="rounded-2xl border border-brand1/16 bg-brand1/[0.055] p-4">
                    <div class="flex gap-3">
                      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand1/12 text-brand1"><Check class="h-4 w-4" /></span>
                      <div>
                        <h3 class="text-xs font-semibold text-ink">安全创建新项目</h3>
                        <p class="mt-1 text-[11px] leading-5 text-mut">模板会成为项目第 1 版。后续编辑、AI 迭代与品牌调整都会创建新版本，不覆盖历史。</p>
                      </div>
                    </div>
                  </section>

                  <button :disabled="creating" class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60" @click="createFromSelected">
                    <Loader2 v-if="creating" class="h-4 w-4 animate-spin" />
                    <WandSparkles v-else class="h-4 w-4" />
                    {{ isAuthenticated ? '使用此模板创建项目' : '登录后使用此模板' }}
                  </button>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.template-dialog-enter-active,
.template-dialog-leave-active { transition: opacity .18s ease; }
.template-dialog-enter-active section,
.template-dialog-leave-active section { transition: transform .22s cubic-bezier(.22,1,.36,1), opacity .18s ease; }
.template-dialog-enter-from,
.template-dialog-leave-to { opacity: 0; }
.template-dialog-enter-from section,
.template-dialog-leave-to section { transform: translateY(12px) scale(.992); opacity: 0; }
</style>

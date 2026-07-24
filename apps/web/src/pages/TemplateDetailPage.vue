<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Blocks,
  Check,
  Heart,
  Loader2,
  Monitor,
  Palette,
  Smartphone,
  Sparkles,
  Tablet,
  WandSparkles,
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
import { listBrandKits } from '../lib/brandKits'
import { listOfficialTemplates, listTemplateFavorites, setTemplateFavorite, useOfficialTemplate } from '../lib/officialTemplates'
import { typeById } from '../data/siteTypes'

const route = useRoute()
const router = useRouter()
const { isAuthenticated } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const templates = ref<OfficialTemplateDefinition[]>(SITEFORGE_TEMPLATES)
const brandKits = ref<BrandKit[]>([])
const favorites = ref<Set<string>>(new Set())
const variables = ref<Record<string, string>>({})
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const colorVariant = ref<'original' | 'cool' | 'warm'>('original')
const selectedBrandKitId = ref('')
const loading = ref(true)
const creating = ref(false)

const slug = computed(() => String(route.params.slug ?? ''))
const template = computed(() => templates.value.find((item) => item.slug === slug.value) ?? SITEFORGE_TEMPLATES.find((item) => item.slug === slug.value) ?? null)
const selectedBrand = computed(() => brandKits.value.find((kit) => kit.id === selectedBrandKitId.value) ?? null)
const variantTemplate = computed(() => {
  const selected = template.value
  if (!selected || colorVariant.value === 'original') return selected
  const palette = colorVariant.value === 'cool'
    ? { ...selected.palette, primary: '#2563eb', secondary: '#7c3aed', accent: '#06b6d4', background: selected.dark ? '#070b16' : '#f5f8ff', surface: selected.dark ? '#11182a' : '#ffffff' }
    : { ...selected.palette, primary: '#ea580c', secondary: '#be123c', accent: '#eab308', background: selected.dark ? '#160b08' : '#fff8f3', surface: selected.dark ? '#27140e' : '#ffffff' }
  return { ...selected, palette }
})
const previewHtml = computed(() => {
  if (!variantTemplate.value) return ''
  const html = renderOfficialTemplate(variantTemplate.value, variables.value)
  return selectedBrand.value ? applyBrandKitToHtml(html, selectedBrand.value) : html
})
const previewWidth = computed(() => viewport.value === 'mobile' ? '390px' : viewport.value === 'tablet' ? '820px' : '1180px')
const isFavorite = computed(() => template.value ? favorites.value.has(template.value.id) : false)
const sections = computed(() => {
  if (!previewHtml.value) return []
  const document = new DOMParser().parseFromString(previewHtml.value, 'text/html')
  return [...document.querySelectorAll<HTMLElement>('body>header,body>main,body>section,main>section,body>footer')].map((section, index) => ({
    id: section.id || `${section.tagName}-${index}`,
    label: section.querySelector('h1,h2,h3')?.textContent?.trim().slice(0, 70) || ({ HEADER: '页头与导航', MAIN: '主要内容', FOOTER: '页脚' }[section.tagName] ?? `内容区块 ${index + 1}`),
    tag: section.tagName.toLowerCase(),
  }))
})
const similar = computed(() => {
  if (!template.value) return []
  return templates.value.filter((item) => item.id !== template.value?.id).map((item) => ({ item, score: (item.category === template.value?.category ? 4 : 0) + (item.industry === template.value?.industry ? 3 : 0) + item.styleTags.filter((tag) => template.value?.styleTags.includes(tag)).length })).sort((a, b) => b.score - a.score).slice(0, 4).map((entry) => entry.item)
})
const generatedPrompt = computed(() => template.value ? `基于「${template.value.name}」的结构，创建一个${typeById(template.value.siteType)?.name ?? template.value.siteType}。保留${template.value.styleTags.join('、')}的视觉方向，但根据以下内容深度定制：${variables.value.headline || template.value.description}` : '')

async function load() {
  loading.value = true
  try {
    const catalog = await listOfficialTemplates()
    templates.value = catalog.templates
  } catch { templates.value = SITEFORGE_TEMPLATES }
  const selected = template.value
  if (selected) variables.value = officialTemplateDefaults(selected)
  if (isAuthenticated.value) {
    const [brands, cloudFavorites] = await Promise.allSettled([listBrandKits(), listTemplateFavorites()])
    brandKits.value = brands.status === 'fulfilled' ? brands.value : []
    favorites.value = cloudFavorites.status === 'fulfilled' ? new Set(cloudFavorites.value) : new Set()
    selectedBrandKitId.value = brandKits.value.find((kit) => kit.isDefault)?.id ?? ''
  } else {
    try { favorites.value = new Set(JSON.parse(localStorage.getItem('siteforge:template-favorites') ?? '[]') as string[]) } catch { favorites.value = new Set() }
  }
  loading.value = false
}
async function toggleFavorite() {
  if (!template.value) return
  const next = !favorites.value.has(template.value.id)
  const values = new Set(favorites.value)
  next ? values.add(template.value.id) : values.delete(template.value.id)
  favorites.value = values
  localStorage.setItem('siteforge:template-favorites', JSON.stringify([...values]))
  if (isAuthenticated.value) {
    try { await setTemplateFavorite(template.value.id, next) }
    catch { next ? values.delete(template.value.id) : values.add(template.value.id); favorites.value = new Set(values); toast.error('收藏同步失败') }
  }
}
async function createProject() {
  if (!template.value) return
  if (!isAuthenticated.value) { showAuth(); toast.info('登录后创建项目', '模板变量、品牌套件和后续版本将保存到云端。'); return }
  creating.value = true
  try {
    const project = await useOfficialTemplate(template.value.id, { title: variables.value.brandName || template.value.name, brandKitId: selectedBrandKitId.value || undefined, variables: variables.value })
    toast.success('模板项目已创建', `「${project.title}」已保存到项目工作区。`)
    await router.push({ name: 'project-detail', params: { id: project.id } })
  } catch (error) { toast.error('创建失败', error instanceof Error ? error.message : '请稍后重试') }
  finally { creating.value = false }
}
function openAiCustomization() { void router.push({ name: 'generator', query: { q: generatedPrompt.value, template: template.value?.slug } }) }

watch(slug, () => void load())
onMounted(load)
</script>

<template>
  <main class="min-h-screen pt-16 pb-24">
    <div v-if="loading" class="mx-auto flex min-h-[75vh] max-w-7xl items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>
    <section v-else-if="!template" class="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center"><Blocks class="h-10 w-10 text-faint" /><h1 class="mt-5 text-2xl font-bold">模板不存在或已下架</h1><p class="mt-3 text-sm text-mut">返回模板中心选择其他经过审核的官方模板。</p><RouterLink to="/templates" class="bg-brand-gradient mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white">返回模板中心</RouterLink></section>

    <div v-else class="mx-auto max-w-[1600px] px-3 sm:px-5 lg:px-8">
      <header class="py-6 sm:py-9"><button class="flex items-center gap-1.5 text-xs text-faint hover:text-brand1" @click="router.push('/templates')"><ArrowLeft class="h-3.5 w-3.5" />模板中心</button><div class="mt-5 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div class="max-w-4xl"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-brand1/10 px-3 py-1 text-[10px] font-semibold text-sub">{{ template.category }}</span><span class="rounded-full bg-ink/5 px-3 py-1 text-[10px] text-faint">{{ template.industry }}</span><span v-if="template.featured" class="flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold text-amber-500"><Sparkles class="h-3 w-3" />精选</span></div><h1 class="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">{{ template.name }}</h1><p class="mt-4 max-w-3xl text-sm leading-7 text-mut sm:text-base">{{ template.description }}</p><div class="mt-4 flex flex-wrap gap-2"><span v-for="tag in template.styleTags" :key="tag" class="rounded-full border border-line/10 px-2.5 py-1 text-[10px] text-sub">{{ tag }}</span></div></div><div class="flex flex-wrap gap-2"><button class="flex items-center gap-2 rounded-xl border border-line/10 px-4 py-3 text-sm" :class="isFavorite ? 'bg-red-500/[0.06] text-red-500' : 'text-sub'" @click="toggleFavorite"><Heart class="h-4 w-4" :fill="isFavorite ? 'currentColor' : 'none'" />{{ isFavorite ? '已收藏' : '收藏模板' }}</button><button class="flex items-center gap-2 rounded-xl border border-brand1/20 bg-brand1/[0.07] px-4 py-3 text-sm font-semibold text-sub hover:text-ink" @click="openAiCustomization"><WandSparkles class="h-4 w-4" />切换到 AI 深度定制</button><button :disabled="creating" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" @click="createProject"><Loader2 v-if="creating" class="h-4 w-4 animate-spin" /><ArrowRight v-else class="h-4 w-4" />创建项目</button></div></div></header>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section class="overflow-hidden rounded-3xl border border-line/10 bg-soft/55"><header class="flex flex-wrap items-center gap-3 border-b border-line/10 bg-app/45 px-4 py-3"><div class="flex gap-1.5"><span v-for="item in 3" :key="item" class="h-2.5 w-2.5 rounded-full bg-line/25" /></div><div class="min-w-0 flex-1 truncate rounded-md bg-ink/[0.04] px-3 py-1.5 text-[10px] text-faint">siteforge.app/templates/{{ template.slug }}</div><div class="flex rounded-lg bg-ink/[0.04] p-1"><button v-for="item in [{id:'desktop',icon:Monitor},{id:'tablet',icon:Tablet},{id:'mobile',icon:Smartphone}]" :key="item.id" class="rounded-md p-1.5" :class="viewport === item.id ? 'bg-soft text-brand1 shadow-sm' : 'text-faint'" @click="viewport = item.id as typeof viewport"><component :is="item.icon" class="h-3.5 w-3.5" /></button></div></header><div class="h-[680px] bg-ink/[0.035] p-3"><div class="mx-auto h-full overflow-hidden rounded-xl border border-line/10 bg-white shadow-2xl transition-[max-width]" :style="{maxWidth:previewWidth}"><iframe :srcdoc="previewHtml" sandbox="allow-scripts" class="h-full w-full" title="模板实时预览" /></div></div></section>

        <aside class="space-y-4">
          <section class="rounded-3xl border border-line/10 bg-soft/55 p-5"><div class="flex items-center gap-2"><Palette class="h-4 w-4 text-brand1" /><h2 class="text-sm font-semibold">定制模板</h2></div><div class="mt-4 grid grid-cols-3 gap-2"><button v-for="item in [{id:'original',label:'原始'},{id:'cool',label:'冷色'},{id:'warm',label:'暖色'}]" :key="item.id" class="rounded-xl border px-2 py-2.5 text-[10px]" :class="colorVariant === item.id ? 'border-brand1/30 bg-brand1/[0.07] font-semibold text-sub' : 'border-line/10 text-faint'" @click="colorVariant = item.id as typeof colorVariant"><Check v-if="colorVariant === item.id" class="mr-1 inline h-3 w-3" />{{ item.label }}</button></div><label v-if="brandKits.length" class="mt-4 block text-[10px] font-semibold text-sub">品牌套件<select v-model="selectedBrandKitId" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="">不应用品牌套件</option><option v-for="kit in brandKits" :key="kit.id" :value="kit.id">{{ kit.name }}{{ kit.isDefault ? ' · 默认' : '' }}</option></select></label><div class="mt-4 space-y-3"><label v-for="field in template.variables" :key="field.key" class="block text-[10px] font-semibold text-sub">{{ field.label }}<textarea v-if="field.type === 'textarea'" v-model="variables[field.key]" rows="3" :maxlength="field.maxLength" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 text-xs leading-5 outline-none" /><input v-else v-model="variables[field.key]" :maxlength="field.maxLength" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs outline-none" /></label></div></section>
          <section class="rounded-3xl border border-line/10 bg-soft/55 p-5"><div class="flex items-center gap-2"><Blocks class="h-4 w-4 text-brand1" /><h2 class="text-sm font-semibold">页面结构</h2></div><div class="mt-4 space-y-2"><div v-for="(section,index) in sections" :key="section.id" class="flex items-center gap-3 rounded-xl border border-line/8 bg-app/45 p-3"><span class="grid h-7 w-7 place-items-center rounded-lg bg-brand1/10 text-[9px] font-bold text-brand1">{{ index + 1 }}</span><div><p class="text-[10px] font-semibold">{{ section.label }}</p><p class="mt-0.5 text-[8px] text-faint">{{ section.tag }}</p></div></div></div></section>
        </aside>
      </div>

      <section v-if="similar.length" class="mt-12"><div class="flex items-end justify-between"><div><h2 class="text-2xl font-bold">相似模板</h2><p class="mt-2 text-sm text-mut">根据场景、行业和风格标签推荐。</p></div><RouterLink to="/templates" class="text-sm text-brand1">查看全部</RouterLink></div><div class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><RouterLink v-for="item in similar" :key="item.id" :to="`/templates/${item.slug}`" class="group overflow-hidden rounded-2xl border border-line/10 bg-soft/55 transition hover:-translate-y-0.5 hover:border-brand1/25"><div class="h-36 overflow-hidden bg-white"><iframe :srcdoc="renderOfficialTemplate(item)" sandbox="" tabindex="-1" class="pointer-events-none h-[520px] w-[920px] origin-top-left scale-[.24]" :title="`${item.name} 缩略图`" /></div><div class="p-4"><h3 class="text-sm font-semibold group-hover:text-brand1">{{ item.name }}</h3><p class="mt-1 line-clamp-2 text-[10px] leading-4 text-mut">{{ item.description }}</p></div></RouterLink></div></section>
    </div>
  </main>
</template>

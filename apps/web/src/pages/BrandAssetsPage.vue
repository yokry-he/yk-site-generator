<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Clipboard,
  File,
  FileText,
  Image,
  Images,
  Loader2,
  MoreHorizontal,
  Palette,
  Pencil,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import { listBrandKits } from '../lib/brandKits'
import {
  createBrandAsset,
  deleteBrandAsset,
  listBrandAssets,
  updateBrandAsset,
  type BrandAsset,
  type BrandAssetKind,
} from '../lib/brandAssets'
import type { BrandKit } from 'shared'

const router = useRouter()
const { isAuthenticated, loading: authLoading } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const assets = ref<BrandAsset[]>([])
const kits = ref<BrandKit[]>([])
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const query = ref('')
const kind = ref<BrandAssetKind | 'all'>('all')
const brandKitId = ref('all')
const selected = ref<BrandAsset | null>(null)
const editingName = ref('')
const editingAlt = ref('')
const editingTags = ref('')
const editingKind = ref<BrandAssetKind>('image')
const editingBrandKitId = ref('')
const actionBusy = ref('')
const openMenu = ref('')

const kindMeta: Record<BrandAssetKind, { label: string; icon: typeof Image }> = {
  logo: { label: 'Logo', icon: Palette },
  image: { label: '图片', icon: Image },
  icon: { label: '图标', icon: Images },
  background: { label: '背景', icon: Images },
  document: { label: '文档', icon: FileText },
}
const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return assets.value.filter((asset) => (kind.value === 'all' || asset.kind === kind.value)
    && (brandKitId.value === 'all' || asset.brandKitId === brandKitId.value)
    && (!keyword || `${asset.name} ${asset.alt ?? ''} ${asset.tags.join(' ')}`.toLowerCase().includes(keyword)))
})
const stats = computed(() => Object.fromEntries(Object.keys(kindMeta).map((key) => [key, assets.value.filter((asset) => asset.kind === key).length])) as Record<BrandAssetKind, number>)

function messageOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  return `${(value / 1024).toFixed(value > 1024 * 100 ? 0 : 1)} KB`
}

function dataUrlBytes(value: string): number {
  const content = value.split(',')[1] ?? ''
  return Math.floor(content.length * 0.75)
}

async function load() {
  if (!isAuthenticated.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const [assetRows, brandRows] = await Promise.all([listBrandAssets(), listBrandKits()])
    assets.value = assetRows
    kits.value = brandRows
  } catch (err) { error.value = messageOf(err) }
  finally { loading.value = false }
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function inferKind(file: File): BrandAssetKind {
  if (!file.type.startsWith('image/')) return 'document'
  if (/logo/i.test(file.name)) return 'logo'
  if (/icon|favicon/i.test(file.name)) return 'icon'
  if (/background|banner|hero|cover/i.test(file.name)) return 'background'
  return 'image'
}

async function uploadFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])].slice(0, 10)
  if (!files.length) return
  uploading.value = true
  try {
    let success = 0
    for (const file of files) {
      if (file.size > 2_000_000) {
        toast.info('已跳过过大文件', `${file.name} 超过 2MB。`)
        continue
      }
      const dataUrl = await readDataUrl(file)
      const created = await createBrandAsset({
        kind: inferKind(file),
        name: file.name.replace(/\.[^.]+$/, ''),
        dataUrl,
        alt: file.type.startsWith('image/') ? file.name.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') : undefined,
        tags: [],
        brandKitId: brandKitId.value !== 'all' ? brandKitId.value : undefined,
      })
      assets.value.unshift(created)
      success += 1
    }
    if (success) toast.success('资源已上传', `已加入 ${success} 个品牌资源。`)
  } catch (err) { toast.error('上传失败', messageOf(err)) }
  finally { uploading.value = false; input.value = '' }
}

function openEditor(asset: BrandAsset) {
  openMenu.value = ''
  selected.value = asset
  editingName.value = asset.name
  editingAlt.value = asset.alt ?? ''
  editingTags.value = asset.tags.join(', ')
  editingKind.value = asset.kind
  editingBrandKitId.value = asset.brandKitId ?? ''
}

async function save() {
  if (!selected.value || !editingName.value.trim()) return
  actionBusy.value = 'save'
  try {
    const updated = await updateBrandAsset(selected.value.id, {
      name: editingName.value.trim(),
      alt: editingAlt.value.trim() || null,
      tags: [...new Set(editingTags.value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean))],
      kind: editingKind.value,
      brandKitId: editingBrandKitId.value || null,
    })
    assets.value = assets.value.map((item) => item.id === updated.id ? updated : item)
    selected.value = updated
    toast.success('资源信息已更新')
  } catch (err) { toast.error('保存失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function remove(asset: BrandAsset) {
  openMenu.value = ''
  if (!window.confirm(`永久删除资源「${asset.name}」？已插入项目的副本不会受影响。`)) return
  actionBusy.value = asset.id
  try {
    await deleteBrandAsset(asset.id)
    assets.value = assets.value.filter((item) => item.id !== asset.id)
    if (selected.value?.id === asset.id) selected.value = null
    toast.success('品牌资源已删除')
  } catch (err) { toast.error('删除失败', messageOf(err)) }
  finally { actionBusy.value = '' }
}

async function copyValue(asset: BrandAsset) {
  try {
    await navigator.clipboard.writeText(asset.dataUrl)
    toast.success('资源地址已复制', '可粘贴到编辑器的图片地址字段。')
  } catch { toast.error('复制失败', '浏览器未允许访问剪贴板。') }
}

watch(isAuthenticated, (value) => value ? void load() : (assets.value = []))
onMounted(load)
</script>

<template>
  <main class="min-h-screen pt-20 pb-24">
    <div v-if="authLoading && !isAuthenticated" class="flex min-h-[70vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>
    <section v-else-if="!isAuthenticated" class="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 text-center"><div class="w-full rounded-3xl border border-line/10 bg-soft/65 p-9"><Images class="mx-auto h-10 w-10 text-brand1" /><h1 class="mt-5 text-2xl font-bold">登录后管理品牌资源</h1><p class="mt-3 text-sm leading-7 text-mut">集中保存 Logo、图片、图标、背景和文档，在多个项目之间复用。</p><button class="bg-brand-gradient mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="showAuth">登录 SiteForge</button></div></section>

    <div v-else class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header class="relative overflow-hidden rounded-[30px] border border-line/10 bg-soft/60 p-6 sm:p-8"><div class="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-brand1/14 blur-3xl" /><div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><button class="flex items-center gap-1.5 text-xs text-faint hover:text-brand1" @click="router.push('/brand')"><ArrowLeft class="h-3.5 w-3.5" />品牌套件</button><div class="mt-5 flex items-center gap-3"><span class="bg-brand-gradient grid h-12 w-12 place-items-center rounded-2xl text-white"><Images class="h-5 w-5" /></span><div><h1 class="text-3xl font-bold tracking-tight sm:text-4xl">品牌资源库</h1><p class="mt-1 text-sm text-mut">让常用素材只上传一次，在模板和编辑器中持续复用。</p></div></div></div><div class="flex gap-2"><button :disabled="loading" class="rounded-xl border border-line/10 bg-app/45 p-3 text-faint disabled:opacity-45" @click="load"><RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" /></button><label class="bg-brand-gradient flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"><Loader2 v-if="uploading" class="h-4 w-4 animate-spin" /><Upload v-else class="h-4 w-4" />{{ uploading ? '正在上传' : '上传资源' }}<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml,text/plain,application/pdf" class="hidden" :disabled="uploading" @change="uploadFiles" /></label></div></div><div class="relative mt-7 grid gap-3 sm:grid-cols-5"><button v-for="(meta,key) in kindMeta" :key="key" class="rounded-2xl border p-4 text-left" :class="kind === key ? 'border-brand1/30 bg-brand1/[0.07]' : 'border-line/10 bg-app/45'" @click="kind = kind === key ? 'all' : key"><component :is="meta.icon" class="h-4 w-4 text-brand1" /><strong class="mt-3 block text-xl">{{ stats[key] }}</strong><span class="text-[10px] text-faint">{{ meta.label }}</span></button></div></header>

      <div class="mt-6 flex flex-col gap-3 rounded-2xl border border-line/10 bg-soft/45 p-3 sm:flex-row"><label class="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line/10 bg-app/65 px-3 py-2.5"><Search class="h-4 w-4 text-faint" /><input v-model="query" placeholder="搜索名称、标签或替代文字" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" /></label><label class="relative"><select v-model="kind" class="w-full appearance-none rounded-xl border border-line/10 bg-app/65 py-2.5 pr-9 pl-3 text-xs outline-none"><option value="all">全部类型</option><option v-for="(meta,key) in kindMeta" :key="key" :value="key">{{ meta.label }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label><label class="relative"><select v-model="brandKitId" class="w-full appearance-none rounded-xl border border-line/10 bg-app/65 py-2.5 pr-9 pl-3 text-xs outline-none"><option value="all">全部品牌套件</option><option v-for="kit in kits" :key="kit.id" :value="kit.id">{{ kit.name }}</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label></div>

      <div v-if="error" class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">{{ error }}</div>
      <div v-if="loading && !assets.length" class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div v-for="item in 8" :key="item" class="h-64 animate-pulse rounded-2xl bg-ink/[0.04]" /></div>
      <section v-else-if="!visible.length" class="mt-7 flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-line/15 text-center"><Upload class="h-9 w-9 text-faint" /><h2 class="mt-4 text-lg font-semibold">没有匹配的品牌资源</h2><p class="mt-2 text-sm text-mut">上传第一张图片，或调整当前筛选条件。</p></section>

      <div v-else class="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><article v-for="asset in visible" :key="asset.id" class="group relative overflow-visible rounded-2xl border border-line/10 bg-soft/60 shadow-lg shadow-black/[0.03]"><div class="relative flex h-44 items-center justify-center overflow-hidden rounded-t-2xl border-b border-line/8 bg-ink/[0.035]"><img v-if="asset.kind !== 'document'" :src="asset.dataUrl" :alt="asset.alt || ''" class="h-full w-full object-contain p-3" /><File v-else class="h-12 w-12 text-faint" /><span class="absolute top-3 left-3 rounded-full bg-app/80 px-2.5 py-1 text-[9px] font-semibold text-sub">{{ kindMeta[asset.kind].label }}</span></div><div class="p-4"><div class="flex items-start gap-2"><div class="min-w-0 flex-1"><h2 class="truncate text-sm font-semibold">{{ asset.name }}</h2><p class="mt-1 text-[9px] text-faint">{{ formatBytes(dataUrlBytes(asset.dataUrl)) }} · {{ kits.find(kit => kit.id === asset.brandKitId)?.name || '未关联套件' }}</p></div><div class="relative"><button class="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-ink" @click="openMenu = openMenu === asset.id ? '' : asset.id"><MoreHorizontal class="h-4 w-4" /></button><div v-if="openMenu === asset.id" class="absolute top-8 right-0 z-20 w-36 rounded-xl border border-line/10 bg-soft/98 p-1.5 shadow-2xl"><button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-sub hover:bg-ink/5" @click="openEditor(asset)"><Pencil class="h-3.5 w-3.5" />编辑信息</button><button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-sub hover:bg-ink/5" @click="copyValue(asset)"><Clipboard class="h-3.5 w-3.5" />复制地址</button><button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-500 hover:bg-red-500/[0.06]" @click="remove(asset)"><Trash2 class="h-3.5 w-3.5" />删除</button></div></div></div><p class="mt-2 line-clamp-2 min-h-8 text-[10px] leading-4 text-mut">{{ asset.alt || '未填写图片说明' }}</p><div class="mt-3 flex min-h-6 flex-wrap gap-1"><span v-for="tagValue in asset.tags" :key="tagValue" class="rounded-full bg-brand1/8 px-2 py-1 text-[8px] text-brand1">{{ tagValue }}</span><span v-if="!asset.tags.length" class="text-[9px] text-faint">暂无标签</span></div></div><Loader2 v-if="actionBusy === asset.id" class="absolute inset-0 m-auto h-6 w-6 animate-spin text-brand1" /></article></div>
    </div>

    <Teleport to="body"><Transition name="drawer"><div v-if="selected" class="fixed inset-0 z-[150] bg-black/45 backdrop-blur-sm" @mousedown.self="selected = null"><aside class="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-line/10 bg-app shadow-2xl"><header class="flex items-start justify-between border-b border-line/10 p-5"><div><p class="text-[10px] font-semibold tracking-wider text-brand1 uppercase">Brand Asset</p><h2 class="mt-2 text-xl font-bold">编辑资源信息</h2></div><button class="rounded-lg p-2 text-faint hover:bg-ink/5" @click="selected = null"><X class="h-5 w-5" /></button></header><div class="min-h-0 flex-1 overflow-y-auto p-5"><div class="flex h-52 items-center justify-center overflow-hidden rounded-2xl border border-line/10 bg-ink/[0.035]"><img v-if="selected.kind !== 'document'" :src="selected.dataUrl" :alt="selected.alt || ''" class="h-full w-full object-contain p-3" /><FileText v-else class="h-12 w-12 text-faint" /></div><div class="mt-5 grid gap-4"><label class="text-xs font-semibold text-sub">资源名称<input v-model="editingName" maxlength="100" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/65 px-3 py-2.5 text-sm outline-none" /></label><div class="grid grid-cols-2 gap-3"><label class="text-xs font-semibold text-sub">资源类型<select v-model="editingKind" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/65 px-3 py-2.5 text-xs outline-none"><option v-for="(meta,key) in kindMeta" :key="key" :value="key">{{ meta.label }}</option></select></label><label class="text-xs font-semibold text-sub">关联套件<select v-model="editingBrandKitId" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/65 px-3 py-2.5 text-xs outline-none"><option value="">不关联</option><option v-for="kit in kits" :key="kit.id" :value="kit.id">{{ kit.name }}</option></select></label></div><label class="text-xs font-semibold text-sub">替代文字<textarea v-model="editingAlt" rows="3" maxlength="240" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-soft/65 p-3 text-xs leading-5 outline-none" /></label><label class="text-xs font-semibold text-sub"><span class="flex items-center gap-1.5"><Tag class="h-3.5 w-3.5" />标签</span><input v-model="editingTags" placeholder="产品图, 深色背景, 首页" class="mt-2 w-full rounded-xl border border-line/10 bg-soft/65 px-3 py-2.5 text-xs outline-none" /><small class="mt-1 block text-[9px] text-faint">使用逗号分隔，便于后续搜索和复用。</small></label></div></div><footer class="flex justify-end gap-2 border-t border-line/10 p-5"><button class="rounded-xl border border-line/10 px-4 py-2.5 text-sm text-sub" @click="selected = null">取消</button><button :disabled="!editingName.trim() || actionBusy === 'save'" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45" @click="save"><Loader2 v-if="actionBusy === 'save'" class="h-4 w-4 animate-spin" /><Check v-else class="h-4 w-4" />保存信息</button></footer></aside></div></Transition></Teleport>
  </main>
</template>

<style scoped>
.drawer-enter-active,.drawer-leave-active{transition:opacity .18s ease}.drawer-enter-active aside,.drawer-leave-active aside{transition:transform .24s cubic-bezier(.22,1,.36,1)}.drawer-enter-from,.drawer-leave-to{opacity:0}.drawer-enter-from aside,.drawer-leave-to aside{transform:translateX(28px)}
</style>

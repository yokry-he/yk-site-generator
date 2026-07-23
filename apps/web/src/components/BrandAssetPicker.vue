<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Image, Loader2, Search, Upload } from 'lucide-vue-next'
import AppDrawer from './ui/AppDrawer.vue'
import { createBrandAsset, listBrandAssets, type BrandAsset } from '../lib/brandAssets'
import { useToast } from '../composables/useToast'

const props = withDefaults(defineProps<{ open: boolean; brandKitId?: string; kinds?: Array<'logo' | 'image' | 'icon' | 'background'> }>(), { brandKitId: '', kinds: () => ['logo', 'image', 'icon', 'background'] })
const emit = defineEmits<{ (event: 'close'): void; (event: 'select', asset: BrandAsset): void }>()
const toast = useToast()
const assets = ref<BrandAsset[]>([])
const loading = ref(false)
const uploading = ref(false)
const query = ref('')
const selectedId = ref('')
const recentKey = 'siteforge:recent-brand-assets'
const recentIds = ref<string[]>([])

const visible = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return [...assets.value]
    .filter((asset) => props.kinds.includes(asset.kind as (typeof props.kinds)[number]))
    .filter((asset) => !props.brandKitId || !asset.brandKitId || asset.brandKitId === props.brandKitId)
    .filter((asset) => !keyword || `${asset.name} ${asset.alt ?? ''} ${asset.tags.join(' ')}`.toLowerCase().includes(keyword))
    .sort((a, b) => recentIds.value.indexOf(a.id) - recentIds.value.indexOf(b.id))
})

async function load() {
  if (loading.value) return
  loading.value = true
  try { assets.value = await listBrandAssets() }
  catch (error) { toast.error('资源加载失败', error instanceof Error ? error.message : '请稍后重试') }
  finally { loading.value = false }
}
function persistRecent(id: string) {
  recentIds.value = [id, ...recentIds.value.filter((item) => item !== id)].slice(0, 20)
  localStorage.setItem(recentKey, JSON.stringify(recentIds.value))
}
function choose(asset: BrandAsset) {
  selectedId.value = asset.id
  persistRecent(asset.id)
  emit('select', asset)
  emit('close')
}
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/') || file.size > 2_000_000) { toast.error('图片无法上传', '请选择 2MB 以内的 PNG、JPG、WebP 或 SVG。'); input.value = ''; return }
  uploading.value = true
  try {
    const asset = await createBrandAsset({
      brandKitId: props.brandKitId || undefined,
      kind: /logo/i.test(file.name) ? 'logo' : /background|hero|cover/i.test(file.name) ? 'background' : 'image',
      name: file.name.replace(/\.[^.]+$/, ''),
      dataUrl: await readDataUrl(file),
      alt: file.name.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, ''),
      tags: [],
    })
    assets.value.unshift(asset)
    choose(asset)
    toast.success('图片已加入品牌资源库', asset.name)
  } catch (error) { toast.error('上传失败', error instanceof Error ? error.message : '请稍后重试') }
  finally { uploading.value = false; input.value = '' }
}

watch(() => props.open, (open) => {
  if (!open) return
  try { recentIds.value = JSON.parse(localStorage.getItem(recentKey) ?? '[]') as string[] } catch { recentIds.value = [] }
  void load()
})
</script>

<template>
  <AppDrawer :open="open" title="选择品牌资源" description="从已有 Logo、图片和背景中选择，或上传新资源。" width="lg" @close="emit('close')">
    <div class="sticky top-0 z-10 border-b border-line/10 bg-app/92 p-4 backdrop-blur"><label class="flex items-center gap-2 rounded-xl border border-line/10 bg-soft/60 px-3 py-2.5"><Search class="h-4 w-4 text-faint" /><input v-model="query" autofocus placeholder="搜索名称、标签或替代文字" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" /></label></div>
    <div class="p-4">
      <div v-if="loading" class="grid grid-cols-2 gap-3 sm:grid-cols-3"><div v-for="item in 6" :key="item" class="h-40 animate-pulse rounded-2xl bg-ink/[0.04]" /></div>
      <div v-else-if="visible.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3"><button v-for="asset in visible" :key="asset.id" class="group overflow-hidden rounded-2xl border text-left transition" :class="selectedId === asset.id ? 'border-brand1/45 bg-brand1/[0.06]' : 'border-line/10 hover:border-brand1/25'" @click="choose(asset)"><span class="relative flex h-32 items-center justify-center bg-ink/[0.035]"><img :src="asset.dataUrl" :alt="asset.alt || ''" class="h-full w-full object-contain p-2" /><Check v-if="selectedId === asset.id" class="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand1 p-1 text-white" /></span><span class="block p-3"><strong class="block truncate text-xs">{{ asset.name }}</strong><span class="mt-1 block truncate text-[9px] text-faint">{{ asset.alt || '未填写替代文字' }}</span></span></button></div>
      <div v-else class="flex min-h-64 flex-col items-center justify-center text-center"><Image class="h-9 w-9 text-faint" /><h3 class="mt-4 text-sm font-semibold">没有匹配的图片资源</h3><p class="mt-2 text-xs text-mut">上传新图片后会同时保存到品牌资源库。</p></div>
    </div>
    <template #footer><label class="bg-brand-gradient flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"><Loader2 v-if="uploading" class="h-4 w-4 animate-spin" /><Upload v-else class="h-4 w-4" />{{ uploading ? '正在上传' : '上传并选择图片' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" :disabled="uploading" @change="upload" /></label></template>
  </AppDrawer>
</template>

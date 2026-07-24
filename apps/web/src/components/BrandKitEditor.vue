<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Monitor,
  Palette,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Type,
} from 'lucide-vue-next'
import {
  BRAND_FONT_OPTIONS,
  BRAND_PRESETS,
  applyBrandKitToHtml,
  bestContrastText,
  contrastRatio,
  isHexColor,
  type BrandKit,
  type BrandKitTokens,
  type BrandPreset,
} from 'shared'
import AppDialog from './ui/AppDialog.vue'
import { confirmDialog } from '../composables/useConfirmDialog'
import type { BrandKitInput } from '../lib/brandKits'

const props = defineProps<{ open: boolean; value?: BrandKit | null; saving?: boolean }>()
const emit = defineEmits<{ (event: 'close'): void; (event: 'save', value: BrandKitInput): void }>()

type Panel = 'identity' | 'assets' | 'colors' | 'typography' | 'style' | 'profile'
type ImageField = 'logoDataUrl' | 'logoDarkDataUrl' | 'logoVerticalDataUrl' | 'logoMarkDataUrl' | 'faviconDataUrl' | 'ogImageDataUrl'
const tabs = [
  { id: 'identity' as const, label: '品牌信息', icon: Sparkles },
  { id: 'assets' as const, label: 'Logo 与封面', icon: ImagePlus },
  { id: 'colors' as const, label: '色彩', icon: Palette },
  { id: 'typography' as const, label: '字体与排版', icon: Type },
  { id: 'style' as const, label: '组件风格', icon: LayoutTemplate },
  { id: 'profile' as const, label: '公司资料', icon: Building2 },
]
const colorFields = [
  { key: 'primary' as const, label: '主品牌色' }, { key: 'secondary' as const, label: '辅助品牌色' }, { key: 'accent' as const, label: '点缀色' },
  { key: 'background' as const, label: '页面背景' }, { key: 'surface' as const, label: '卡片表面' }, { key: 'text' as const, label: '主要文字' }, { key: 'muted' as const, label: '次要文字' },
]
const imageFields: Array<{ key: ImageField; label: string; hint: string; ratio: string }> = [
  { key: 'logoDataUrl', label: '横版／通用 Logo', hint: '浅色背景和导航默认使用', ratio: '宽幅或方形' },
  { key: 'logoDarkDataUrl', label: '深色背景 Logo', hint: '深色区块中优先使用', ratio: '透明底' },
  { key: 'logoVerticalDataUrl', label: '竖版 Logo', hint: '海报、页脚和品牌页使用', ratio: '竖向' },
  { key: 'logoMarkDataUrl', label: '图标 Logo', hint: '头像、紧凑导航和应用图标', ratio: '1:1' },
  { key: 'faviconDataUrl', label: 'Favicon', hint: '浏览器标签与收藏夹图标', ratio: '1:1' },
  { key: 'ogImageDataUrl', label: '社交分享封面', hint: '链接分享到社交平台时显示', ratio: '1.91:1' },
]

function emptyInput(): BrandKitInput {
  return { name: '我的品牌', description: '一套可在多个项目中复用的品牌视觉规范。', ...structuredClone(BRAND_PRESETS[0].tokens), isDefault: false, companyName: '', companyDescription: '', contactEmail: '', contactPhone: '', address: '', socialLinks: {} }
}
function fromBrandKit(value?: BrandKit | null): BrandKitInput {
  if (!value) return emptyInput()
  const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = value
  return structuredClone({ ...emptyInput(), ...input, socialLinks: input.socialLinks ?? {} })
}
function serialized(input: BrandKitInput): string { return JSON.stringify(input) }

const activePanel = ref<Panel>('identity')
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const draft = ref<BrandKitInput>(emptyInput())
const original = ref('')
const uploadError = ref('')
const socialText = ref('')
const dirty = computed(() => serialized(draft.value) !== original.value)
const formValid = computed(() => Boolean(draft.value.name.trim()) && colorFields.every(({ key }) => isHexColor(draft.value[key])))
const viewportWidth = computed(() => viewport.value === 'mobile' ? '390px' : viewport.value === 'tablet' ? '820px' : '1180px')
const textContrast = computed(() => contrastRatio(draft.value.text, draft.value.background))
const surfaceContrast = computed(() => contrastRatio(draft.value.text, draft.value.surface))
const buttonContrast = computed(() => contrastRatio(bestContrastText(draft.value.primary), draft.value.primary))
const qualityChecks = computed(() => [
  { label: '正文对背景达到 AA', pass: textContrast.value >= 4.5, detail: `${textContrast.value.toFixed(2)}:1` },
  { label: '卡片文字清晰可读', pass: surfaceContrast.value >= 4.5, detail: `${surfaceContrast.value.toFixed(2)}:1` },
  { label: '主按钮对比安全', pass: buttonContrast.value >= 4.5, detail: `${buttonContrast.value.toFixed(2)}:1` },
  { label: '品牌标识完整', pass: Boolean(draft.value.logoDataUrl || draft.value.logoMarkDataUrl), detail: draft.value.logoDataUrl || draft.value.logoMarkDataUrl ? '已配置' : '建议上传' },
  { label: '公司资料可复用', pass: Boolean(draft.value.companyName || draft.value.companyDescription), detail: draft.value.companyName ? '已填写' : '可选' },
])
const qualityScore = computed(() => Math.round(qualityChecks.value.filter((item) => item.pass).length / qualityChecks.value.length * 100))

const basePreview = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>品牌套件预览</title><style>*{box-sizing:border-box}body{margin:0}nav{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:18px 5vw}nav .links{display:flex;gap:12px;align-items:center}a{text-decoration:none}main{padding:8vh 5vw}.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(280px,.9fr);gap:7vw;align-items:center}.tag{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.lead{font-size:18px;line-height:1.8;opacity:.74}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.visual{padding:20px;background:var(--sf-brand-surface);border:1px solid color-mix(in srgb,var(--sf-brand-muted) 25%,transparent)}.chart{height:190px;background:linear-gradient(180deg,color-mix(in srgb,var(--sf-brand-primary) 20%,transparent),transparent),repeating-linear-gradient(90deg,transparent 0 44px,color-mix(in srgb,var(--sf-brand-muted) 12%,transparent) 45px)}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:64px}.card{padding:24px;background:var(--sf-brand-surface)}input{width:100%;padding:13px 15px;margin-top:14px}button{padding:12px 18px;border:1px solid}@media(max-width:760px){.hero{grid-template-columns:1fr}.cards{grid-template-columns:1fr}.links a{display:none}}</style></head><body><nav><strong>品牌名称</strong><div class="links"><a href="#">产品</a><a href="#">案例</a><button>开始体验</button></div></nav><main><section class="hero"><div><p class="tag">BRAND SYSTEM 2.1</p><h1>让每个页面都保持一致、可信的品牌表达</h1><p class="lead">Logo、字体层级、内容宽度、组件风格和公司资料会在多个项目中持续复用。</p><div class="actions"><button>创建网站</button><button>查看案例</button></div><input placeholder="输入邮箱获取更新" /></div><div class="visual"><div class="chart"></div></div></section><section class="cards"><article class="card"><h2>清晰层级</h2><p>标题比例与间距密度保持一致。</p></article><article class="card"><h2>资源复用</h2><p>多种 Logo 和社交封面统一管理。</p></article><article class="card"><h2>组件规范</h2><p>导航、输入框、图片与图标风格同步。</p></article></section></main></body></html>`
const previewHtml = computed(() => applyBrandKitToHtml(basePreview, { id: props.value?.id || 'preview', ...draft.value }))

function reset(value = props.value) {
  draft.value = fromBrandKit(value)
  socialText.value = Object.entries(draft.value.socialLinks ?? {}).map(([key, url]) => `${key}: ${url}`).join('\n')
  original.value = serialized(draft.value)
  activePanel.value = 'identity'; viewport.value = 'desktop'; uploadError.value = ''
}
function applyPreset(preset: BrandPreset) { draft.value = { ...draft.value, ...structuredClone(preset.tokens) } }
function updateColor(key: keyof BrandKitTokens, value: string) { Object.assign(draft.value, { [key]: value.trim().toLowerCase() }) }
function fixContrast() { draft.value.text = bestContrastText(draft.value.background); draft.value.muted = draft.value.text === '#ffffff' ? '#cbd5e1' : '#475569' }
function parseSocialLinks() {
  const links: Record<string, string> = {}
  for (const line of socialText.value.split('\n')) {
    const [name, ...rest] = line.split(':')
    const url = rest.join(':').trim()
    if (name?.trim() && /^https?:\/\//i.test(url)) links[name.trim().slice(0, 40)] = url.slice(0, 500)
  }
  draft.value.socialLinks = links
}
async function uploadImage(field: ImageField, event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''
  if (!file) return
  uploadError.value = ''
  if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) { uploadError.value = '仅支持 PNG、JPG、WebP 或 SVG。'; return }
  if (file.size > 650 * 1024) { uploadError.value = '请将品牌图片控制在 650 KB 以内。'; return }
  const result = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }).catch(() => '')
  if (result) draft.value[field] = result
  else uploadError.value = '图片读取失败，请重新选择。'
}
async function requestClose() {
  if (!dirty.value || await confirmDialog({ title: '关闭品牌编辑器？', description: '尚未保存的品牌调整将丢失。', confirmLabel: '放弃并关闭', cancelLabel: '继续编辑', tone: 'danger' })) emit('close')
}
async function requestReset() {
  if (!dirty.value || await confirmDialog({ title: '重置全部调整？', description: '将恢复到打开编辑器时的品牌配置。', confirmLabel: '重置', tone: 'danger' })) reset()
}
function save() {
  if (!formValid.value || props.saving) return
  parseSocialLinks()
  emit('save', structuredClone({ ...draft.value, name: draft.value.name.trim(), description: draft.value.description.trim(), companyName: draft.value.companyName?.trim(), companyDescription: draft.value.companyDescription?.trim(), contactEmail: draft.value.contactEmail?.trim(), contactPhone: draft.value.contactPhone?.trim(), address: draft.value.address?.trim() }))
}
function onKey(event: KeyboardEvent) {
  if (!props.open) return
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save() }
}
watch(() => props.open, async (open) => { if (open) { reset(); window.addEventListener('keydown', onKey); await nextTick() } else window.removeEventListener('keydown', onKey) }, { immediate: true })
watch(() => props.value, (value) => props.open && !dirty.value && reset(value))
</script>

<template>
  <AppDialog :open="open" size="full" :show-close="false" :close-on-backdrop="false" :close-on-escape="false" @close="requestClose">
    <div class="flex h-full min-h-0 flex-col bg-app text-ink">
      <header class="flex min-h-16 items-center gap-3 border-b border-line/10 bg-soft/92 px-3 py-2 backdrop-blur-xl sm:px-5">
        <button class="rounded-xl p-2 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭品牌套件编辑器" @click="requestClose"><ChevronLeft class="h-5 w-5" /></button>
        <div class="min-w-0"><div class="flex items-center gap-2"><h2 class="truncate text-sm font-semibold">{{ value?.id ? `编辑「${value.name}」` : '创建品牌套件' }}</h2><span v-if="dirty" class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-500">未保存</span></div><p class="hidden text-[10px] text-faint sm:block">品牌预览与应用到项目后的共享 CSS 保持一致。</p></div>
        <div class="ml-auto hidden items-center gap-1 rounded-xl bg-ink/[0.04] p-1 md:flex"><button v-for="item in [{id:'desktop',icon:Monitor},{id:'tablet',icon:Tablet},{id:'mobile',icon:Smartphone}]" :key="item.id" class="rounded-lg p-2" :class="viewport === item.id ? 'bg-soft text-brand1 shadow-sm' : 'text-faint'" @click="viewport = item.id as typeof viewport"><component :is="item.icon" class="h-4 w-4" /></button></div>
        <button class="hidden items-center gap-1.5 rounded-xl border border-line/10 px-3 py-2 text-xs text-faint sm:flex" @click="requestReset"><RotateCcw class="h-3.5 w-3.5" />重置</button>
        <button :disabled="!formValid || saving || !dirty" class="bg-brand-gradient flex min-w-24 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45" @click="save"><Loader2 v-if="saving" class="h-4 w-4 animate-spin" /><Save v-else class="h-4 w-4" />{{ saving ? '保存中' : '保存套件' }}</button>
      </header>

      <div class="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[360px_minmax(0,1fr)_300px] xl:overflow-hidden">
        <aside class="border-b border-line/10 bg-soft/62 xl:flex xl:min-h-0 xl:flex-col xl:border-r xl:border-b-0">
          <div class="grid grid-cols-3 gap-1 border-b border-line/10 p-2 xl:grid-cols-2"><button v-for="tab in tabs" :key="tab.id" class="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px]" :class="activePanel === tab.id ? 'bg-brand1/10 font-semibold text-brand1' : 'text-faint hover:bg-ink/5 hover:text-ink'" @click="activePanel = tab.id"><component :is="tab.icon" class="h-3.5 w-3.5" />{{ tab.label }}</button></div>
          <div class="max-h-[52vh] overflow-y-auto p-4 xl:max-h-none xl:min-h-0 xl:flex-1 xl:p-5">
            <div v-if="activePanel === 'identity'" class="space-y-5">
              <label class="block text-xs font-semibold text-sub">品牌套件名称<input v-model="draft.name" maxlength="80" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm outline-none" /></label>
              <label class="block text-xs font-semibold text-sub">用途说明<textarea v-model="draft.description" rows="4" maxlength="240" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 text-sm leading-6 outline-none" /></label>
              <label class="flex items-start gap-3 rounded-xl border border-line/10 bg-app/45 p-3"><input v-model="draft.isDefault" type="checkbox" class="mt-0.5 accent-violet-500" /><span><strong class="block text-xs">设为默认品牌套件</strong><span class="mt-1 block text-[10px] leading-4 text-faint">模板和新项目优先推荐。</span></span></label>
            </div>

            <div v-else-if="activePanel === 'assets'" class="space-y-3">
              <article v-for="field in imageFields" :key="field.key" class="rounded-2xl border border-line/10 bg-app/45 p-3"><div class="flex items-center gap-3"><span class="grid h-14 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line/10 bg-white p-1"><img v-if="draft[field.key]" :src="draft[field.key]" :alt="field.label" class="max-h-full max-w-full object-contain" /><ImagePlus v-else class="h-5 w-5 text-zinc-400" /></span><div class="min-w-0 flex-1"><strong class="text-xs">{{ field.label }}</strong><p class="mt-1 text-[9px] leading-4 text-faint">{{ field.hint }} · {{ field.ratio }}</p></div><button v-if="draft[field.key]" class="rounded-lg p-2 text-faint hover:text-red-500" :aria-label="`移除${field.label}`" @click="draft[field.key] = undefined"><Trash2 class="h-3.5 w-3.5" /></button></div><label class="mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-line/15 px-3 py-2 text-[10px] text-brand1"><ImagePlus class="h-3.5 w-3.5" />{{ draft[field.key] ? '替换图片' : '上传图片' }}<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only" @change="uploadImage(field.key,$event)" /></label></article>
              <p v-if="uploadError" class="rounded-xl bg-red-500/[0.06] p-3 text-[10px] text-red-500">{{ uploadError }}</p>
            </div>

            <div v-else-if="activePanel === 'colors'" class="space-y-4">
              <div class="grid grid-cols-3 gap-2"><button v-for="preset in BRAND_PRESETS" :key="preset.id" class="rounded-xl border border-line/10 bg-app/60 p-2 text-left" :title="preset.description" @click="applyPreset(preset)"><span class="flex h-6 overflow-hidden rounded-md"><i class="flex-1" :style="{background:preset.tokens.primary}" /><i class="flex-1" :style="{background:preset.tokens.secondary}" /><i class="flex-1" :style="{background:preset.tokens.background}" /></span><span class="mt-1 block truncate text-[8px]">{{ preset.name }}</span></button></div>
              <label v-for="field in colorFields" :key="field.key" class="block text-[10px] font-semibold text-sub">{{ field.label }}<div class="mt-1.5 flex gap-2"><input type="color" :value="draft[field.key]" class="h-10 w-12 rounded-lg" @input="updateColor(field.key,($event.target as HTMLInputElement).value)" /><input :value="draft[field.key]" class="min-w-0 flex-1 rounded-xl border border-line/10 bg-app/65 px-3 font-mono text-xs outline-none" @input="updateColor(field.key,($event.target as HTMLInputElement).value)" /></div></label>
              <button class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand1/10 py-2.5 text-xs font-semibold text-brand1" @click="fixContrast"><CheckCircle2 class="h-4 w-4" />自动修复文字对比度</button>
            </div>

            <div v-else-if="activePanel === 'typography'" class="space-y-4">
              <label class="block text-xs font-semibold text-sub">标题字体<select v-model="draft.headingFont" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option v-for="font in BRAND_FONT_OPTIONS" :key="font.id" :value="font.id">{{ font.name }}</option></select></label>
              <label class="block text-xs font-semibold text-sub">正文字体<select v-model="draft.bodyFont" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option v-for="font in BRAND_FONT_OPTIONS" :key="font.id" :value="font.id">{{ font.name }}</option></select></label>
              <label class="block text-xs font-semibold text-sub">标题比例 {{ (draft.headingScale ?? 1).toFixed(2) }}×<input v-model.number="draft.headingScale" type="range" min="0.8" max="1.35" step="0.05" class="mt-3 w-full accent-violet-500" /></label>
              <label class="block text-xs font-semibold text-sub">内容最大宽度 {{ draft.contentWidth ?? 1200 }}px<input v-model.number="draft.contentWidth" type="range" min="720" max="1600" step="40" class="mt-3 w-full accent-violet-500" /></label>
              <label class="block text-xs font-semibold text-sub">间距密度<select v-model="draft.spacingDensity" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="spacious">宽松</option></select></label>
            </div>

            <div v-else-if="activePanel === 'style'" class="space-y-4">
              <label class="block text-xs font-semibold text-sub">基础圆角 {{ draft.radius }}px<input v-model.number="draft.radius" type="range" min="0" max="32" class="mt-3 w-full accent-violet-500" /></label>
              <label class="block text-xs font-semibold text-sub">按钮风格<select v-model="draft.buttonStyle" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="solid">实心</option><option value="soft">柔和</option><option value="outline">描边</option></select></label>
              <label class="block text-xs font-semibold text-sub">阴影<select v-model="draft.shadow" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="none">无</option><option value="soft">轻柔</option><option value="medium">中等</option><option value="dramatic">强烈</option></select></label>
              <label class="block text-xs font-semibold text-sub">导航<select v-model="draft.navigationStyle" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="minimal">极简</option><option value="pill">胶囊</option><option value="bordered">分隔线</option></select></label>
              <label class="block text-xs font-semibold text-sub">输入框<select v-model="draft.inputStyle" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="soft">柔和底色</option><option value="outline">描边</option><option value="underline">下划线</option></select></label>
              <label class="block text-xs font-semibold text-sub">图片<select v-model="draft.imageStyle" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="square">直角</option><option value="rounded">圆角</option><option value="organic">有机形状</option></select></label>
              <label class="block text-xs font-semibold text-sub">图标<select v-model="draft.iconStyle" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-xs"><option value="outline">线性</option><option value="solid">实心</option><option value="duotone">双色</option></select></label>
            </div>

            <div v-else class="space-y-4">
              <label class="block text-xs font-semibold text-sub">公司／品牌全称<input v-model="draft.companyName" maxlength="120" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm outline-none" /></label>
              <label class="block text-xs font-semibold text-sub">公司简介<textarea v-model="draft.companyDescription" rows="5" maxlength="800" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 text-xs leading-5 outline-none" /></label>
              <label class="block text-xs font-semibold text-sub">联系邮箱<input v-model="draft.contactEmail" type="email" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm outline-none" /></label>
              <label class="block text-xs font-semibold text-sub">联系电话<input v-model="draft.contactPhone" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3 py-2.5 text-sm outline-none" /></label>
              <label class="block text-xs font-semibold text-sub">地址<textarea v-model="draft.address" rows="2" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 text-xs outline-none" /></label>
              <label class="block text-xs font-semibold text-sub">社交链接<textarea v-model="socialText" rows="5" placeholder="LinkedIn: https://…&#10;X: https://…" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3 font-mono text-[10px] leading-5 outline-none" @blur="parseSocialLinks" /></label>
            </div>
          </div>
        </aside>

        <main class="min-h-[520px] overflow-hidden bg-ink/[0.035] p-3 sm:p-5 xl:min-h-0"><div class="mx-auto h-full min-h-[500px] overflow-hidden rounded-2xl border border-line/10 bg-white shadow-2xl transition-[max-width]" :style="{maxWidth:viewportWidth}"><iframe :srcdoc="previewHtml" sandbox="allow-scripts" class="h-full min-h-[500px] w-full" title="品牌套件实时预览" /></div></main>

        <aside class="border-t border-line/10 bg-soft/62 p-5 xl:min-h-0 xl:overflow-y-auto xl:border-t-0 xl:border-l"><div class="flex items-end justify-between"><div><p class="text-[10px] font-semibold tracking-wider text-faint uppercase">品牌完整度</p><strong class="mt-2 block text-3xl">{{ qualityScore }}</strong></div><span class="rounded-full px-2.5 py-1 text-[9px] font-semibold" :class="qualityScore >= 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'">{{ qualityScore >= 80 ? '状态良好' : '继续完善' }}</span></div><div class="mt-5 space-y-2"><article v-for="item in qualityChecks" :key="item.label" class="flex gap-2 rounded-xl border border-line/8 bg-app/45 p-3"><CheckCircle2 class="mt-0.5 h-3.5 w-3.5 shrink-0" :class="item.pass ? 'text-emerald-500' : 'text-faint'" /><div><p class="text-[10px] font-semibold">{{ item.label }}</p><p class="mt-1 text-[9px] text-faint">{{ item.detail }}</p></div></article></div><div class="mt-6 rounded-2xl border border-brand1/15 bg-brand1/[0.055] p-4"><p class="text-xs font-semibold text-brand1">应用规则</p><p class="mt-2 text-[10px] leading-5 text-mut">高级字段均为可选，旧品牌套件可直接编辑。应用到项目时仍创建不可变新版本。</p></div></aside>
      </div>
    </div>
  </AppDialog>
</template>

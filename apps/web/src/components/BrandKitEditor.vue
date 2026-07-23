<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  ImagePlus,
  Laptop,
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
  Upload,
  WandSparkles,
  X,
} from 'lucide-vue-next'
import {
  BRAND_FONT_OPTIONS,
  BRAND_PRESETS,
  bestContrastText,
  brandShadow,
  contrastRatio,
  fontStack,
  isHexColor,
  type BrandKit,
  type BrandKitTokens,
  type BrandPreset,
} from 'shared'
import type { BrandKitInput } from '../lib/brandKits'

const props = defineProps<{
  open: boolean
  value?: BrandKit | null
  saving?: boolean
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'save', value: BrandKitInput): void
}>()

const rootRef = ref<HTMLElement>()
const activePanel = ref<'identity' | 'colors' | 'typography' | 'style'>('identity')
const viewport = ref<'desktop' | 'tablet' | 'mobile'>('desktop')
const showDiscard = ref(false)
const uploadError = ref('')
const original = ref('')

const emptyInput = (): BrandKitInput => ({
  name: '我的品牌',
  description: '一套可在多个项目中复用的品牌视觉规范。',
  ...structuredClone(BRAND_PRESETS[0].tokens),
  isDefault: false,
})

const draft = ref<BrandKitInput>(emptyInput())

const tabs = [
  { id: 'identity' as const, label: '品牌信息', icon: Sparkles },
  { id: 'colors' as const, label: '色彩', icon: Palette },
  { id: 'typography' as const, label: '字体', icon: Type },
  { id: 'style' as const, label: '形状与质感', icon: WandSparkles },
]

const colorFields = [
  { key: 'primary' as const, label: '主品牌色', hint: '主要按钮、链接和关键操作' },
  { key: 'secondary' as const, label: '辅助品牌色', hint: '渐变、图表和次级强调' },
  { key: 'accent' as const, label: '点缀色', hint: '小面积高亮和状态提示' },
  { key: 'background' as const, label: '页面背景', hint: '站点整体背景色' },
  { key: 'surface' as const, label: '卡片表面', hint: '卡片、弹层与信息区块' },
  { key: 'text' as const, label: '主要文字', hint: '标题和正文' },
  { key: 'muted' as const, label: '次要文字', hint: '说明、时间和弱化信息' },
]

function snapshot(input: BrandKitInput): string {
  return JSON.stringify(input)
}

function fromBrandKit(value?: BrandKit | null): BrandKitInput {
  if (!value) return emptyInput()
  const {
    id: _id,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = value
  return structuredClone(input)
}

function reset(value = props.value) {
  draft.value = fromBrandKit(value)
  original.value = snapshot(draft.value)
  activePanel.value = 'identity'
  viewport.value = 'desktop'
  uploadError.value = ''
  showDiscard.value = false
  void nextTick(() => rootRef.value?.focus())
}

const dirty = computed(() => snapshot(draft.value) !== original.value)
const colorsValid = computed(() => colorFields.every((field) => isHexColor(draft.value[field.key])))
const formValid = computed(() => Boolean(draft.value.name.trim()) && colorsValid.value)

const textContrast = computed(() => contrastRatio(draft.value.text, draft.value.background))
const surfaceContrast = computed(() => contrastRatio(draft.value.text, draft.value.surface))
const mutedContrast = computed(() => contrastRatio(draft.value.muted, draft.value.background))
const primaryButtonContrast = computed(() =>
  contrastRatio(bestContrastText(draft.value.primary), draft.value.primary),
)

const qualityChecks = computed(() => [
  {
    label: '正文对背景达到 AA',
    detail: `${textContrast.value.toFixed(2)}:1，建议至少 4.5:1`,
    pass: textContrast.value >= 4.5,
  },
  {
    label: '卡片文字清晰可读',
    detail: `${surfaceContrast.value.toFixed(2)}:1，建议至少 4.5:1`,
    pass: surfaceContrast.value >= 4.5,
  },
  {
    label: '次要文字仍可辨识',
    detail: `${mutedContrast.value.toFixed(2)}:1，建议至少 3:1`,
    pass: mutedContrast.value >= 3,
  },
  {
    label: '主按钮文字对比安全',
    detail: `${primaryButtonContrast.value.toFixed(2)}:1`,
    pass: primaryButtonContrast.value >= 4.5,
  },
  {
    label: '品牌名称完整',
    detail: draft.value.name.trim() ? '用于项目和模板快速识别' : '请填写品牌套件名称',
    pass: Boolean(draft.value.name.trim()),
  },
])

const qualityScore = computed(() => {
  const pass = qualityChecks.value.filter((item) => item.pass).length
  return Math.round((pass / qualityChecks.value.length) * 100)
})

const qualityLabel = computed(() => {
  if (qualityScore.value === 100) return '可直接应用'
  if (qualityScore.value >= 80) return '整体良好'
  if (qualityScore.value >= 60) return '建议优化'
  return '需要调整'
})

const viewportWidth = computed(() => {
  if (viewport.value === 'mobile') return '390px'
  if (viewport.value === 'tablet') return '820px'
  return '1180px'
})

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const previewHtml = computed(() => {
  const value = draft.value
  const primaryText = bestContrastText(value.primary)
  const logo = value.logoDataUrl
    ? `<img src="${value.logoDataUrl}" alt="" class="logo-image">`
    : `<span class="logo-mark">${escapeHtml(value.name.trim().slice(0, 1).toUpperCase() || 'S')}</span>`
  const shadow = brandShadow(value.shadow)
  const buttonCss = value.buttonStyle === 'solid'
    ? `background:${value.primary};color:${primaryText};border-color:${value.primary}`
    : value.buttonStyle === 'soft'
      ? `background:color-mix(in srgb,${value.primary} 14%,transparent);color:${value.primary};border-color:color-mix(in srgb,${value.primary} 30%,transparent)`
      : `background:transparent;color:${value.primary};border-color:${value.primary}`
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:${value.background};color:${value.text};font-family:${fontStack(value.bodyFont)};line-height:1.6}.shell{min-height:100vh;background:radial-gradient(circle at 84% 12%,color-mix(in srgb,${value.secondary} 18%,transparent),transparent 34%),${value.background}}nav{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(24px,6vw,88px);border-bottom:1px solid color-mix(in srgb,${value.text} 10%,transparent);background:color-mix(in srgb,${value.background} 86%,transparent);backdrop-filter:blur(16px)}.brand{display:flex;align-items:center;gap:12px;font-family:${fontStack(value.headingFont)};font-weight:800}.logo-mark,.logo-image{width:34px;height:34px;border-radius:${Math.max(8, value.radius * .55)}px}.logo-mark{display:grid;place-items:center;background:linear-gradient(135deg,${value.primary},${value.secondary});color:${bestContrastText(value.primary)}}.logo-image{object-fit:contain}.nav-actions{display:flex;align-items:center;gap:24px;color:${value.muted};font-size:14px}.hero{padding:clamp(64px,10vw,132px) clamp(24px,8vw,120px) 72px;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);align-items:center;gap:72px}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:color-mix(in srgb,${value.primary} 12%,transparent);color:${value.primary};font-weight:700;font-size:12px}.dot{width:7px;height:7px;border-radius:50%;background:${value.accent};box-shadow:0 0 0 5px color-mix(in srgb,${value.accent} 16%,transparent)}h1{font-family:${fontStack(value.headingFont)};font-size:clamp(42px,6vw,78px);line-height:1.02;letter-spacing:-.055em;margin:24px 0 22px;max-width:760px}.gradient{background:linear-gradient(110deg,${value.primary},${value.secondary});-webkit-background-clip:text;color:transparent}.lead{font-size:clamp(17px,2vw,20px);color:${value.muted};max-width:650px}.actions{display:flex;gap:12px;margin-top:34px;flex-wrap:wrap}.btn{border:1px solid;padding:13px 20px;border-radius:${value.radius}px;font:700 14px ${fontStack(value.bodyFont)};${buttonCss}}.btn.secondary{background:${value.surface};color:${value.text};border-color:color-mix(in srgb,${value.text} 14%,transparent)}.visual{position:relative;border-radius:${Math.max(16, value.radius + 8)}px;background:${value.surface};border:1px solid color-mix(in srgb,${value.text} 10%,transparent);box-shadow:${shadow};padding:18px;min-height:430px}.visual:before{content:"";position:absolute;inset:-18px;background:linear-gradient(135deg,color-mix(in srgb,${value.primary} 20%,transparent),color-mix(in srgb,${value.secondary} 18%,transparent));filter:blur(34px);z-index:-1}.browser{height:100%;border-radius:${Math.max(12, value.radius)}px;background:color-mix(in srgb,${value.background} 88%,${value.surface});overflow:hidden}.browser-top{height:48px;display:flex;align-items:center;gap:7px;padding:0 16px;border-bottom:1px solid color-mix(in srgb,${value.text} 9%,transparent)}.browser-top i{width:8px;height:8px;border-radius:50%;background:${value.muted};opacity:.45}.dashboard{padding:22px;display:grid;gap:16px}.metric{padding:18px;border-radius:${value.radius}px;background:${value.surface};border:1px solid color-mix(in srgb,${value.text} 9%,transparent)}.metric small{color:${value.muted}}.metric strong{display:block;font:800 28px ${fontStack(value.headingFont)};margin-top:8px}.chart{height:150px;border-radius:${value.radius}px;background:linear-gradient(180deg,color-mix(in srgb,${value.primary} 18%,transparent),transparent),repeating-linear-gradient(90deg,transparent 0 46px,color-mix(in srgb,${value.text} 6%,transparent) 47px)}.features{padding:20px clamp(24px,8vw,120px) 100px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.feature{padding:24px;border-radius:${value.radius}px;background:${value.surface};border:1px solid color-mix(in srgb,${value.text} 10%,transparent);box-shadow:${value.shadow==='none'?'none':'0 12px 36px color-mix(in srgb,'+value.text+' 9%,transparent)'}.feature b{font-family:${fontStack(value.headingFont)}}.feature p{color:${value.muted};font-size:14px}.icon{width:38px;height:38px;border-radius:${Math.max(8,value.radius*.65)}px;background:color-mix(in srgb,${value.primary} 13%,transparent);display:grid;place-items:center;color:${value.primary};margin-bottom:18px}@media(max-width:800px){.nav-actions span{display:none}.hero{grid-template-columns:1fr;gap:44px;padding-top:68px}.features{grid-template-columns:1fr}.visual{min-height:360px}h1{font-size:48px}}
</style></head><body><div class="shell"><nav><div class="brand">${logo}<span>${escapeHtml(value.name || '我的品牌')}</span></div><div class="nav-actions"><span>产品</span><span>案例</span><button class="btn" style="padding:9px 14px">开始体验</button></div></nav><main><section class="hero"><div><span class="eyebrow"><i class="dot"></i>品牌体验实时预览</span><h1>让每个页面都拥有<br><span class="gradient">一致的品牌表达</span></h1><p class="lead">颜色、字体、圆角与按钮风格会同步应用到项目。所有修改都以新版本保存，随时可以回滚。</p><div class="actions"><button class="btn">创建我的网站</button><button class="btn secondary">查看模板中心</button></div></div><div class="visual"><div class="browser"><div class="browser-top"><i></i><i></i><i></i></div><div class="dashboard"><div class="metric"><small>本月访问</small><strong>24,680</strong></div><div class="chart"></div></div></div></div></section><section class="features"><article class="feature"><div class="icon">✦</div><b>统一品牌系统</b><p>多个项目共享同一套视觉令牌，减少重复调整。</p></article><article class="feature"><div class="icon">Aa</div><b>清晰字体层级</b><p>标题与正文可独立配置，同时保持中文阅读体验。</p></article><article class="feature"><div class="icon">✓</div><b>自动质量检查</b><p>实时检查文字对比度，降低发布后的可读性风险。</p></article></section></main></div></body></html>`
})

function applyPreset(preset: BrandPreset) {
  draft.value = { ...draft.value, ...structuredClone(preset.tokens) }
}

function updateColor(key: keyof BrandKitTokens, value: string) {
  if (typeof draft.value[key] === 'string') Object.assign(draft.value, { [key]: value.trim().toLowerCase() })
}

function fixContrast() {
  draft.value.text = bestContrastText(draft.value.background)
  draft.value.muted = draft.value.text === '#ffffff' ? '#cbd5e1' : '#475569'
}

function removeLogo() {
  draft.value.logoDataUrl = undefined
  uploadError.value = ''
}

async function uploadLogo(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadError.value = ''
  if (!file.type.match(/^image\/(png|jpeg|webp|svg\+xml)$/)) {
    uploadError.value = '仅支持 PNG、JPG、WebP 或 SVG。'
    return
  }
  if (file.size > 512 * 1024) {
    uploadError.value = 'Logo 请控制在 512 KB 以内。'
    return
  }
  draft.value.logoDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  }).catch(() => {
    uploadError.value = 'Logo 读取失败，请重新选择。'
    return undefined
  })
}

function requestClose() {
  if (dirty.value) showDiscard.value = true
  else emit('close')
}

function discardAndClose() {
  showDiscard.value = false
  emit('close')
}

function save() {
  if (!formValid.value || props.saving) return
  emit('save', structuredClone({ ...draft.value, name: draft.value.name.trim(), description: draft.value.description.trim() }))
}

function onTabKey(event: KeyboardEvent) {
  const current = tabs.findIndex((tab) => tab.id === activePanel.value)
  let next = current
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % tabs.length
  else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = tabs.length - 1
  else return
  event.preventDefault()
  activePanel.value = tabs[next].id
  document.getElementById(`brand-tab-${tabs[next].id}`)?.focus()
}

function onWindowKey(event: KeyboardEvent) {
  if (!props.open) return
  if (event.key === 'Escape') requestClose()
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    save()
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)
watch(
  () => props.value,
  (value) => {
    if (props.open && !dirty.value) reset(value)
  },
)

window.addEventListener('keydown', onWindowKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onWindowKey))
</script>

<template>
  <Teleport to="body">
    <Transition name="brand-editor">
      <section
        v-if="open"
        ref="rootRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-editor-title"
        tabindex="-1"
        class="fixed inset-0 z-[110] flex flex-col overflow-hidden bg-app text-ink outline-none"
      >
        <header class="flex min-h-16 items-center gap-3 border-b border-line/10 bg-soft/90 px-3 py-2 backdrop-blur-xl sm:px-5">
          <button
            class="rounded-xl p-2 text-faint transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/60"
            aria-label="关闭品牌套件编辑器"
            @click="requestClose"
          >
            <ChevronLeft class="h-5 w-5" />
          </button>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 id="brand-editor-title" class="truncate text-sm font-semibold text-ink">
                {{ value ? `编辑「${value.name}」` : '创建品牌套件' }}
              </h2>
              <span v-if="dirty" class="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500">未保存</span>
            </div>
            <p class="hidden text-[11px] text-faint sm:block">配置会实时预览，保存后可应用到任意项目并生成新版本。</p>
          </div>

          <div class="ml-auto hidden items-center gap-1 rounded-xl border border-line/10 bg-ink/[0.035] p-1 md:flex" role="group" aria-label="预览尺寸">
            <button
              v-for="item in [
                { id: 'desktop', label: '桌面', icon: Monitor },
                { id: 'tablet', label: '平板', icon: Tablet },
                { id: 'mobile', label: '手机', icon: Smartphone },
              ]"
              :key="item.id"
              class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/50"
              :class="viewport === item.id ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-faint hover:text-ink'"
              :aria-pressed="viewport === item.id"
              @click="viewport = item.id as typeof viewport"
            >
              <component :is="item.icon" class="h-3.5 w-3.5" />
              <span class="hidden xl:inline">{{ item.label }}</span>
            </button>
          </div>

          <button
            class="hidden items-center gap-1.5 rounded-xl border border-line/12 px-3 py-2 text-xs font-medium text-sub hover:bg-ink/5 sm:flex"
            @click="reset()"
          >
            <RotateCcw class="h-3.5 w-3.5" />重置
          </button>
          <button
            :disabled="!formValid || saving || !dirty"
            class="bg-brand-gradient flex min-w-24 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand1/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            @click="save"
          >
            <Loader2 v-if="saving" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ saving ? '保存中' : '保存套件' }}
          </button>
        </header>

        <div class="grid min-h-0 flex-1 overflow-y-auto xl:grid-cols-[340px_minmax(0,1fr)_290px] xl:overflow-hidden">
          <aside class="border-b border-line/10 bg-soft/65 xl:min-h-0 xl:border-r xl:border-b-0">
            <div class="border-b border-line/10 p-3">
              <div
                role="tablist"
                aria-label="品牌套件设置"
                class="grid grid-cols-2 gap-1 rounded-xl bg-ink/[0.035] p-1 xl:grid-cols-1"
                @keydown="onTabKey"
              >
                <button
                  v-for="tab in tabs"
                  :id="`brand-tab-${tab.id}`"
                  :key="tab.id"
                  role="tab"
                  :aria-selected="activePanel === tab.id"
                  :aria-controls="`brand-panel-${tab.id}`"
                  :tabindex="activePanel === tab.id ? 0 : -1"
                  class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/55"
                  :class="activePanel === tab.id ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-mut hover:bg-ink/5 hover:text-ink'"
                  @click="activePanel = tab.id"
                >
                  <component :is="tab.icon" class="h-4 w-4" :class="activePanel === tab.id ? 'text-brand1' : 'text-faint'" />
                  {{ tab.label }}
                </button>
              </div>
            </div>

            <div class="max-h-[46vh] overflow-y-auto p-4 xl:max-h-none xl:min-h-0 xl:flex-1 xl:p-5">
              <div
                v-if="activePanel === 'identity'"
                id="brand-panel-identity"
                role="tabpanel"
                aria-labelledby="brand-tab-identity"
                class="space-y-5"
              >
                <div>
                  <label for="brand-name" class="mb-1.5 block text-xs font-semibold text-sub">品牌套件名称</label>
                  <input
                    id="brand-name"
                    v-model="draft.name"
                    maxlength="80"
                    autocomplete="off"
                    class="w-full rounded-xl border border-line/12 bg-app/65 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-brand1/50 focus:ring-2 focus:ring-brand1/10"
                    placeholder="例如：Acme 官方品牌"
                  />
                  <p class="mt-1.5 text-[11px] text-faint">建议使用团队或业务线名称，便于跨项目识别。</p>
                </div>
                <div>
                  <label for="brand-description" class="mb-1.5 block text-xs font-semibold text-sub">用途说明</label>
                  <textarea
                    id="brand-description"
                    v-model="draft.description"
                    maxlength="240"
                    rows="3"
                    class="w-full resize-none rounded-xl border border-line/12 bg-app/65 px-3 py-2.5 text-sm leading-6 text-ink outline-none transition-colors placeholder:text-faint focus:border-brand1/50 focus:ring-2 focus:ring-brand1/10"
                    placeholder="这套品牌规范适用于哪些项目？"
                  />
                  <p class="mt-1 text-right text-[10px] text-faint">{{ draft.description.length }}/240</p>
                </div>

                <div>
                  <span class="mb-2 block text-xs font-semibold text-sub">品牌 Logo</span>
                  <div class="rounded-2xl border border-dashed border-line/15 bg-app/45 p-3">
                    <div v-if="draft.logoDataUrl" class="flex items-center gap-3">
                      <span class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-line/10 bg-white p-1.5">
                        <img :src="draft.logoDataUrl" alt="当前品牌 Logo" class="max-h-full max-w-full object-contain" />
                      </span>
                      <div class="min-w-0 flex-1">
                        <p class="text-xs font-medium text-ink">Logo 已上传</p>
                        <p class="mt-1 text-[10px] text-faint">将用于模板预览和后续站点品牌区。</p>
                      </div>
                      <button class="rounded-lg p-2 text-faint hover:bg-red-500/10 hover:text-red-500" aria-label="移除 Logo" @click="removeLogo">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </div>
                    <label v-else class="flex cursor-pointer flex-col items-center py-5 text-center">
                      <span class="grid h-11 w-11 place-items-center rounded-xl bg-brand1/10 text-brand1"><ImagePlus class="h-5 w-5" /></span>
                      <span class="mt-3 text-xs font-medium text-ink">上传 Logo</span>
                      <span class="mt-1 text-[10px] text-faint">PNG、JPG、WebP 或 SVG，最大 512 KB</span>
                      <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only" @change="uploadLogo" />
                    </label>
                  </div>
                  <p v-if="uploadError" class="mt-2 flex items-center gap-1.5 text-[11px] text-red-500"><AlertTriangle class="h-3.5 w-3.5" />{{ uploadError }}</p>
                </div>

                <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-line/10 bg-app/45 p-3">
                  <input v-model="draft.isDefault" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-line/20 text-brand1 focus:ring-brand1/30" />
                  <span>
                    <span class="block text-xs font-medium text-ink">设为默认品牌套件</span>
                    <span class="mt-1 block text-[10px] leading-4 text-faint">创建新项目或从模板开始时优先推荐此套件。</span>
                  </span>
                </label>
              </div>

              <div
                v-else-if="activePanel === 'colors'"
                id="brand-panel-colors"
                role="tabpanel"
                aria-labelledby="brand-tab-colors"
                class="space-y-4"
              >
                <div class="rounded-xl border border-brand1/15 bg-brand1/[0.055] p-3">
                  <p class="flex items-center gap-1.5 text-xs font-semibold text-brand1"><Sparkles class="h-3.5 w-3.5" />快速主题</p>
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <button
                      v-for="preset in BRAND_PRESETS"
                      :key="preset.id"
                      class="group rounded-xl border border-line/10 bg-app/70 p-2 text-left transition-all hover:-translate-y-0.5 hover:border-brand1/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/50"
                      :title="preset.description"
                      @click="applyPreset(preset)"
                    >
                      <span class="flex h-6 overflow-hidden rounded-md">
                        <i class="flex-1" :style="{ background: preset.tokens.primary }" />
                        <i class="flex-1" :style="{ background: preset.tokens.secondary }" />
                        <i class="flex-1" :style="{ background: preset.tokens.background }" />
                      </span>
                      <span class="mt-1.5 block truncate text-[9px] font-medium text-sub">{{ preset.name }}</span>
                    </button>
                  </div>
                </div>

                <div v-for="field in colorFields" :key="field.key">
                  <label :for="`brand-color-${field.key}`" class="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-sub">
                    <span>{{ field.label }}</span>
                    <span v-if="!isHexColor(draft[field.key])" class="text-[10px] font-normal text-red-500">格式无效</span>
                  </label>
                  <div class="flex items-center gap-2 rounded-xl border bg-app/65 p-2 transition-colors" :class="isHexColor(draft[field.key]) ? 'border-line/12 focus-within:border-brand1/45' : 'border-red-500/35'">
                    <input
                      :value="draft[field.key]"
                      type="color"
                      class="h-9 w-11 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      :aria-label="`${field.label}取色器`"
                      @input="updateColor(field.key, ($event.target as HTMLInputElement).value)"
                    />
                    <input
                      :id="`brand-color-${field.key}`"
                      :value="draft[field.key]"
                      maxlength="7"
                      spellcheck="false"
                      class="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-ink outline-none"
                      @input="updateColor(field.key, ($event.target as HTMLInputElement).value)"
                    />
                  </div>
                  <p class="mt-1 text-[10px] text-faint">{{ field.hint }}</p>
                </div>

                <button
                  v-if="textContrast < 4.5 || mutedContrast < 3"
                  class="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/[0.13]"
                  @click="fixContrast"
                >
                  <WandSparkles class="h-4 w-4" />自动修复文字对比度
                </button>
              </div>

              <div
                v-else-if="activePanel === 'typography'"
                id="brand-panel-typography"
                role="tabpanel"
                aria-labelledby="brand-tab-typography"
                class="space-y-6"
              >
                <fieldset>
                  <legend class="text-xs font-semibold text-sub">标题字体</legend>
                  <p class="mt-1 text-[10px] text-faint">用于首屏标题、区块标题和关键数字。</p>
                  <div class="mt-3 space-y-2">
                    <label
                      v-for="font in BRAND_FONT_OPTIONS"
                      :key="font.id"
                      class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all"
                      :class="draft.headingFont === font.id ? 'border-brand1/35 bg-brand1/[0.07]' : 'border-line/10 bg-app/45 hover:border-line/20'"
                    >
                      <input v-model="draft.headingFont" type="radio" :value="font.id" class="sr-only" />
                      <span class="min-w-0 flex-1">
                        <span class="block text-xs font-medium text-ink">{{ font.name }}</span>
                        <span class="mt-1 block truncate text-lg text-sub" :style="{ fontFamily: font.stack }">品牌，让表达更清晰</span>
                      </span>
                      <Check v-if="draft.headingFont === font.id" class="h-4 w-4 shrink-0 text-brand1" />
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-semibold text-sub">正文字体</legend>
                  <p class="mt-1 text-[10px] text-faint">用于段落、按钮、表单和辅助信息。</p>
                  <select
                    v-model="draft.bodyFont"
                    class="mt-3 w-full rounded-xl border border-line/12 bg-app/65 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/50 focus:ring-2 focus:ring-brand1/10"
                  >
                    <option v-for="font in BRAND_FONT_OPTIONS" :key="font.id" :value="font.id">{{ font.name }}</option>
                  </select>
                </fieldset>
              </div>

              <div
                v-else
                id="brand-panel-style"
                role="tabpanel"
                aria-labelledby="brand-tab-style"
                class="space-y-6"
              >
                <div>
                  <div class="flex items-center justify-between">
                    <label for="brand-radius" class="text-xs font-semibold text-sub">圆角尺度</label>
                    <span class="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-[10px] text-faint">{{ draft.radius }}px</span>
                  </div>
                  <input id="brand-radius" v-model.number="draft.radius" type="range" min="0" max="32" step="2" class="mt-3 w-full accent-brand1" />
                  <div class="mt-3 flex items-end justify-between rounded-xl border border-line/10 bg-app/45 p-3">
                    <span v-for="size in [0, 8, 16, 24]" :key="size" class="grid h-11 w-11 place-items-center border border-brand1/30 bg-brand1/8 text-[9px] text-faint" :style="{ borderRadius: `${size}px` }">{{ size }}</span>
                  </div>
                </div>

                <fieldset>
                  <legend class="text-xs font-semibold text-sub">按钮风格</legend>
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <label
                      v-for="option in [
                        { id: 'solid', label: '实心' },
                        { id: 'soft', label: '柔和' },
                        { id: 'outline', label: '描边' },
                      ]"
                      :key="option.id"
                      class="cursor-pointer rounded-xl border p-3 text-center text-xs transition-colors"
                      :class="draft.buttonStyle === option.id ? 'border-brand1/35 bg-brand1/[0.08] font-semibold text-brand1' : 'border-line/10 bg-app/45 text-mut hover:text-ink'"
                    >
                      <input v-model="draft.buttonStyle" type="radio" :value="option.id" class="sr-only" />
                      {{ option.label }}
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="text-xs font-semibold text-sub">阴影质感</legend>
                  <div class="mt-3 grid grid-cols-2 gap-2">
                    <label
                      v-for="option in [
                        { id: 'none', label: '无阴影' },
                        { id: 'soft', label: '轻柔' },
                        { id: 'medium', label: '层次' },
                        { id: 'dramatic', label: '强烈' },
                      ]"
                      :key="option.id"
                      class="cursor-pointer rounded-xl border bg-app/55 p-3 transition-all"
                      :class="draft.shadow === option.id ? 'border-brand1/35 ring-2 ring-brand1/8' : 'border-line/10 hover:border-line/20'"
                    >
                      <input v-model="draft.shadow" type="radio" :value="option.id" class="sr-only" />
                      <span class="mb-3 block h-10 rounded-lg bg-soft" :style="{ boxShadow: brandShadow(option.id as typeof draft.shadow) }" />
                      <span class="text-[11px] font-medium text-sub">{{ option.label }}</span>
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>
          </aside>

          <main class="relative min-h-[620px] min-w-0 overflow-auto bg-ink/[0.04] p-3 sm:p-6 xl:min-h-0">
            <div class="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:24px_24px] text-line/20" />
            <div class="relative mx-auto flex min-h-full items-center justify-center">
              <div
                class="w-full overflow-hidden rounded-2xl border border-line/15 bg-white shadow-2xl shadow-black/20 transition-[max-width] duration-300"
                :style="{ maxWidth: viewportWidth }"
              >
                <div class="flex h-9 items-center gap-1.5 border-b border-black/8 bg-zinc-100 px-3">
                  <i class="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <i class="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <i class="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span class="ml-3 truncate rounded-md bg-white/80 px-3 py-1 text-[9px] text-zinc-400">preview.siteforge.local</span>
                </div>
                <iframe
                  :srcdoc="previewHtml"
                  sandbox=""
                  referrerpolicy="no-referrer"
                  class="h-[680px] w-full bg-white"
                  title="品牌套件实时预览"
                />
              </div>
            </div>
          </main>

          <aside class="border-t border-line/10 bg-soft/65 p-4 xl:min-h-0 xl:overflow-y-auto xl:border-t-0 xl:border-l xl:p-5">
            <div class="rounded-2xl border border-line/10 bg-app/55 p-4">
              <div class="flex items-center gap-4">
                <div class="relative grid h-16 w-16 shrink-0 place-items-center rounded-full" :style="{ background: `conic-gradient(rgb(var(--c-brand1)) ${qualityScore * 3.6}deg, rgb(var(--c-line) / .08) 0)` }">
                  <div class="grid h-12 w-12 place-items-center rounded-full bg-soft text-sm font-bold text-ink">{{ qualityScore }}</div>
                </div>
                <div>
                  <p class="text-xs font-semibold text-ink">品牌质量</p>
                  <p class="mt-1 text-sm font-bold" :class="qualityScore >= 80 ? 'text-emerald-500' : qualityScore >= 60 ? 'text-amber-500' : 'text-red-500'">{{ qualityLabel }}</p>
                  <p class="mt-1 text-[10px] text-faint">保存前检查基础可读性与完整性。</p>
                </div>
              </div>
            </div>

            <div class="mt-5 space-y-2">
              <div
                v-for="check in qualityChecks"
                :key="check.label"
                class="rounded-xl border p-3"
                :class="check.pass ? 'border-emerald-500/15 bg-emerald-500/[0.045]' : 'border-amber-500/20 bg-amber-500/[0.055]'"
              >
                <div class="flex items-start gap-2.5">
                  <CheckCircle2 v-if="check.pass" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <AlertTriangle v-else class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div>
                    <p class="text-[11px] font-medium text-ink">{{ check.label }}</p>
                    <p class="mt-1 text-[10px] leading-4 text-faint">{{ check.detail }}</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-5 rounded-xl border border-line/10 bg-app/45 p-3">
              <p class="flex items-center gap-1.5 text-[11px] font-semibold text-sub"><CircleHelp class="h-3.5 w-3.5 text-brand2" />应用原则</p>
              <ul class="mt-2 space-y-1.5 text-[10px] leading-4 text-faint">
                <li>• 修改会作为项目新版本保存，不覆盖历史。</li>
                <li>• 颜色优先写入 CSS Token，并提供安全回退。</li>
                <li>• 字体使用系统字体栈，不引入外部追踪资源。</li>
              </ul>
            </div>
          </aside>
        </div>

        <Transition name="confirm">
          <div v-if="showDiscard" class="absolute inset-0 z-20 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" @click.self="showDiscard = false">
            <div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" class="w-full max-w-sm rounded-2xl border border-line/10 bg-soft p-5 shadow-2xl">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle class="h-5 w-5" /></div>
              <h3 id="discard-title" class="mt-4 text-base font-semibold text-ink">放弃未保存的修改？</h3>
              <p class="mt-2 text-sm leading-6 text-mut">当前调整尚未保存，关闭后无法恢复。</p>
              <div class="mt-5 flex justify-end gap-2">
                <button class="rounded-xl border border-line/12 px-4 py-2.5 text-sm text-sub hover:bg-ink/5" @click="showDiscard = false">继续编辑</button>
                <button class="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600" @click="discardAndClose">放弃修改</button>
              </div>
            </div>
          </div>
        </Transition>
      </section>
    </Transition>
  </Teleport>
</template>

<style scoped>
.brand-editor-enter-active,.brand-editor-leave-active{transition:opacity .18s ease}.brand-editor-enter-from,.brand-editor-leave-to{opacity:0}.confirm-enter-active,.confirm-leave-active{transition:opacity .15s ease,transform .15s ease}.confirm-enter-from,.confirm-leave-to{opacity:0;transform:scale(.98)}
</style>

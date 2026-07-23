<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Check,
  CopyPlus,
  Crown,
  Loader2,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
} from 'lucide-vue-next'
import { BRAND_PRESETS, applyBrandKitToHtml, type BrandKit, type BrandPreset } from 'shared'
import BrandKitEditor from '../components/BrandKitEditor.vue'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import {
  createBrandKit,
  deleteBrandKit,
  listBrandKits,
  setDefaultBrandKit,
  updateBrandKit,
  type BrandKitInput,
} from '../lib/brandKits'
import { addProjectVersion, getProjectVersion } from '../lib/workspace'

const route = useRoute()
const router = useRouter()
const { isAuthenticated, loading: authLoading } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()

const kits = ref<BrandKit[]>([])
const loading = ref(false)
const actionBusy = ref('')
const editorOpen = ref(false)
const editing = ref<BrandKit | null>(null)
const pendingDelete = ref<BrandKit | null>(null)
const openMenu = ref('')
const error = ref('')

const contextProjectId = computed(() => typeof route.query.project === 'string' ? route.query.project : '')
const contextVersionId = computed(() => typeof route.query.version === 'string' ? route.query.version : '')
const hasProjectContext = computed(() => Boolean(contextProjectId.value && contextVersionId.value))
const defaultKit = computed(() => kits.value.find((kit) => kit.isDefault) ?? null)

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '操作失败，请稍后重试'
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

async function load() {
  if (!isAuthenticated.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    kits.value = await listBrandKits()
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

function createFromPreset(preset?: BrandPreset) {
  const now = new Date().toISOString()
  editing.value = preset
    ? {
        id: '',
        name: preset.name,
        description: preset.description,
        ...structuredClone(preset.tokens),
        isDefault: kits.value.length === 0,
        createdAt: now,
        updatedAt: now,
      }
    : null
  editorOpen.value = true
}

function edit(kit: BrandKit) {
  openMenu.value = ''
  editing.value = structuredClone(kit)
  editorOpen.value = true
}

function duplicate(kit: BrandKit) {
  openMenu.value = ''
  editing.value = {
    ...structuredClone(kit),
    id: '',
    name: `${kit.name} 副本`,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  editorOpen.value = true
}

async function save(input: BrandKitInput) {
  actionBusy.value = 'save'
  try {
    const saved = editing.value?.id
      ? await updateBrandKit(editing.value.id, input)
      : await createBrandKit(input)
    editorOpen.value = false
    editing.value = null
    await load()
    toast.success(editing.value?.id ? '品牌套件已更新' : '品牌套件已创建', `「${saved.name}」现在可以应用到项目。`)
  } catch (err) {
    toast.error('保存失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function makeDefault(kit: BrandKit) {
  openMenu.value = ''
  if (kit.isDefault) return
  actionBusy.value = `default:${kit.id}`
  try {
    await setDefaultBrandKit(kit.id)
    await load()
    toast.success('默认品牌已更新', `新项目将优先推荐「${kit.name}」。`)
  } catch (err) {
    toast.error('设置失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function remove() {
  const kit = pendingDelete.value
  if (!kit) return
  actionBusy.value = `delete:${kit.id}`
  try {
    await deleteBrandKit(kit.id)
    pendingDelete.value = null
    await load()
    toast.success('品牌套件已删除')
  } catch (err) {
    toast.error('删除失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

async function applyToProject(kit: BrandKit) {
  if (!hasProjectContext.value) return
  actionBusy.value = `apply:${kit.id}`
  try {
    const version = await getProjectVersion(contextProjectId.value, contextVersionId.value)
    const html = applyBrandKitToHtml(version.html, kit)
    const created = await addProjectVersion(contextProjectId.value, {
      html,
      source: 'editor',
      instruction: `应用品牌套件「${kit.name}」`,
    })
    toast.success('品牌套件已应用', `已创建第 ${created.version} 版，原版本保持不变。`)
    await router.push({
      name: 'project-detail',
      params: { id: contextProjectId.value },
      query: { version: created.id },
    })
  } catch (err) {
    toast.error('应用失败', messageOf(err))
  } finally {
    actionBusy.value = ''
  }
}

watch(isAuthenticated, (value) => value && void load())
onMounted(load)
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-20 pb-20">
    <div v-if="authLoading && !isAuthenticated" class="flex min-h-[60vh] items-center justify-center">
      <Loader2 class="h-7 w-7 animate-spin text-brand1" />
    </div>

    <section v-else-if="!isAuthenticated" class="mx-auto mt-16 max-w-lg px-4 text-center">
      <div class="rounded-3xl border border-line/10 bg-soft/70 p-10 shadow-xl shadow-black/5">
        <span class="bg-brand-gradient mx-auto grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg shadow-brand1/25">
          <Palette class="h-6 w-6" />
        </span>
        <h1 class="mt-5 text-xl font-semibold text-ink">登录后管理品牌套件</h1>
        <p class="mt-2 text-sm leading-6 text-mut">保存颜色、字体和视觉规范，在多个项目之间一键复用。</p>
        <button class="bg-brand-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="showAuth">
          <UserRound class="h-4 w-4" />登录 SiteForge
        </button>
      </div>
    </section>

    <div v-else class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div v-if="hasProjectContext" class="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-brand1/18 bg-brand1/[0.055] px-4 py-3">
        <button class="rounded-lg p-1.5 text-brand1 hover:bg-brand1/10" aria-label="返回项目" @click="router.back()">
          <ArrowLeft class="h-4 w-4" />
        </button>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold text-brand1">正在为项目选择品牌套件</p>
          <p class="mt-0.5 text-[11px] text-mut">应用后会创建新版本，不会覆盖当前页面。</p>
        </div>
        <span class="rounded-full bg-brand1/10 px-3 py-1 text-[10px] font-medium text-brand1">安全版本化</span>
      </div>

      <header class="relative overflow-hidden rounded-[28px] border border-line/10 bg-soft/65 px-5 py-7 sm:px-8 sm:py-9">
        <div class="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-brand1/15 blur-3xl" />
        <div class="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-brand2/10 blur-3xl" />
        <div class="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div class="max-w-2xl">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-brand1/20 bg-brand1/[0.07] px-3 py-1 text-[11px] font-semibold text-brand1">
              <Sparkles class="h-3.5 w-3.5" />品牌工作台
            </span>
            <h1 class="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">让每个项目都保持同一种品牌语言</h1>
            <p class="mt-3 max-w-xl text-sm leading-7 text-mut">集中维护 Logo、颜色、字体、圆角和按钮风格。实时检查可读性，并以安全的新版本方式应用到项目。</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              :disabled="loading"
              class="rounded-xl border border-line/12 bg-app/45 p-2.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
              title="刷新品牌套件"
              @click="load"
            >
              <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
            </button>
            <button class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/20 hover:brightness-110" @click="createFromPreset()">
              <Plus class="h-4 w-4" />创建品牌套件
            </button>
          </div>
        </div>

        <div class="relative mt-7 grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-line/10 bg-app/45 p-4 backdrop-blur">
            <p class="text-[10px] font-medium tracking-wider text-faint uppercase">品牌套件</p>
            <p class="mt-2 text-2xl font-bold text-ink">{{ kits.length }}</p>
            <p class="mt-1 text-[11px] text-mut">可跨项目复用</p>
          </div>
          <div class="rounded-2xl border border-line/10 bg-app/45 p-4 backdrop-blur">
            <p class="text-[10px] font-medium tracking-wider text-faint uppercase">默认套件</p>
            <p class="mt-2 truncate text-sm font-semibold text-ink">{{ defaultKit?.name || '尚未设置' }}</p>
            <p class="mt-1 text-[11px] text-mut">用于模板和新项目推荐</p>
          </div>
          <div class="rounded-2xl border border-line/10 bg-app/45 p-4 backdrop-blur">
            <p class="text-[10px] font-medium tracking-wider text-faint uppercase">内置方向</p>
            <p class="mt-2 text-2xl font-bold text-ink">{{ BRAND_PRESETS.length }}</p>
            <p class="mt-1 text-[11px] text-mut">可作为创建起点</p>
          </div>
        </div>
      </header>

      <div v-if="error" class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">
        {{ error }}
      </div>

      <section class="mt-8">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-ink">我的品牌套件</h2>
            <p class="mt-1 text-xs text-faint">默认套件会优先出现在模板和项目工作流中。</p>
          </div>
        </div>

        <div v-if="loading && kits.length === 0" class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div v-for="index in 3" :key="index" class="h-64 animate-pulse rounded-2xl border border-line/8 bg-soft/60" />
        </div>

        <div v-else-if="kits.length" class="stagger mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="kit in kits"
            :key="kit.id"
            class="group relative overflow-hidden rounded-2xl border border-line/10 bg-soft/65 transition-all duration-300 hover:-translate-y-1 hover:border-brand1/25 hover:shadow-xl hover:shadow-brand1/8"
          >
            <div class="h-2" :style="{ background: `linear-gradient(90deg,${kit.primary},${kit.secondary},${kit.accent})` }" />
            <div class="p-5">
              <div class="flex items-start gap-3">
                <span class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line/10 bg-app/70 shadow-sm">
                  <img v-if="kit.logoDataUrl" :src="kit.logoDataUrl" alt="" class="max-h-full max-w-full object-contain p-1.5" />
                  <span v-else class="text-lg font-bold" :style="{ color: kit.primary }">{{ kit.name.slice(0, 1).toUpperCase() }}</span>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="truncate text-sm font-semibold text-ink">{{ kit.name }}</h3>
                    <span v-if="kit.isDefault" class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold text-amber-500">
                      <Crown class="h-3 w-3" />默认
                    </span>
                  </div>
                  <p class="mt-1 line-clamp-2 min-h-9 text-[11px] leading-[18px] text-mut">{{ kit.description || '暂无说明' }}</p>
                </div>
                <div class="relative">
                  <button class="rounded-lg p-2 text-faint hover:bg-ink/5 hover:text-ink" :aria-expanded="openMenu === kit.id" aria-label="更多操作" @click="openMenu = openMenu === kit.id ? '' : kit.id">
                    <MoreHorizontal class="h-4 w-4" />
                  </button>
                  <div v-if="openMenu === kit.id" class="absolute top-10 right-0 z-10 w-40 rounded-xl border border-line/10 bg-soft/95 p-1.5 shadow-xl backdrop-blur-xl">
                    <button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-sub hover:bg-ink/5 hover:text-ink" @click="edit(kit)"><Pencil class="h-3.5 w-3.5" />编辑</button>
                    <button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-sub hover:bg-ink/5 hover:text-ink" @click="duplicate(kit)"><CopyPlus class="h-3.5 w-3.5" />创建副本</button>
                    <button v-if="!kit.isDefault" class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-sub hover:bg-ink/5 hover:text-ink" @click="makeDefault(kit)"><Crown class="h-3.5 w-3.5" />设为默认</button>
                    <button class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-red-500 hover:bg-red-500/[0.07]" @click="((openMenu = ''), (pendingDelete = kit))"><Trash2 class="h-3.5 w-3.5" />删除</button>
                  </div>
                </div>
              </div>

              <div class="mt-5 flex gap-2">
                <span v-for="color in [kit.primary, kit.secondary, kit.accent, kit.background, kit.surface]" :key="color" class="h-8 flex-1 rounded-lg border border-black/5 shadow-inner" :style="{ background: color }" :title="color" />
              </div>

              <div class="mt-4 flex items-center justify-between text-[10px] text-faint">
                <span>{{ kit.radius }}px 圆角 · {{ kit.shadow }}</span>
                <span>{{ formatDate(kit.updatedAt) }}</span>
              </div>

              <div class="mt-5 grid gap-2" :class="hasProjectContext ? 'grid-cols-[1fr_auto]' : 'grid-cols-1'">
                <button
                  v-if="hasProjectContext"
                  :disabled="actionBusy === `apply:${kit.id}`"
                  class="bg-brand-gradient flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white shadow-md shadow-brand1/15 disabled:opacity-50"
                  @click="applyToProject(kit)"
                >
                  <Loader2 v-if="actionBusy === `apply:${kit.id}`" class="h-3.5 w-3.5 animate-spin" />
                  <WandSparkles v-else class="h-3.5 w-3.5" />应用到项目
                </button>
                <button class="flex items-center justify-center gap-2 rounded-xl border border-line/12 bg-app/45 px-3 py-2.5 text-xs font-medium text-sub hover:border-brand1/25 hover:text-brand1" @click="edit(kit)">
                  <Pencil class="h-3.5 w-3.5" />编辑
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="mt-5 rounded-[28px] border border-dashed border-line/15 bg-soft/45 px-5 py-14 text-center">
          <span class="bg-brand-gradient mx-auto grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg shadow-brand1/20"><Palette class="h-6 w-6" /></span>
          <h3 class="mt-5 text-base font-semibold text-ink">创建第一套品牌规范</h3>
          <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-mut">从预设开始只需几分钟。完成后可直接用于模板或现有项目。</p>
          <button class="bg-brand-gradient mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="createFromPreset(BRAND_PRESETS[0])">
            <Sparkles class="h-4 w-4" />使用推荐预设
          </button>
        </div>
      </section>

      <section class="mt-12">
        <div>
          <h2 class="text-lg font-semibold text-ink">从成熟方向开始</h2>
          <p class="mt-1 text-xs text-faint">每套预设均经过基础对比度检查，可继续调整为你的品牌。</p>
        </div>
        <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="preset in BRAND_PRESETS"
            :key="preset.id"
            class="group rounded-2xl border border-line/10 bg-soft/55 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand1/25 hover:shadow-lg"
            @click="createFromPreset(preset)"
          >
            <span class="flex h-16 overflow-hidden rounded-xl border border-line/8">
              <i class="flex-1" :style="{ background: preset.tokens.primary }" />
              <i class="flex-1" :style="{ background: preset.tokens.secondary }" />
              <i class="flex-1" :style="{ background: preset.tokens.accent }" />
              <i class="flex-1" :style="{ background: preset.tokens.background }" />
            </span>
            <span class="mt-3 flex items-center justify-between gap-3">
              <span>
                <span class="block text-sm font-semibold text-ink">{{ preset.name }}</span>
                <span class="mt-1 line-clamp-2 block text-[11px] leading-5 text-mut">{{ preset.description }}</span>
              </span>
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand1/8 text-brand1 transition-transform group-hover:rotate-6 group-hover:scale-105"><Plus class="h-4 w-4" /></span>
            </span>
          </button>
        </div>
      </section>
    </div>

    <BrandKitEditor
      :open="editorOpen"
      :value="editing"
      :saving="actionBusy === 'save'"
      @close="((editorOpen = false), (editing = null))"
      @save="save"
    />

    <Transition name="confirm">
      <div v-if="pendingDelete" class="fixed inset-0 z-[120] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" @click.self="pendingDelete = null">
        <div role="alertdialog" aria-modal="true" aria-labelledby="delete-brand-title" class="w-full max-w-sm rounded-2xl border border-line/10 bg-soft p-5 shadow-2xl">
          <div class="grid h-10 w-10 place-items-center rounded-xl bg-red-500/10 text-red-500"><Trash2 class="h-5 w-5" /></div>
          <h3 id="delete-brand-title" class="mt-4 text-base font-semibold text-ink">删除「{{ pendingDelete.name }}」？</h3>
          <p class="mt-2 text-sm leading-6 text-mut">已应用到项目的版本不会改变，但该品牌套件将无法继续复用。</p>
          <div class="mt-5 flex justify-end gap-2">
            <button class="rounded-xl border border-line/12 px-4 py-2.5 text-sm text-sub hover:bg-ink/5" @click="pendingDelete = null">取消</button>
            <button :disabled="actionBusy === `delete:${pendingDelete.id}`" class="flex min-w-24 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50" @click="remove">
              <Loader2 v-if="actionBusy === `delete:${pendingDelete.id}`" class="h-4 w-4 animate-spin" />
              <Trash2 v-else class="h-4 w-4" />删除
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.confirm-enter-active,.confirm-leave-active{transition:opacity .15s ease,transform .15s ease}.confirm-enter-from,.confirm-leave-to{opacity:0;transform:scale(.98)}
</style>

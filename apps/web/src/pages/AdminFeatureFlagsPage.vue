<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  ChevronDown,
  FlaskConical,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import {
  listAdminFeatureFlags,
  updateAdminFeatureFlag,
  type AdminFeatureFlag,
} from '../lib/admin'
import type { UserRole } from '../lib/rbac'

interface FlagDraft {
  enabled: boolean
  rolloutPercent: number
  description: string
  roles: UserRole[]
  emails: string
  userIds: string
  startsAt: string
  expiresAt: string
}

const router = useRouter()
const { isAuthenticated, isOperator, hasPermission, loading: authLoading } = useAuth()
const toast = useToast()
const flags = ref<AdminFeatureFlag[]>([])
const drafts = ref<Record<string, FlagDraft>>({})
const loading = ref(false)
const savingKey = ref('')
const error = ref('')
const category = ref('all')

const canWrite = computed(() => hasPermission('feature_flags.write'))
const visibleFlags = computed(() => category.value === 'all'
  ? flags.value
  : flags.value.filter((item) => item.category === category.value))

function messageOf(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function localDateTime(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toIso(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function draftFor(flag: AdminFeatureFlag): FlagDraft {
  return {
    enabled: flag.enabled,
    rolloutPercent: flag.rolloutPercent,
    description: flag.description,
    roles: [...(flag.rules.roles ?? [])],
    emails: (flag.rules.emails ?? []).join('\n'),
    userIds: (flag.rules.userIds ?? []).join('\n'),
    startsAt: localDateTime(flag.startsAt),
    expiresAt: localDateTime(flag.expiresAt),
  }
}

function resetDrafts() {
  drafts.value = Object.fromEntries(flags.value.map((flag) => [flag.key, draftFor(flag)]))
}

function listFromText(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))]
}

function isDirty(flag: AdminFeatureFlag): boolean {
  const draft = drafts.value[flag.key]
  if (!draft) return false
  return JSON.stringify({
    enabled: draft.enabled,
    rolloutPercent: draft.rolloutPercent,
    description: draft.description.trim(),
    roles: [...draft.roles].sort(),
    emails: listFromText(draft.emails).map((item) => item.toLowerCase()).sort(),
    userIds: listFromText(draft.userIds).sort(),
    startsAt: toIso(draft.startsAt),
    expiresAt: toIso(draft.expiresAt),
  }) !== JSON.stringify({
    enabled: flag.enabled,
    rolloutPercent: flag.rolloutPercent,
    description: flag.description.trim(),
    roles: [...(flag.rules.roles ?? [])].sort(),
    emails: [...(flag.rules.emails ?? [])].map((item) => item.toLowerCase()).sort(),
    userIds: [...(flag.rules.userIds ?? [])].sort(),
    startsAt: flag.startsAt ?? null,
    expiresAt: flag.expiresAt ?? null,
  })
}

function categoryLabel(value: AdminFeatureFlag['category']): string {
  return { experience: '体验', creation: '创作', publishing: '发布', operations: '运营' }[value]
}

function toggleRole(flag: AdminFeatureFlag, role: UserRole) {
  if (!canWrite.value) return
  const draft = drafts.value[flag.key]
  if (!draft) return
  draft.roles = draft.roles.includes(role)
    ? draft.roles.filter((item) => item !== role)
    : [...draft.roles, role]
}

async function load() {
  if (!isOperator.value || !hasPermission('feature_flags.read')) return
  loading.value = true
  error.value = ''
  try {
    flags.value = await listAdminFeatureFlags()
    resetDrafts()
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

async function save(flag: AdminFeatureFlag) {
  const draft = drafts.value[flag.key]
  if (!draft || !canWrite.value || !isDirty(flag)) return
  if (
    flag.enabled && !draft.enabled &&
    ['official-templates', 'site-publishing'].includes(flag.key) &&
    !window.confirm(`关闭「${flag.name}」会立即影响用户入口，确定继续吗？`)
  ) return

  savingKey.value = flag.key
  try {
    const updated = await updateAdminFeatureFlag(flag.key, {
      enabled: draft.enabled,
      rolloutPercent: draft.rolloutPercent,
      description: draft.description.trim(),
      rules: {
        roles: draft.roles,
        emails: listFromText(draft.emails).map((item) => item.toLowerCase()),
        userIds: listFromText(draft.userIds),
      },
      startsAt: toIso(draft.startsAt),
      expiresAt: toIso(draft.expiresAt),
      expectedVersion: flag.version,
    })
    flags.value = flags.value.map((item) => item.key === updated.key ? updated : item)
    drafts.value[updated.key] = draftFor(updated)
    toast.success('功能开关已更新', `${updated.name} · ${updated.enabled ? `${updated.rolloutPercent}% 灰度` : '已关闭'}`)
  } catch (err) {
    toast.error('保存失败', messageOf(err))
    if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') await load()
  } finally {
    savingKey.value = ''
  }
}

onMounted(() => void load())
</script>

<template>
  <main class="min-h-screen bg-app pt-16 text-ink">
    <div v-if="authLoading" class="flex min-h-[70vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>

    <section v-else-if="!isAuthenticated || !isOperator || !hasPermission('feature_flags.read')" class="mx-auto flex min-h-[72vh] max-w-xl items-center px-4 text-center">
      <div class="w-full rounded-3xl border border-line/10 bg-soft/65 p-9 shadow-2xl shadow-black/5">
        <LockKeyhole class="mx-auto h-10 w-10 text-amber-500" />
        <h1 class="mt-5 text-2xl font-bold">没有功能开关权限</h1>
        <p class="mt-3 text-sm leading-7 text-mut">功能开关涉及全局灰度和紧急停用，仅授权运营角色可以访问。</p>
        <RouterLink to="/" class="mt-6 inline-flex rounded-xl border border-line/12 px-5 py-3 text-sm font-semibold text-sub">返回首页</RouterLink>
      </div>
    </section>

    <div v-else class="mx-auto max-w-[1380px] px-4 py-7 sm:px-6 lg:px-8">
      <header class="flex flex-wrap items-start justify-between gap-4 border-b border-line/10 pb-6">
        <div>
          <button class="flex items-center gap-1.5 text-xs font-medium text-mut hover:text-ink" @click="router.push('/admin')"><ArrowLeft class="h-3.5 w-3.5" />运营控制台</button>
          <div class="mt-4 flex items-center gap-3"><span class="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-500/10 text-cyan-500"><FlaskConical class="h-5 w-5" /></span><div><h1 class="text-2xl font-bold tracking-tight sm:text-3xl">功能开关与灰度</h1><p class="mt-1 text-sm text-mut">控制能力开放范围、定向人群和生效窗口。</p></div></div>
        </div>
        <div class="flex items-center gap-2"><span v-if="!canWrite" class="rounded-full bg-sky-500/10 px-3 py-1.5 text-[10px] font-semibold text-sky-500">只读模式</span><button :disabled="loading" class="flex items-center gap-2 rounded-xl border border-line/12 bg-soft/55 px-3.5 py-2.5 text-xs font-semibold text-sub disabled:opacity-50" @click="load"><RefreshCw class="h-3.5 w-3.5" :class="loading && 'animate-spin'" />刷新</button></div>
      </header>

      <div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/18 bg-amber-500/[0.055] p-4"><div class="flex items-start gap-3"><ShieldAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" /><div><p class="text-xs font-semibold">高风险配置</p><p class="mt-1 text-[11px] leading-5 text-mut">关闭核心能力会立即影响新请求。所有变更均记录版本号、操作者和审计日志。</p></div></div><label class="relative"><span class="sr-only">能力分类</span><select v-model="category" class="appearance-none rounded-xl border border-line/10 bg-app/65 py-2.5 pr-9 pl-3 text-xs text-sub outline-none"><option value="all">全部分类</option><option value="experience">体验</option><option value="creation">创作</option><option value="publishing">发布</option><option value="operations">运营</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label></div>

      <div v-if="error" class="mt-5 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">{{ error }}</div>
      <div v-if="loading" class="flex min-h-[45vh] items-center justify-center"><Loader2 class="h-7 w-7 animate-spin text-brand1" /></div>

      <div v-else class="mt-5 grid gap-5 xl:grid-cols-2">
        <article v-for="flag in visibleFlags" :key="flag.key" class="overflow-hidden rounded-3xl border border-line/10 bg-soft/58 shadow-sm">
          <header class="flex items-start justify-between gap-4 border-b border-line/10 p-5 sm:p-6"><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><span class="rounded-md bg-ink/5 px-2 py-1 text-[9px] font-semibold text-faint">{{ categoryLabel(flag.category) }}</span><span class="font-mono text-[9px] text-faint">{{ flag.key }}</span></div><h2 class="mt-3 text-lg font-bold">{{ flag.name }}</h2><p class="mt-1.5 text-xs leading-5 text-mut">{{ flag.description }}</p></div><label class="relative inline-flex shrink-0 items-center"><input v-model="drafts[flag.key].enabled" type="checkbox" :disabled="!canWrite" class="peer sr-only" /><span class="h-7 w-12 rounded-full bg-slate-400/35 transition peer-checked:bg-emerald-500 peer-disabled:opacity-45 after:absolute after:top-1 after:left-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" /></label></header>

          <div class="space-y-5 p-5 sm:p-6">
            <section><div class="flex items-center justify-between gap-3"><div><h3 class="flex items-center gap-2 text-xs font-semibold"><SlidersHorizontal class="h-3.5 w-3.5 text-brand1" />灰度比例</h3><p class="mt-1 text-[10px] text-faint">未命中定向规则的用户按稳定哈希分桶。</p></div><strong class="text-lg">{{ drafts[flag.key].rolloutPercent }}%</strong></div><input v-model.number="drafts[flag.key].rolloutPercent" type="range" min="0" max="100" step="5" :disabled="!canWrite || !drafts[flag.key].enabled" class="mt-4 w-full accent-brand1 disabled:opacity-45" /></section>

            <section><h3 class="flex items-center gap-2 text-xs font-semibold"><UsersRound class="h-3.5 w-3.5 text-violet-500" />定向角色</h3><div class="mt-3 flex flex-wrap gap-2"><button v-for="role in ['user','support','admin'] as UserRole[]" :key="role" :disabled="!canWrite" class="rounded-full border px-3 py-1.5 text-[10px] font-semibold disabled:opacity-45" :class="drafts[flag.key].roles.includes(role) ? 'border-violet-500/35 bg-violet-500/10 text-violet-500' : 'border-line/10 text-faint'" @click="toggleRole(flag,role)">{{ role }}</button></div></section>

            <section class="grid gap-3 sm:grid-cols-2"><label><span class="text-[10px] font-semibold text-sub">定向邮箱</span><textarea v-model="drafts[flag.key].emails" :disabled="!canWrite" rows="3" placeholder="每行一个邮箱" class="mt-2 w-full resize-none rounded-xl border border-line/10 bg-app/55 px-3 py-2.5 text-xs outline-none placeholder:text-faint focus:border-brand1/35 disabled:opacity-45" /></label><label><span class="text-[10px] font-semibold text-sub">定向用户 ID</span><textarea v-model="drafts[flag.key].userIds" :disabled="!canWrite" rows="3" placeholder="每行一个 UUID" class="mt-2 w-full resize-none rounded-xl border border-line/10 bg-app/55 px-3 py-2.5 font-mono text-[10px] outline-none placeholder:text-faint focus:border-brand1/35 disabled:opacity-45" /></label></section>

            <section><h3 class="flex items-center gap-2 text-xs font-semibold"><CalendarClock class="h-3.5 w-3.5 text-cyan-500" />生效窗口</h3><div class="mt-3 grid gap-3 sm:grid-cols-2"><label><span class="text-[10px] text-faint">开始时间</span><input v-model="drafts[flag.key].startsAt" type="datetime-local" :disabled="!canWrite" class="mt-1.5 w-full rounded-xl border border-line/10 bg-app/55 px-3 py-2.5 text-xs outline-none disabled:opacity-45" /></label><label><span class="text-[10px] text-faint">失效时间</span><input v-model="drafts[flag.key].expiresAt" type="datetime-local" :disabled="!canWrite" class="mt-1.5 w-full rounded-xl border border-line/10 bg-app/55 px-3 py-2.5 text-xs outline-none disabled:opacity-45" /></label></div></section>
          </div>

          <footer class="flex items-center justify-between gap-3 border-t border-line/10 bg-app/25 px-5 py-4 sm:px-6"><div class="text-[10px] text-faint"><span v-if="isDirty(flag)" class="font-semibold text-amber-500">有未保存修改</span><span v-else>配置版本 {{ flag.version }}</span></div><button v-if="canWrite" :disabled="!isDirty(flag) || savingKey === flag.key" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40" @click="save(flag)"><Loader2 v-if="savingKey === flag.key" class="h-3.5 w-3.5 animate-spin" /><Save v-else class="h-3.5 w-3.5" />保存</button><BadgeCheck v-else class="h-4 w-4 text-faint" /></footer>
        </article>
      </div>
    </div>
  </main>
</template>

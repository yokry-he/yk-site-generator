<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Activity,
  AlertTriangle,
  Ban,
  BarChart3,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Database,
  FileClock,
  Gauge,
  HardDrive,
  LayoutDashboard,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { ApiError } from '../lib/api'
import {
  getAdminHealth,
  getAdminOverview,
  listAdminUsers,
  listAuditLogs,
  listSystemEvents,
  updateAdminUser,
  type AdminOverview,
  type AdminUser,
  type AuditLog,
  type HealthComponent,
  type SystemEvent,
} from '../lib/admin'

const { user, isAuthenticated, isAdmin, loading: authLoading } = useAuth()
const toast = useToast()

type AdminSection = 'overview' | 'users' | 'audit' | 'events' | 'health'

const sections = [
  { id: 'overview' as const, label: '运营概览', icon: LayoutDashboard },
  { id: 'users' as const, label: '用户管理', icon: Users },
  { id: 'audit' as const, label: '审计日志', icon: FileClock },
  { id: 'events' as const, label: '系统事件', icon: Activity },
  { id: 'health' as const, label: '基础设施', icon: Server },
]

const active = ref<AdminSection>('overview')
const overview = ref<AdminOverview | null>(null)
const users = ref<AdminUser[]>([])
const auditLogs = ref<AuditLog[]>([])
const systemEvents = ref<SystemEvent[]>([])
const health = ref<{ status: string; checkedAt: string; components: HealthComponent[] } | null>(null)
const loading = ref(false)
const refreshing = ref(false)
const error = ref('')
const userQuery = ref('')
const userStatus = ref('all')
const userRole = ref('all')
const userPage = ref(1)
const userPagination = ref({ page: 1, limit: 25, total: 0, pages: 1 })
const auditOutcome = ref('all')
const auditAction = ref('')
const eventLevel = ref('all')
const eventSource = ref('')
const pendingUser = ref<AdminUser | null>(null)
const pendingPatch = ref<Partial<Pick<AdminUser, 'role' | 'status'>> | null>(null)
const actionBusy = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const maxDaily = computed(() => Math.max(1, ...(overview.value?.usage.daily.map((item) => item.value) ?? [1])))
const pendingActionTitle = computed(() => {
  if (!pendingUser.value || !pendingPatch.value) return ''
  if (pendingPatch.value.status === 'suspended') return '限制该用户账号？'
  if (pendingPatch.value.status === 'active') return '恢复该用户账号？'
  if (pendingPatch.value.status === 'deleted') return '标记账号为已删除？'
  if (pendingPatch.value.role === 'admin') return '授予管理员权限？'
  if (pendingPatch.value.role === 'support') return '授予支持人员权限？'
  if (pendingPatch.value.role === 'user') return '移除管理权限？'
  return '确认修改用户？'
})
const pendingActionDescription = computed(() => {
  if (!pendingUser.value || !pendingPatch.value) return ''
  if (pendingPatch.value.status === 'suspended') return '该用户的全部活跃会话会立即撤销，无法继续登录或调用 API。'
  if (pendingPatch.value.status === 'active') return '用户可以重新获取验证码并登录，原有已撤销会话不会恢复。'
  if (pendingPatch.value.status === 'deleted') return '此操作仅更新账号状态，不会自动删除项目与发布内容。'
  if (pendingPatch.value.role === 'admin') return '管理员可查看用户、审计日志、运行事件并调整其他用户状态。'
  if (pendingPatch.value.role === 'support') return '支持人员角色已预留，当前版本仍不具备管理后台访问权。'
  return '用户将失去管理控制台访问权，现有普通项目能力不受影响。'
})

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '加载失败，请稍后重试'
}

function formatDate(value?: string): string {
  if (!value) return '暂无记录'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function relativeTime(value: string): string {
  const diff = Date.now() - Date.parse(value)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function levelMeta(level: SystemEvent['level']) {
  if (level === 'error') return { label: '错误', class: 'bg-red-500/10 text-red-500', dot: 'bg-red-500' }
  if (level === 'warning') return { label: '警告', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', dot: 'bg-amber-500' }
  return { label: '信息', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', dot: 'bg-sky-500' }
}

function healthMeta(status: HealthComponent['status']) {
  if (status === 'operational') return { label: '运行正常', class: 'text-emerald-500', icon: CircleCheck }
  if (status === 'fallback') return { label: '降级运行', class: 'text-amber-500', icon: AlertTriangle }
  if (status === 'degraded') return { label: '服务降级', class: 'text-orange-500', icon: AlertTriangle }
  return { label: '未配置', class: 'text-faint', icon: Clock3 }
}

async function loadOverview() {
  overview.value = await getAdminOverview()
}

async function loadUsers() {
  const result = await listAdminUsers({
    q: userQuery.value,
    status: userStatus.value,
    role: userRole.value,
    page: userPage.value,
    limit: 25,
  })
  users.value = result.users
  userPagination.value = result.pagination
}

async function loadAudit() {
  auditLogs.value = await listAuditLogs({
    limit: 200,
    outcome: auditOutcome.value,
    action: auditAction.value,
  })
}

async function loadEvents() {
  systemEvents.value = await listSystemEvents({
    limit: 200,
    level: eventLevel.value,
    source: eventSource.value,
  })
}

async function loadHealth() {
  health.value = await getAdminHealth()
}

async function loadSection(section = active.value, silent = false) {
  if (!isAdmin.value) return
  if (silent) refreshing.value = true
  else loading.value = true
  error.value = ''
  try {
    if (section === 'overview') await loadOverview()
    else if (section === 'users') await loadUsers()
    else if (section === 'audit') await loadAudit()
    else if (section === 'events') await loadEvents()
    else await loadHealth()
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

function selectSection(section: AdminSection) {
  active.value = section
}

function scheduleUserSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    userPage.value = 1
    void loadSection('users', true)
  }, 320)
}

function askUserUpdate(target: AdminUser, patch: Partial<Pick<AdminUser, 'role' | 'status'>>) {
  pendingUser.value = target
  pendingPatch.value = patch
}

async function confirmUserUpdate() {
  if (!pendingUser.value || !pendingPatch.value) return
  actionBusy.value = true
  try {
    const updated = await updateAdminUser(pendingUser.value.id, pendingPatch.value)
    users.value = users.value.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
    toast.success('用户状态已更新', `${updated.email} · ${updated.role} · ${updated.status}`)
    pendingUser.value = null
    pendingPatch.value = null
    await Promise.all([loadOverview(), loadAudit()])
  } catch (err) {
    toast.error('更新失败', messageOf(err))
  } finally {
    actionBusy.value = false
  }
}

watch(active, (section) => void loadSection(section))
watch([userStatus, userRole], () => {
  userPage.value = 1
  void loadSection('users', true)
})
watch(userQuery, scheduleUserSearch)
watch([auditOutcome, auditAction], () => void loadSection('audit', true))
watch([eventLevel, eventSource], () => void loadSection('events', true))
watch(isAdmin, (value) => value && void loadSection())

onMounted(() => {
  if (isAdmin.value) void loadSection()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <main class="min-h-screen pt-16 bg-app">
    <div v-if="authLoading" class="flex min-h-[70vh] items-center justify-center">
      <Loader2 class="h-7 w-7 animate-spin text-brand1" />
    </div>

    <section v-else-if="!isAuthenticated || !isAdmin" class="mx-auto flex min-h-[72vh] max-w-xl items-center px-4 text-center">
      <div class="w-full rounded-3xl border border-line/10 bg-soft/65 p-9 shadow-2xl shadow-black/5">
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
          <ShieldOff class="h-7 w-7" />
        </span>
        <h1 class="mt-5 text-2xl font-bold text-ink">管理控制台仅对管理员开放</h1>
        <p class="mt-3 text-sm leading-7 text-mut">当前账号没有运营管理权限。管理员身份由服务端实时校验，角色变更会立即生效。</p>
        <RouterLink to="/" class="mt-6 inline-flex rounded-xl border border-line/12 bg-ink/[0.04] px-5 py-3 text-sm font-semibold text-sub hover:text-ink">返回首页</RouterLink>
      </div>
    </section>

    <div v-else class="mx-auto flex max-w-[1680px] gap-0 px-0 lg:px-5">
      <aside class="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-line/10 bg-soft/35 px-4 py-6 lg:flex">
        <div class="px-2">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-brand1/10 px-2.5 py-1 text-[10px] font-bold text-brand1">
            <ShieldCheck class="h-3 w-3" />ADMIN
          </span>
          <h1 class="mt-3 text-lg font-semibold text-ink">运营控制台</h1>
          <p class="mt-1 truncate text-xs text-faint">{{ user?.email }}</p>
        </div>
        <nav class="mt-7 grid gap-1" aria-label="管理后台导航">
          <button
            v-for="section in sections"
            :key="section.id"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/45"
            :class="active === section.id ? 'bg-brand1/10 font-semibold text-brand1' : 'text-mut hover:bg-ink/5 hover:text-ink'"
            @click="selectSection(section.id)"
          >
            <component :is="section.icon" class="h-4 w-4" />{{ section.label }}
          </button>
        </nav>
        <div class="mt-auto rounded-2xl border border-line/10 bg-app/45 p-4">
          <p class="text-[10px] font-semibold tracking-wider text-faint uppercase">安全提示</p>
          <p class="mt-2 text-[11px] leading-5 text-mut">高风险操作会记录操作者、请求 ID、来源 IP 和变更摘要。</p>
        </div>
      </aside>

      <section class="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div class="flex gap-2 overflow-x-auto pb-3 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            v-for="section in sections"
            :key="section.id"
            class="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
            :class="active === section.id ? 'bg-brand1/12 text-brand1' : 'border border-line/10 bg-soft/50 text-mut'"
            @click="selectSection(section.id)"
          >
            <component :is="section.icon" class="h-3.5 w-3.5" />{{ section.label }}
          </button>
        </div>

        <header class="flex flex-wrap items-end justify-between gap-4 border-b border-line/10 pb-5">
          <div>
            <p class="text-[10px] font-semibold tracking-[.16em] text-brand1 uppercase">SiteForge Operations</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{{ sections.find((item) => item.id === active)?.label }}</h2>
            <p class="mt-1.5 text-sm text-mut">
              <template v-if="active === 'overview'">关注真实使用、内容供给和运行风险。</template>
              <template v-else-if="active === 'users'">搜索用户、检查资源使用并控制账号状态。</template>
              <template v-else-if="active === 'audit'">查看所有高风险管理操作的不可变记录。</template>
              <template v-else-if="active === 'events'">排查服务端错误、慢请求与关键运行事件。</template>
              <template v-else>确认生产依赖的当前启用状态与降级路径。</template>
            </p>
          </div>
          <button
            :disabled="loading || refreshing"
            class="flex items-center gap-2 rounded-xl border border-line/12 bg-soft/55 px-3.5 py-2.5 text-xs font-semibold text-sub transition hover:border-brand1/25 hover:text-brand1 disabled:opacity-50"
            @click="loadSection(active, true)"
          >
            <RefreshCw class="h-3.5 w-3.5" :class="refreshing && 'animate-spin'" />刷新数据
          </button>
        </header>

        <div v-if="error" class="mt-5 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">
          <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
          <span>{{ error }}</span>
        </div>

        <div v-if="loading" class="flex min-h-[55vh] items-center justify-center">
          <Loader2 class="h-7 w-7 animate-spin text-brand1" />
        </div>

        <template v-else-if="active === 'overview' && overview">
          <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article class="rounded-2xl border border-line/10 bg-soft/60 p-5">
              <div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/10 text-blue-500"><Users class="h-5 w-5" /></span><span class="text-[10px] text-faint">{{ overview.users.active }} 活跃</span></div>
              <p class="mt-5 text-3xl font-bold text-ink">{{ overview.users.total }}</p><p class="mt-1 text-xs text-mut">注册用户</p>
            </article>
            <article class="rounded-2xl border border-line/10 bg-soft/60 p-5">
              <div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Gauge class="h-5 w-5" /></span><span class="text-[10px] text-faint">{{ overview.projects.versions }} 个版本</span></div>
              <p class="mt-5 text-3xl font-bold text-ink">{{ overview.projects.total }}</p><p class="mt-1 text-xs text-mut">云端项目</p>
            </article>
            <article class="rounded-2xl border border-line/10 bg-soft/60 p-5">
              <div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><BarChart3 class="h-5 w-5" /></span><span class="text-[10px] text-faint">近 30 天</span></div>
              <p class="mt-5 text-3xl font-bold text-ink">{{ overview.usage.last30Days }}</p><p class="mt-1 text-xs text-mut">生成与发布用量</p>
            </article>
            <article class="rounded-2xl border border-line/10 bg-soft/60 p-5">
              <div class="flex items-center justify-between"><span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle class="h-5 w-5" /></span><span class="text-[10px] text-faint">近 24 小时</span></div>
              <p class="mt-5 text-3xl font-bold text-ink">{{ overview.operations.errors24h }}</p><p class="mt-1 text-xs text-mut">服务端错误事件</p>
            </article>
          </div>

          <div class="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
            <article class="rounded-2xl border border-line/10 bg-soft/60 p-5 sm:p-6">
              <div class="flex items-center justify-between gap-3">
                <div><h3 class="text-sm font-semibold text-ink">近 14 天使用趋势</h3><p class="mt-1 text-[11px] text-faint">生成、迭代和发布事件合计</p></div>
                <div class="flex gap-3 text-[10px] text-faint"><span>生成 {{ overview.usage.byAction.generate || 0 }}</span><span>迭代 {{ overview.usage.byAction.iterate || 0 }}</span><span>发布 {{ overview.usage.byAction.publish || 0 }}</span></div>
              </div>
              <div class="mt-7 flex h-64 items-end gap-2 border-b border-line/10 px-1">
                <div v-for="item in overview.usage.daily" :key="item.date" class="group flex h-full min-w-0 flex-1 flex-col justify-end">
                  <div class="relative rounded-t-md bg-gradient-to-t from-brand1 to-brand2 transition-all group-hover:brightness-110" :style="{ height: `${Math.max(3, item.value / maxDaily * 100)}%` }">
                    <span class="absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[10px] text-app shadow group-hover:block">{{ item.value }}</span>
                  </div>
                  <span class="mt-2 truncate text-center text-[9px] text-faint">{{ item.date.slice(5) }}</span>
                </div>
              </div>
            </article>

            <article class="rounded-2xl border border-line/10 bg-soft/60 p-5 sm:p-6">
              <h3 class="text-sm font-semibold text-ink">产品资产</h3>
              <div class="mt-5 grid gap-3">
                <div class="flex items-center justify-between rounded-xl border border-line/8 bg-app/40 p-3"><span class="text-xs text-mut">已发布站点</span><strong class="text-sm text-ink">{{ overview.publications.published }}</strong></div>
                <div class="flex items-center justify-between rounded-xl border border-line/8 bg-app/40 p-3"><span class="text-xs text-mut">品牌套件</span><strong class="text-sm text-ink">{{ overview.assets.brandKits }}</strong></div>
                <div class="flex items-center justify-between rounded-xl border border-line/8 bg-app/40 p-3"><span class="text-xs text-mut">官方模板</span><strong class="text-sm text-ink">{{ overview.assets.officialTemplates }}</strong></div>
                <div class="flex items-center justify-between rounded-xl border border-line/8 bg-app/40 p-3"><span class="text-xs text-mut">模板创建项目</span><strong class="text-sm text-ink">{{ overview.projects.fromTemplates }}</strong></div>
              </div>
            </article>
          </div>

          <div class="mt-5 grid gap-5 xl:grid-cols-2">
            <article class="overflow-hidden rounded-2xl border border-line/10 bg-soft/60">
              <div class="flex items-center justify-between border-b border-line/10 px-5 py-4"><h3 class="text-sm font-semibold text-ink">最近系统事件</h3><button class="text-[11px] font-medium text-brand1" @click="active = 'events'">查看全部</button></div>
              <div v-if="overview.recentEvents.length" class="divide-y divide-line/8">
                <div v-for="event in overview.recentEvents" :key="event.id" class="flex gap-3 px-5 py-3.5">
                  <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="levelMeta(event.level).dot" />
                  <div class="min-w-0 flex-1"><p class="truncate text-xs font-medium text-ink">{{ event.message }}</p><p class="mt-1 text-[10px] text-faint">{{ event.source }} · {{ relativeTime(event.createdAt) }}<template v-if="event.durationMs"> · {{ event.durationMs }}ms</template></p></div>
                </div>
              </div>
              <div v-else class="p-8 text-center text-xs text-faint">暂无需要关注的系统事件</div>
            </article>
            <article class="overflow-hidden rounded-2xl border border-line/10 bg-soft/60">
              <div class="flex items-center justify-between border-b border-line/10 px-5 py-4"><h3 class="text-sm font-semibold text-ink">最近管理操作</h3><button class="text-[11px] font-medium text-brand1" @click="active = 'audit'">查看全部</button></div>
              <div v-if="overview.recentAudit.length" class="divide-y divide-line/8">
                <div v-for="log in overview.recentAudit" :key="log.id" class="flex gap-3 px-5 py-3.5">
                  <span class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand1/10 text-brand1"><ShieldCheck class="h-3.5 w-3.5" /></span>
                  <div class="min-w-0 flex-1"><p class="truncate text-xs font-medium text-ink">{{ log.action }}</p><p class="mt-1 text-[10px] text-faint">{{ log.resourceType }} · {{ relativeTime(log.createdAt) }}</p></div>
                </div>
              </div>
              <div v-else class="p-8 text-center text-xs text-faint">暂无管理操作记录</div>
            </article>
          </div>
        </template>

        <template v-else-if="active === 'users'">
          <div class="mt-6 flex flex-col gap-3 sm:flex-row">
            <label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-soft/60 px-3.5 py-2.5 focus-within:border-brand1/35 focus-within:ring-4 focus-within:ring-brand1/7">
              <Search class="h-4 w-4 text-faint" /><input v-model="userQuery" placeholder="搜索邮箱或用户 ID" class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" />
            </label>
            <label class="relative"><span class="sr-only">账号状态</span><select v-model="userStatus" class="appearance-none rounded-xl border border-line/10 bg-soft/60 py-2.5 pr-9 pl-3 text-xs text-sub outline-none focus:border-brand1/35"><option value="all">全部状态</option><option value="active">正常</option><option value="suspended">已限制</option><option value="deleted">已删除</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
            <label class="relative"><span class="sr-only">账号角色</span><select v-model="userRole" class="appearance-none rounded-xl border border-line/10 bg-soft/60 py-2.5 pr-9 pl-3 text-xs text-sub outline-none focus:border-brand1/35"><option value="all">全部角色</option><option value="user">普通用户</option><option value="support">支持人员</option><option value="admin">管理员</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-faint" /></label>
          </div>

          <div class="mt-5 overflow-hidden rounded-2xl border border-line/10 bg-soft/55">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[980px] text-left">
                <thead class="border-b border-line/10 bg-ink/[0.025] text-[10px] font-semibold tracking-wider text-faint uppercase"><tr><th class="px-4 py-3">用户</th><th class="px-4 py-3">角色 / 状态</th><th class="px-4 py-3">项目资产</th><th class="px-4 py-3">累计用量</th><th class="px-4 py-3">最近活动</th><th class="px-4 py-3 text-right">管理操作</th></tr></thead>
                <tbody class="divide-y divide-line/8">
                  <tr v-for="item in users" :key="item.id" class="transition hover:bg-ink/[0.025]">
                    <td class="px-4 py-4"><div class="flex items-center gap-3"><span class="bg-brand-gradient grid h-9 w-9 place-items-center rounded-full text-[10px] font-bold text-white">{{ item.email.slice(0, 2).toUpperCase() }}</span><div class="min-w-0"><p class="max-w-64 truncate text-xs font-semibold text-ink">{{ item.email }}</p><p class="mt-1 font-mono text-[9px] text-faint">{{ item.id }}</p></div></div></td>
                    <td class="px-4 py-4"><div class="flex flex-wrap gap-1.5"><span class="rounded-md px-2 py-1 text-[10px] font-medium" :class="item.role === 'admin' ? 'bg-violet-500/10 text-violet-500' : item.role === 'support' ? 'bg-sky-500/10 text-sky-500' : 'bg-ink/5 text-mut'">{{ item.role === 'admin' ? '管理员' : item.role === 'support' ? '支持人员' : '普通用户' }}</span><span class="rounded-md px-2 py-1 text-[10px] font-medium" :class="item.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : item.status === 'suspended' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'">{{ item.status === 'active' ? '正常' : item.status === 'suspended' ? '已限制' : '已删除' }}</span></div><p class="mt-1.5 text-[10px] text-faint">{{ item.activeSessions }} 个活跃会话</p></td>
                    <td class="px-4 py-4"><p class="text-xs text-sub">{{ item.projectCount }} 个项目</p><p class="mt-1 text-[10px] text-faint">{{ item.publicationCount }} 个发布站点</p></td>
                    <td class="px-4 py-4"><p class="text-xs font-semibold text-ink">{{ item.usageUnits }}</p><p class="mt-1 text-[10px] text-faint">计费单位</p></td>
                    <td class="px-4 py-4"><p class="text-xs text-sub">{{ formatDate(item.lastActiveAt) }}</p><p class="mt-1 text-[10px] text-faint">注册于 {{ formatDate(item.createdAt) }}</p></td>
                    <td class="px-4 py-4"><div class="flex justify-end gap-2"><button v-if="item.status === 'active'" :disabled="item.id === user?.id" class="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-amber-600 disabled:opacity-35" @click="askUserUpdate(item,{ status:'suspended' })"><Ban class="h-3 w-3" />限制</button><button v-else-if="item.status === 'suspended'" class="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-emerald-600" @click="askUserUpdate(item,{ status:'active' })"><UserRoundCheck class="h-3 w-3" />恢复</button><label class="relative"><select :value="item.role" :disabled="item.id === user?.id" class="appearance-none rounded-lg border border-line/10 bg-app/55 py-1.5 pr-7 pl-2.5 text-[10px] text-sub outline-none disabled:opacity-35" @change="askUserUpdate(item,{ role: ($event.target as HTMLSelectElement).value as AdminUser['role'] })"><option value="user">普通用户</option><option value="support">支持人员</option><option value="admin">管理员</option></select><ChevronDown class="pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-faint" /></label></div></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="!users.length" class="p-12 text-center text-sm text-faint">没有匹配的用户</div>
            <div class="flex items-center justify-between border-t border-line/10 px-4 py-3 text-xs text-faint"><span>共 {{ userPagination.total }} 位用户</span><div class="flex items-center gap-2"><button :disabled="userPage <= 1" class="rounded-lg border border-line/10 px-3 py-1.5 disabled:opacity-35" @click="((userPage -= 1), loadSection('users',true))">上一页</button><span>{{ userPage }} / {{ userPagination.pages }}</span><button :disabled="userPage >= userPagination.pages" class="rounded-lg border border-line/10 px-3 py-1.5 disabled:opacity-35" @click="((userPage += 1), loadSection('users',true))">下一页</button></div></div>
          </div>
        </template>

        <template v-else-if="active === 'audit'">
          <div class="mt-6 flex flex-col gap-3 sm:flex-row"><label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-soft/60 px-3.5 py-2.5 focus-within:border-brand1/35"><Search class="h-4 w-4 text-faint" /><input v-model="auditAction" placeholder="按操作名称筛选，例如 admin.user.update" class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" /></label><select v-model="auditOutcome" class="rounded-xl border border-line/10 bg-soft/60 px-3 py-2.5 text-xs text-sub outline-none focus:border-brand1/35"><option value="all">全部结果</option><option value="success">成功</option><option value="failure">失败</option></select></div>
          <div class="mt-5 overflow-hidden rounded-2xl border border-line/10 bg-soft/55"><div v-if="auditLogs.length" class="divide-y divide-line/8"><article v-for="log in auditLogs" :key="log.id" class="grid gap-4 px-4 py-4 sm:grid-cols-[36px_minmax(0,1fr)_auto] sm:px-5"><span class="grid h-9 w-9 place-items-center rounded-xl" :class="log.outcome === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'"><Check v-if="log.outcome === 'success'" class="h-4 w-4" /><X v-else class="h-4 w-4" /></span><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><h3 class="text-xs font-semibold text-ink">{{ log.action }}</h3><span class="rounded-md bg-ink/5 px-2 py-0.5 text-[9px] text-faint">{{ log.resourceType }}</span></div><p class="mt-1.5 text-[11px] text-mut">目标：{{ log.resourceId || '—' }} · 操作者：{{ log.actorUserId || 'system' }}</p><p class="mt-1 font-mono text-[9px] text-faint">Request {{ log.requestId || '—' }} · IP {{ log.ipAddress || '—' }}</p></div><time class="text-[10px] text-faint">{{ formatDate(log.createdAt) }}</time></article></div><div v-else class="p-12 text-center text-sm text-faint">暂无匹配的审计记录</div></div>
        </template>

        <template v-else-if="active === 'events'">
          <div class="mt-6 flex flex-col gap-3 sm:flex-row"><label class="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line/10 bg-soft/60 px-3.5 py-2.5 focus-within:border-brand1/35"><Search class="h-4 w-4 text-faint" /><input v-model="eventSource" placeholder="按来源筛选，例如 http、provider" class="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-faint" /></label><select v-model="eventLevel" class="rounded-xl border border-line/10 bg-soft/60 px-3 py-2.5 text-xs text-sub outline-none focus:border-brand1/35"><option value="all">全部级别</option><option value="error">错误</option><option value="warning">警告</option><option value="info">信息</option></select></div>
          <div class="mt-5 grid gap-3"><article v-for="event in systemEvents" :key="event.id" class="rounded-2xl border border-line/10 bg-soft/55 p-4 sm:p-5"><div class="flex items-start gap-3"><span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="levelMeta(event.level).dot" /><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><span class="rounded-md px-2 py-0.5 text-[9px] font-semibold" :class="levelMeta(event.level).class">{{ levelMeta(event.level).label }}</span><span class="text-[10px] text-faint">{{ event.source }} · {{ event.eventType }}</span></div><h3 class="mt-2 text-sm font-semibold text-ink">{{ event.message }}</h3><div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-faint"><span>Request {{ event.requestId || '—' }}</span><span v-if="event.durationMs">{{ event.durationMs }}ms</span><span>{{ formatDate(event.createdAt) }}</span></div></div></div></article><div v-if="!systemEvents.length" class="rounded-2xl border border-dashed border-line/15 p-12 text-center text-sm text-faint">暂无匹配的运行事件</div></div>
        </template>

        <template v-else-if="active === 'health' && health">
          <div class="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-500/18 bg-emerald-500/[0.055] p-4"><span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/12 text-emerald-500"><CircleCheck class="h-5 w-5" /></span><div><h3 class="text-sm font-semibold text-ink">API 主服务运行正常</h3><p class="mt-1 text-[11px] text-mut">最近检查：{{ formatDate(health.checkedAt) }}</p></div></div>
          <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"><article v-for="component in health.components" :key="component.id" class="rounded-2xl border border-line/10 bg-soft/60 p-5"><div class="flex items-start justify-between gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-ink/[0.04] text-sub"><Database v-if="component.id === 'data' || component.id === 'mysql'" class="h-5 w-5" /><Mail v-else-if="component.id === 'email'" class="h-5 w-5" /><HardDrive v-else-if="component.id === 'object-storage'" class="h-5 w-5" /><Server v-else class="h-5 w-5" /></span><span class="flex items-center gap-1.5 text-[10px] font-semibold" :class="healthMeta(component.status).class"><component :is="healthMeta(component.status).icon" class="h-3.5 w-3.5" />{{ healthMeta(component.status).label }}</span></div><h3 class="mt-5 text-sm font-semibold text-ink">{{ component.name }}</h3><p class="mt-2 text-xs leading-5 text-mut">{{ component.detail }}</p></article></div>
        </template>
      </section>
    </div>

    <Teleport to="body">
      <Transition name="confirm">
        <div v-if="pendingUser && pendingPatch" class="fixed inset-0 z-[130] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" @mousedown.self="((pendingUser=null),(pendingPatch=null))">
          <section role="alertdialog" aria-modal="true" :aria-label="pendingActionTitle" class="w-full max-w-md rounded-3xl border border-white/10 bg-app p-6 text-ink shadow-2xl">
            <span class="grid h-11 w-11 place-items-center rounded-2xl" :class="pendingPatch.status === 'suspended' || pendingPatch.status === 'deleted' ? 'bg-amber-500/10 text-amber-500' : 'bg-brand1/10 text-brand1'">
              <UserCog class="h-5 w-5" />
            </span>
            <h2 class="mt-5 text-xl font-bold">{{ pendingActionTitle }}</h2>
            <p class="mt-2 text-sm leading-6 text-mut">{{ pendingActionDescription }}</p>
            <div class="mt-4 rounded-xl border border-line/10 bg-soft/60 p-3"><p class="truncate text-xs font-semibold text-ink">{{ pendingUser.email }}</p><p class="mt-1 font-mono text-[9px] text-faint">{{ pendingUser.id }}</p></div>
            <div class="mt-6 flex justify-end gap-2"><button :disabled="actionBusy" class="rounded-xl border border-line/10 px-4 py-2.5 text-sm text-sub hover:text-ink" @click="((pendingUser=null),(pendingPatch=null))">取消</button><button :disabled="actionBusy" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" @click="confirmUserUpdate"><Loader2 v-if="actionBusy" class="h-4 w-4 animate-spin" /><Check v-else class="h-4 w-4" />确认修改</button></div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.confirm-enter-active,.confirm-leave-active{transition:opacity .16s ease}.confirm-enter-active section,.confirm-leave-active section{transition:transform .2s cubic-bezier(.22,1,.36,1),opacity .16s ease}.confirm-enter-from,.confirm-leave-to{opacity:0}.confirm-enter-from section,.confirm-leave-to section{transform:translateY(10px) scale(.985);opacity:0}
</style>

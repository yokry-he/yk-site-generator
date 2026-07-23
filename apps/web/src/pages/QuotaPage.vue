<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Activity, CalendarClock, Gauge, Loader2, RefreshCw, Sparkles, UserRound, Zap } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { ApiError } from '../lib/api'
import { getUsage, type QuotaSummary } from '../lib/workspace'

interface UsageItem {
  id?: string
  action?: string
  units?: number
  siteType?: string
  model?: string
  createdAt?: string
}

const { isAuthenticated, loading: authLoading } = useAuth()
const { show: showAuth } = useAuthDialog()
const quota = ref<QuotaSummary | null>(null)
const usage = ref<UsageItem[]>([])
const loading = ref(false)
const error = ref('')

const percentage = computed(() => {
  if (!quota.value?.limit) return 0
  return Math.min(100, Math.round((quota.value.used / quota.value.limit) * 100))
})
const statusText = computed(() => {
  if (percentage.value >= 100) return '额度已用完'
  if (percentage.value >= 80) return '接近本月上限'
  return '额度充足'
})

function messageOf(err: unknown): string {
  return err instanceof ApiError || err instanceof Error ? err.message : '请求失败'
}

function actionName(action?: string): string {
  return { generate: '首次生成', iterate: '对话迭代', publish: '站点发布' }[action ?? ''] ?? action ?? '未知操作'
}

function formatDate(value?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

async function load() {
  if (!isAuthenticated.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await getUsage(100)
    quota.value = result.quota
    usage.value = result.usage as UsageItem[]
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    loading.value = false
  }
}

watch(isAuthenticated, (value) => value && void load())
onMounted(load)
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-24 pb-20">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-5 border-b border-line/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="flex items-center gap-2 text-sm font-semibold text-brand1">
            <Gauge class="h-4 w-4" />
            账号用量
          </p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">额度与使用记录</h1>
          <p class="mt-3 text-sm leading-7 text-mut">查看每月生成次数、重置时间和最近使用明细。</p>
        </div>
        <button
          v-if="isAuthenticated"
          :disabled="loading"
          class="flex items-center gap-2 rounded-xl border border-line/12 bg-ink/[0.04] px-4 py-2.5 text-sm text-sub hover:bg-ink/[0.08] disabled:opacity-50"
          @click="load"
        >
          <RefreshCw class="h-4 w-4" :class="loading && 'animate-spin'" />
          刷新数据
        </button>
      </div>

      <div v-if="authLoading && !isAuthenticated" class="flex min-h-80 items-center justify-center">
        <Loader2 class="h-7 w-7 animate-spin text-brand1" />
      </div>

      <section v-else-if="!isAuthenticated" class="mx-auto mt-14 max-w-xl rounded-3xl border border-line/10 bg-soft/70 p-10 text-center">
        <UserRound class="mx-auto h-10 w-10 text-brand1" />
        <h2 class="mt-4 text-xl font-semibold text-ink">登录后查看额度</h2>
        <p class="mt-2 text-sm text-mut">匿名演示不计入账号用量。登录后每次真实生成和迭代会记录到当前月份。</p>
        <button class="bg-brand-gradient mt-6 rounded-xl px-5 py-3 text-sm font-semibold text-white" @click="showAuth">
          登录 SiteForge
        </button>
      </section>

      <template v-else>
        <div v-if="error" class="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-500">
          {{ error }}
        </div>

        <div v-if="loading && !quota" class="mt-8 grid gap-5 md:grid-cols-3">
          <div v-for="item in 3" :key="item" class="h-40 animate-pulse rounded-2xl bg-ink/[0.04]" />
        </div>

        <template v-else-if="quota">
          <section class="mt-8 grid gap-5 md:grid-cols-3">
            <div class="md:col-span-2 rounded-2xl border border-line/10 bg-soft/65 p-6 shadow-lg shadow-black/[0.03]">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p class="text-xs font-medium text-faint">{{ quota.period }} 生成额度</p>
                  <p class="mt-2 text-3xl font-bold text-ink">
                    {{ quota.remaining }}
                    <span class="text-base font-medium text-faint">/ {{ quota.limit }} 剩余</span>
                  </p>
                </div>
                <span
                  class="rounded-full px-3 py-1 text-xs font-medium"
                  :class="percentage >= 100 ? 'bg-red-500/10 text-red-500' : percentage >= 80 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-500'"
                >
                  {{ statusText }}
                </span>
              </div>
              <div class="mt-6 h-3 overflow-hidden rounded-full bg-ink/[0.06]">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-brand1 to-brand2 transition-[width] duration-700"
                  :style="{ width: `${percentage}%` }"
                />
              </div>
              <div class="mt-3 flex items-center justify-between text-xs text-faint">
                <span>已使用 {{ quota.used }} 次</span>
                <span>{{ percentage }}%</span>
              </div>
            </div>

            <div class="rounded-2xl border border-line/10 bg-soft/65 p-6 shadow-lg shadow-black/[0.03]">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand2/10">
                <CalendarClock class="h-5 w-5 text-brand2" />
              </span>
              <p class="mt-5 text-xs font-medium text-faint">下次重置</p>
              <p class="mt-1 text-lg font-semibold text-ink">
                {{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(quota.resetsAt)) }}
              </p>
              <p class="mt-2 text-xs leading-5 text-mut">额度按 UTC 自然月统计,失败的厂商请求会自动退回。</p>
            </div>
          </section>

          <section class="mt-5 grid gap-5 sm:grid-cols-3">
            <div class="rounded-2xl border border-line/10 bg-soft/45 p-5">
              <Sparkles class="h-5 w-5 text-brand1" />
              <p class="mt-3 text-xs text-faint">首次生成</p>
              <p class="mt-1 text-2xl font-semibold text-ink">{{ quota.byAction.generate ?? 0 }}</p>
            </div>
            <div class="rounded-2xl border border-line/10 bg-soft/45 p-5">
              <Zap class="h-5 w-5 text-brand2" />
              <p class="mt-3 text-xs text-faint">对话迭代</p>
              <p class="mt-1 text-2xl font-semibold text-ink">{{ quota.byAction.iterate ?? 0 }}</p>
            </div>
            <div class="rounded-2xl border border-line/10 bg-soft/45 p-5">
              <Activity class="h-5 w-5 text-emerald-500" />
              <p class="mt-3 text-xs text-faint">站点发布</p>
              <p class="mt-1 text-2xl font-semibold text-ink">{{ quota.byAction.publish ?? 0 }}</p>
            </div>
          </section>

          <section class="mt-8 overflow-hidden rounded-2xl border border-line/10 bg-soft/55">
            <div class="flex items-center justify-between border-b border-line/10 px-5 py-4">
              <h2 class="text-sm font-semibold text-ink">最近使用记录</h2>
              <span class="text-xs text-faint">最多显示 100 条</span>
            </div>
            <div v-if="usage.length === 0" class="px-5 py-14 text-center text-sm text-faint">
              本月还没有使用记录
            </div>
            <div v-else class="divide-y divide-line/8">
              <div v-for="item in usage" :key="item.id" class="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 sm:grid-cols-[1fr_160px_120px] sm:items-center">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-ink">{{ actionName(item.action) }}</p>
                  <p class="mt-1 truncate text-xs text-faint">{{ item.siteType || '—' }}<template v-if="item.model"> · {{ item.model }}</template></p>
                </div>
                <span class="hidden text-xs text-mut sm:block">{{ formatDate(item.createdAt) }}</span>
                <div class="text-right">
                  <span class="rounded-full bg-ink/[0.05] px-2.5 py-1 text-xs font-medium text-sub">{{ item.units ?? 1 }} 次</span>
                  <p class="mt-1 text-[10px] text-faint sm:hidden">{{ formatDate(item.createdAt) }}</p>
                </div>
              </div>
            </div>
          </section>
        </template>
      </template>
    </div>
  </main>
</template>

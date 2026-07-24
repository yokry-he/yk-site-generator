<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-vue-next'
import AppDialog from './AppDialog.vue'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { ApiError } from '../lib/api'

const { visible, hide } = useAuthDialog()
const { requestLoginCode, verifyLoginCode } = useAuth()
const step = ref<'email' | 'code' | 'success'>('email')
const email = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const debugCode = ref('')
const countdown = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const codeValid = computed(() => /^\d{6}$/.test(code.value))

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

function startTimer(seconds = 60) {
  stopTimer()
  countdown.value = seconds
  timer = setInterval(() => {
    countdown.value = Math.max(0, countdown.value - 1)
    if (countdown.value === 0) stopTimer()
  }, 1000)
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) return err.message
  return err instanceof Error ? err.message : '操作失败,请稍后重试'
}

async function sendCode() {
  if (!emailValid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await requestLoginCode(email.value.trim())
    debugCode.value = result.debugCode ?? ''
    code.value = result.debugCode ?? ''
    step.value = 'code'
    startTimer(60)
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    busy.value = false
  }
}

async function submitCode() {
  if (!codeValid.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await verifyLoginCode(email.value.trim(), code.value)
    step.value = 'success'
    stopTimer()
    window.setTimeout(hide, 900)
  } catch (err) {
    error.value = messageOf(err)
  } finally {
    busy.value = false
  }
}

function back() {
  step.value = 'email'
  code.value = ''
  debugCode.value = ''
  error.value = ''
  stopTimer()
}

watch(visible, (open) => {
  if (!open) {
    window.setTimeout(() => {
      step.value = 'email'
      email.value = ''
      code.value = ''
      debugCode.value = ''
      error.value = ''
      busy.value = false
      stopTimer()
    }, 200)
  }
})

onBeforeUnmount(stopTimer)
</script>

<template>
  <AppDialog
    :open="visible"
    title="登录 SiteForge"
    description="使用邮箱验证码登录,跨设备同步项目与版本。"
    width-class="max-w-md"
    @update:open="(value) => !value && hide()"
  >
    <template #icon>
      <span class="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-brand1/20">
        <ShieldCheck class="h-4 w-4 text-white" />
      </span>
    </template>

    <div class="p-6">
      <div class="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-ink/[0.04] p-1 text-xs">
        <div
          class="rounded-lg px-3 py-2 text-center transition-colors"
          :class="step === 'email' ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-mut'"
        >
          1. 邮箱
        </div>
        <div
          class="rounded-lg px-3 py-2 text-center transition-colors"
          :class="step !== 'email' ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-mut'"
        >
          2. 验证
        </div>
      </div>

      <form v-if="step === 'email'" class="space-y-5" @submit.prevent="sendCode">
        <div>
          <label for="login-email" class="mb-2 block text-sm font-medium text-sub">邮箱地址</label>
          <div class="relative">
            <Mail class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="login-email"
              v-model.trim="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              placeholder="you@example.com"
              class="w-full rounded-xl border border-line/12 bg-app/60 py-3 pr-4 pl-10 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-brand1/55 focus:ring-2 focus:ring-brand1/10"
              autofocus
            />
          </div>
          <p class="mt-2 text-xs leading-relaxed text-faint">验证码有效期 10 分钟。我们不会向你的邮箱发送营销邮件。</p>
        </div>

        <p v-if="error" class="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3.5 py-3 text-xs text-red-500">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="!emailValid || busy"
          class="bg-brand-gradient flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
          <ArrowRight v-else class="h-4 w-4" />
          {{ busy ? '正在发送…' : '发送验证码' }}
        </button>
      </form>

      <form v-else-if="step === 'code'" class="space-y-5" @submit.prevent="submitCode">
        <div class="flex items-start gap-3 rounded-xl border border-brand1/15 bg-brand1/[0.06] p-3.5">
          <Mail class="mt-0.5 h-4 w-4 shrink-0 text-brand1" />
          <div class="min-w-0">
            <p class="text-xs text-mut">验证码已发送至</p>
            <p class="mt-0.5 truncate text-sm font-medium text-ink">{{ email }}</p>
          </div>
        </div>

        <div>
          <label for="login-code" class="mb-2 block text-sm font-medium text-sub">6 位验证码</label>
          <div class="relative">
            <KeyRound class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              id="login-code"
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              placeholder="000000"
              class="w-full rounded-xl border border-line/12 bg-app/60 py-3 pr-4 pl-10 font-mono text-lg tracking-[0.35em] text-ink outline-none transition-colors placeholder:tracking-[0.35em] placeholder:text-faint focus:border-brand1/55 focus:ring-2 focus:ring-brand1/10"
              @input="code = code.replace(/\D/g, '').slice(0, 6)"
            />
          </div>
          <p v-if="debugCode" class="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            开发环境验证码：<strong class="font-mono tracking-wider">{{ debugCode }}</strong>
          </p>
        </div>

        <p v-if="error" class="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3.5 py-3 text-xs text-red-500">
          {{ error }}
        </p>

        <div class="grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 rounded-xl border border-line/12 px-4 py-3 text-sm font-medium text-sub transition-colors hover:bg-ink/5 hover:text-ink"
            @click="back"
          >
            <ArrowLeft class="h-4 w-4" />
            返回
          </button>
          <button
            type="submit"
            :disabled="!codeValid || busy"
            class="bg-brand-gradient flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Loader2 v-if="busy" class="h-4 w-4 animate-spin" />
            <ShieldCheck v-else class="h-4 w-4" />
            {{ busy ? '正在验证…' : '验证并登录' }}
          </button>
        </div>

        <button
          type="button"
          :disabled="countdown > 0 || busy"
          class="w-full text-center text-xs text-mut transition-colors hover:text-brand1 disabled:cursor-not-allowed disabled:text-faint"
          @click="sendCode"
        >
          {{ countdown > 0 ? `${countdown} 秒后可重新发送` : '没有收到？重新发送验证码' }}
        </button>
      </form>

      <div v-else class="flex flex-col items-center py-8 text-center">
        <span class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/12">
          <CheckCircle2 class="h-8 w-8 text-emerald-500" />
        </span>
        <h3 class="mt-4 text-lg font-semibold text-ink">登录成功</h3>
        <p class="mt-1 text-sm text-mut">正在恢复你的云端工作区…</p>
      </div>
    </div>
  </AppDialog>
</template>

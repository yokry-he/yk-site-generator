<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Check,
  CheckCircle2,
  Globe,
  Loader2,
  Plug,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-vue-next'
import AppDialog from './AppDialog.vue'
import AppSelect from './AppSelect.vue'
import { MODEL_PROVIDERS, providerById } from '../data/providers'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'

const { open } = useModelDialog()
const { connections, activeId, save, remove, setActive } = useModelConfig()

const selectedId = ref(activeId.value ?? MODEL_PROVIDERS[0].id)
const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const test = ref<'idle' | 'testing' | 'ok' | 'fail'>('idle')
const testMsg = ref('')

const provider = computed(() => providerById(selectedId.value) ?? MODEL_PROVIDERS[0])
const saved = computed(() => connections.value[provider.value.id])
const connectedIds = computed(() => new Set(Object.keys(connections.value)))
const modelGroups = computed(() => [
  { options: provider.value.models.map((m) => ({ value: m, label: m })) },
])

// 切换厂商时回填已保存配置或默认值
watch(selectedId, (id) => {
  const p = providerById(id) ?? MODEL_PROVIDERS[0]
  const conn = connections.value[id]
  apiKey.value = conn?.apiKey ?? ''
  baseUrl.value = conn?.baseUrl ?? p.defaultBaseUrl
  model.value = conn?.model ?? p.defaultModel
  test.value = 'idle'
  testMsg.value = ''
})

// Dialog 打开时定位到当前使用中的厂商
watch(open, (v) => {
  if (v && activeId.value) selectedId.value = activeId.value
})

/** 真实测试连接:走服务端 /api/providers/test(SF-1-4),失败时给出降级提示 */
async function runTest() {
  if (!apiKey.value.trim() || apiKey.value.trim().length < provider.value.keyMinLength) {
    test.value = 'fail'
    testMsg.value = `Key 格式似乎不正确:${provider.value.keyHint},长度至少 ${provider.value.keyMinLength} 位`
    return
  }
  test.value = 'testing'
  testMsg.value = ''
  try {
    const res = await fetch('/api/providers/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: provider.value.id,
        apiKey: apiKey.value.trim(),
        baseUrl: baseUrl.value.trim() || undefined,
        model: model.value || undefined,
      }),
    })
    const json = (await res.json()) as {
      ok?: boolean
      latencyMs?: number
      error?: { code: string; message: string }
    }
    if (res.ok && json.ok) {
      test.value = 'ok'
      testMsg.value = `连接成功,延迟 ${json.latencyMs ?? '-'} ms`
    } else {
      test.value = 'fail'
      testMsg.value = json.error?.message ?? `服务返回异常(HTTP ${res.status})`
    }
  } catch {
    // 服务端不可达(未启动/跨域/断网)时的降级提示
    test.value = 'fail'
    testMsg.value = '无法连接生成服务,请确认本地服务端已启动(pnpm --filter server dev)或稍后再试'
  }
}

function handleSave() {
  if (!apiKey.value.trim()) return
  save(provider.value.id, {
    apiKey: apiKey.value.trim(),
    baseUrl: baseUrl.value.trim() || provider.value.defaultBaseUrl,
    model: model.value,
  })
}
</script>

<template>
  <AppDialog
    :open="open"
    title="模型设置"
    description="接入你常用的大模型厂商,AI 生成将使用你选择的模型。"
    width-class="max-w-3xl"
    @update:open="open = $event"
  >
    <template #icon>
      <Plug class="h-5 w-5 text-brand1" />
    </template>

    <div class="grid min-h-0 md:grid-cols-[240px_1fr]">
      <!-- 厂商列表 -->
      <div class="max-h-40 overflow-y-auto border-b border-line/10 p-2 md:max-h-[55vh] md:border-r md:border-b-0">
        <button
          v-for="p in MODEL_PROVIDERS"
          :key="p.id"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors"
          :class="selectedId === p.id ? 'bg-brand1/12' : 'hover:bg-ink/5'"
          @click="selectedId = p.id"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            :style="{ background: p.color }"
          >
            {{ p.name.slice(0, 1) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink">{{ p.name }}</span>
            <span class="block truncate text-[11px] text-faint">{{ p.domain }}</span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-0.5">
            <span
              v-if="activeId === p.id"
              class="rounded bg-brand1/15 px-1.5 py-0.5 text-[10px] font-medium text-brand1"
            >
              使用中
            </span>
            <span
              v-else-if="connectedIds.has(p.id)"
              class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500"
            >
              已接入
            </span>
          </span>
        </button>
      </div>

      <!-- 接入表单 -->
      <div class="max-h-[55vh] overflow-y-auto p-6">
        <div class="mb-5 flex items-center gap-2.5">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
            :style="{ background: provider.color }"
          >
            {{ provider.name.slice(0, 1) }}
          </span>
          <div>
            <p class="text-sm font-semibold text-ink">{{ provider.name }}</p>
            <p class="flex items-center gap-1 text-xs text-faint">
              <Globe class="h-3 w-3" />
              {{ provider.domain }}
            </p>
          </div>
          <button
            v-if="saved && activeId !== provider.id"
            class="ml-auto rounded-lg border border-line/15 px-3 py-1.5 text-xs text-sub transition-colors hover:bg-ink/5"
            @click="setActive(provider.id)"
          >
            设为当前模型
          </button>
        </div>

        <label class="mb-1.5 block text-xs font-medium text-sub">API Key</label>
        <input
          v-model="apiKey"
          type="password"
          :placeholder="`输入 ${provider.name} 的 API Key(${provider.keyHint})`"
          class="w-full rounded-lg border border-line/15 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-brand1/50"
          autocomplete="off"
          @input="test = 'idle'"
        />

        <label class="mt-4 mb-1.5 block text-xs font-medium text-sub">Base URL(可选)</label>
        <input
          v-model="baseUrl"
          :placeholder="provider.defaultBaseUrl"
          class="w-full rounded-lg border border-line/15 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-brand1/50"
        />

        <label class="mt-4 mb-1.5 block text-xs font-medium text-sub">模型</label>
        <AppSelect v-model="model" :groups="modelGroups" placeholder="选择模型" />

        <!-- 测试结果反馈 -->
        <p
          v-if="test === 'ok'"
          class="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500"
        >
          <CheckCircle2 class="h-3.5 w-3.5" />
          {{ testMsg || '连接成功' }}
        </p>
        <p
          v-if="test === 'fail'"
          class="mt-4 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500"
        >
          <XCircle class="h-3.5 w-3.5" />
          {{ testMsg }}
        </p>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <button
            :disabled="test === 'testing'"
            class="flex items-center gap-1.5 rounded-lg border border-line/15 px-4 py-2 text-sm text-sub transition-colors hover:bg-ink/5 disabled:opacity-60"
            @click="runTest"
          >
            <Loader2 v-if="test === 'testing'" class="h-3.5 w-3.5 animate-spin" />
            <Plug v-else class="h-3.5 w-3.5" />
            {{ test === 'testing' ? '检测中……' : '测试连接' }}
          </button>
          <button
            :disabled="!apiKey.trim()"
            class="bg-brand-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleSave"
          >
            <Check class="h-3.5 w-3.5" />
            保存并启用
          </button>
          <button
            v-if="saved"
            class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10"
            @click="remove(provider.id)"
          >
            <Trash2 class="h-3.5 w-3.5" />
            删除
          </button>
        </div>

        <p class="mt-5 flex items-start gap-1.5 rounded-lg bg-ink/[0.04] px-3 py-2.5 text-xs leading-relaxed text-faint">
          <ShieldCheck class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          密钥仅保存在本地浏览器(localStorage),服务端只在转发给厂商的请求周期内使用,不存储、不记录。测试连接与生成时密钥会经服务端转发,部署环境请务必使用 HTTPS(本地开发 http 除外)。清除浏览器数据会同时删除已保存的密钥。
        </p>
      </div>
    </div>
  </AppDialog>
</template>

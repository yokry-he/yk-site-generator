<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Check,
  CheckCircle2,
  CircleAlert,
  Globe,
  Loader2,
  Plug,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-vue-next'
import AppDialog from './AppDialog.vue'
import AppSelect, { type SelectGroup } from './AppSelect.vue'
import { MODEL_PROVIDERS, providerById } from '../data/providers'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'
import { useToast } from '../composables/useToast'
import { apiUrl } from '../lib/api'

const { open } = useModelDialog()
const {
  connections,
  activeId,
  activeProvider,
  activeConnection,
  isConfigured,
  isVerified,
  save,
  remove,
  setActive,
} = useModelConfig()
const toast = useToast()

const selectedId = ref(activeId.value ?? MODEL_PROVIDERS[0].id)
const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const liveModels = ref<string[]>([])
const test = ref<'idle' | 'testing' | 'ok' | 'fail'>('idle')
const testMsg = ref('')
const verifiedFingerprint = ref('')
const verifiedAt = ref('')
const verifiedLatency = ref<number | undefined>()

const provider = computed(() => providerById(selectedId.value) ?? MODEL_PROVIDERS[0])
const saved = computed(() => connections.value[provider.value.id])
const connectedIds = computed(() => new Set(Object.keys(connections.value)))
const draftFingerprint = computed(() => JSON.stringify({
  provider: provider.value.id,
  apiKey: apiKey.value.trim(),
  baseUrl: (baseUrl.value.trim() || provider.value.defaultBaseUrl).replace(/\/$/u, ''),
  model: model.value.trim(),
}))
const draftVerified = computed(() => Boolean(verifiedAt.value && verifiedFingerprint.value === draftFingerprint.value))

function uniqueModels(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

const synchronizedModels = computed(() => uniqueModels([
  ...liveModels.value,
  ...(saved.value?.availableModels ?? []),
]))

const modelGroups = computed<SelectGroup[]>(() => {
  const used = new Set<string>()
  const groups: SelectGroup[] = []
  const addGroup = (label: string, values: readonly string[]) => {
    const options = uniqueModels(values)
      .filter((value) => !used.has(value))
      .map((value) => {
        used.add(value)
        return { value, label: value }
      })
    if (options.length) groups.push({ label, options })
  }

  addGroup('当前账号可用 · 实时同步', synchronizedModels.value)
  addGroup(`推荐模型 · 更新于 ${provider.value.catalogUpdatedAt}`, provider.value.models)
  addGroup('兼容旧配置', provider.value.legacyModels ?? [])
  if (model.value && !used.has(model.value)) addGroup('自定义模型 ID', [model.value])
  return groups
})

const modeTitle = computed(() => {
  if (isVerified.value) return '真实生成已验证'
  if (isConfigured.value) return '真实生成已配置，尚未验证'
  return '当前为演示模式'
})
const modeDescription = computed(() => {
  if (activeProvider.value && activeConnection.value) {
    const verified = activeConnection.value.verifiedAt
      ? `最近验证：${new Date(activeConnection.value.verifiedAt).toLocaleString('zh-CN')}`
      : '建议测试连接并同步模型目录。'
    return `${activeProvider.value.name} · ${activeConnection.value.model}。${verified}`
  }
  return '保存并启用任一厂商配置后，生成器会调用真实服务；内置项目和模板预览无需模型。'
})

function hydrateProvider(id: string) {
  const nextProvider = providerById(id) ?? MODEL_PROVIDERS[0]
  const connection = connections.value[id]
  apiKey.value = connection?.apiKey ?? ''
  baseUrl.value = connection?.baseUrl ?? nextProvider.defaultBaseUrl
  model.value = connection?.model ?? nextProvider.defaultModel
  liveModels.value = connection?.availableModels ?? []
  verifiedAt.value = connection?.verifiedAt ?? ''
  verifiedLatency.value = connection?.latencyMs
  verifiedFingerprint.value = connection?.verifiedAt
    ? JSON.stringify({
        provider: nextProvider.id,
        apiKey: connection.apiKey.trim(),
        baseUrl: (connection.baseUrl.trim() || nextProvider.defaultBaseUrl).replace(/\/$/u, ''),
        model: connection.model.trim(),
      })
    : ''
  test.value = 'idle'
  testMsg.value = ''
}

watch(selectedId, hydrateProvider, { immediate: true })
watch(open, (visible) => {
  if (!visible) return
  selectedId.value = activeId.value ?? selectedId.value
  hydrateProvider(selectedId.value)
})

/** Test the real connection and synchronize models visible to this API key. */
async function runTest() {
  if (!apiKey.value.trim() || apiKey.value.trim().length < provider.value.keyMinLength) {
    test.value = 'fail'
    testMsg.value = `Key 格式似乎不正确：${provider.value.keyHint}，长度至少 ${provider.value.keyMinLength} 位`
    return
  }
  if (!model.value.trim()) {
    test.value = 'fail'
    testMsg.value = '请输入或选择模型 ID。'
    return
  }

  test.value = 'testing'
  testMsg.value = ''
  verifiedFingerprint.value = ''
  try {
    const response = await fetch(apiUrl('/api/providers/test'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: provider.value.id,
        apiKey: apiKey.value.trim(),
        baseUrl: baseUrl.value.trim() || undefined,
        model: model.value.trim(),
      }),
    })
    const json = (await response.json()) as {
      ok?: boolean
      latencyMs?: number
      models?: string[]
      catalogSource?: 'provider' | 'unavailable'
      selectedModelAvailable?: boolean
      error?: { code: string; message: string }
    }
    if (response.ok && json.ok) {
      liveModels.value = uniqueModels(json.models ?? [])
      test.value = 'ok'
      verifiedAt.value = new Date().toISOString()
      verifiedLatency.value = json.latencyMs
      verifiedFingerprint.value = draftFingerprint.value
      const catalogMessage = liveModels.value.length
        ? `已同步 ${liveModels.value.length} 个文本生成模型`
        : '连接有效，但厂商未返回可解析的模型目录'
      const selectedMessage = json.selectedModelAvailable === false
        ? '；当前模型未出现在目录中，仍可按自定义模型 ID 保存'
        : ''
      testMsg.value = `连接成功，延迟 ${json.latencyMs ?? '-'} ms；${catalogMessage}${selectedMessage}`
    } else {
      test.value = 'fail'
      testMsg.value = json.error?.message ?? `服务返回异常（HTTP ${response.status}）`
    }
  } catch {
    test.value = 'fail'
    testMsg.value = '无法连接生成服务，请确认 Server 已启动、VITE_API_BASE_URL/CORS 配置正确，或稍后再试。'
  }
}

function handleSave() {
  if (!apiKey.value.trim() || !model.value.trim()) return
  save(provider.value.id, {
    apiKey: apiKey.value.trim(),
    baseUrl: baseUrl.value.trim() || provider.value.defaultBaseUrl,
    model: model.value.trim(),
    availableModels: synchronizedModels.value,
    verifiedAt: draftVerified.value ? verifiedAt.value : undefined,
    latencyMs: draftVerified.value ? verifiedLatency.value : undefined,
  })
  toast.success(
    draftVerified.value ? '真实生成已验证并启用' : '真实生成配置已启用',
    `${provider.value.name} · ${model.value.trim()}`,
  )
}
</script>

<template>
  <AppDialog
    :open="open"
    title="模型设置"
    description="接入真实大模型服务；推荐列表可用作起点，测试连接会同步当前账号实际可用的模型。"
    width-class="max-w-3xl"
    @update:open="open = $event"
  >
    <template #icon>
      <Plug class="h-5 w-5 text-brand1" />
    </template>

    <div class="border-b border-line/10 px-5 py-4">
      <div
        class="flex items-start gap-3 rounded-xl border px-3.5 py-3"
        :class="isVerified ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : isConfigured ? 'border-amber-500/25 bg-amber-500/[0.07]' : 'border-line/12 bg-ink/[0.035]'"
      >
        <Radio v-if="isVerified" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <CircleAlert v-else class="mt-0.5 h-4 w-4 shrink-0" :class="isConfigured ? 'text-amber-500' : 'text-faint'" />
        <div>
          <p class="text-xs font-semibold text-ink">{{ modeTitle }}</p>
          <p class="mt-1 text-[11px] leading-5 text-sub">{{ modeDescription }}</p>
        </div>
      </div>
    </div>

    <div class="grid min-h-0 md:grid-cols-[240px_1fr]">
      <div class="max-h-40 overflow-y-auto border-b border-line/10 p-2 md:max-h-[55vh] md:border-r md:border-b-0">
        <button
          v-for="item in MODEL_PROVIDERS"
          :key="item.id"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors"
          :class="selectedId === item.id ? 'bg-brand1/12' : 'hover:bg-ink/5'"
          @click="selectedId = item.id"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" :style="{ background: item.color }">
            {{ item.name.slice(0, 1) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-ink">{{ item.name }}</span>
            <span class="block truncate text-[11px] text-faint">{{ item.domain }}</span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-0.5">
            <span v-if="activeId === item.id" class="rounded bg-brand1/15 px-1.5 py-0.5 text-[10px] font-medium text-sub">使用中</span>
            <span v-else-if="connectedIds.has(item.id)" class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">已接入</span>
          </span>
        </button>
      </div>

      <div class="max-h-[58vh] overflow-y-auto p-6">
        <div class="mb-5 flex items-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" :style="{ background: provider.color }">
            {{ provider.name.slice(0, 1) }}
          </span>
          <div>
            <p class="text-sm font-semibold text-ink">{{ provider.name }}</p>
            <p class="flex items-center gap-1 text-xs text-faint"><Globe class="h-3 w-3" />{{ provider.domain }}</p>
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
          :placeholder="`输入 ${provider.name} 的 API Key（${provider.keyHint}）`"
          class="w-full rounded-lg border border-line/15 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-brand1/50"
          autocomplete="off"
          @input="test = 'idle'"
        />

        <label class="mt-4 mb-1.5 block text-xs font-medium text-sub">Base URL（可选）</label>
        <input
          v-model="baseUrl"
          :placeholder="provider.defaultBaseUrl"
          class="w-full rounded-lg border border-line/15 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-faint focus:border-brand1/50"
          @input="test = 'idle'"
        />

        <label class="mt-4 mb-1.5 block text-xs font-medium text-sub">模型目录</label>
        <AppSelect v-model="model" :groups="modelGroups" placeholder="从推荐或实时目录选择" />
        <div class="mt-2 flex items-center gap-2">
          <input
            v-model="model"
            class="min-w-0 flex-1 rounded-lg border border-line/15 bg-app/60 px-3 py-2 text-xs font-mono text-ink outline-none placeholder:text-faint focus:border-brand1/50"
            placeholder="也可以直接输入模型 ID 或 ep-... 推理接入点"
            @input="test = 'idle'"
          />
          <button
            type="button"
            class="flex shrink-0 items-center gap-1 rounded-lg border border-line/15 px-2.5 py-2 text-xs text-sub hover:bg-ink/5"
            :disabled="test === 'testing'"
            @click="runTest"
          >
            <RefreshCw class="h-3.5 w-3.5" :class="test === 'testing' && 'animate-spin'" />同步
          </button>
        </div>
        <p class="mt-2 text-[10px] leading-5 text-faint">
          推荐列表更新于 {{ provider.catalogUpdatedAt }}；测试连接后，以厂商对当前 API Key 返回的实时目录为准。火山方舟等平台也可填写自定义 `ep-...` 接入点。
        </p>

        <p v-if="test === 'ok'" class="mt-4 flex items-start gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs leading-5 text-emerald-500">
          <CheckCircle2 class="mt-0.5 h-3.5 w-3.5 shrink-0" />{{ testMsg || '连接成功' }}
        </p>
        <p v-if="test === 'fail'" class="mt-4 flex items-start gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-500">
          <XCircle class="mt-0.5 h-3.5 w-3.5 shrink-0" />{{ testMsg }}
        </p>

        <div class="mt-5 flex flex-wrap items-center gap-2">
          <button
            :disabled="test === 'testing'"
            class="flex items-center gap-1.5 rounded-lg border border-line/15 px-4 py-2 text-sm text-sub transition-colors hover:bg-ink/5 disabled:opacity-60"
            @click="runTest"
          >
            <Loader2 v-if="test === 'testing'" class="h-3.5 w-3.5 animate-spin" />
            <Plug v-else class="h-3.5 w-3.5" />
            {{ test === 'testing' ? '检测并同步中……' : '测试连接并同步模型' }}
          </button>
          <button
            :disabled="!apiKey.trim() || !model.trim()"
            class="bg-brand-gradient flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            @click="handleSave"
          >
            <Check class="h-3.5 w-3.5" />保存并启用真实生成
          </button>
          <button v-if="saved" class="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-500 transition-colors hover:bg-red-500/10" @click="remove(provider.id)">
            <Trash2 class="h-3.5 w-3.5" />删除
          </button>
        </div>

        <p class="mt-5 flex items-start gap-1.5 rounded-lg bg-ink/[0.04] px-3 py-2.5 text-xs leading-relaxed text-faint">
          <ShieldCheck class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          密钥仅保存在本地浏览器（localStorage），服务端只在测试或生成请求周期内转发，不持久化、不记录。部署环境必须使用 HTTPS（本地开发除外）。清除浏览器数据会删除已保存密钥。
        </p>
      </div>
    </div>
  </AppDialog>
</template>

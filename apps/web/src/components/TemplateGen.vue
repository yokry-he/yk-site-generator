<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Binary,
  CheckCircle2,
  Download,
  Eye,
  FileArchive,
  FileText,
  FolderOpen,
  Loader2,
  PackageOpen,
  SlidersHorizontal,
  Sparkles,
  ToggleLeft,
  UploadCloud,
  Wand2,
} from 'lucide-vue-next'
import AppSwitch from './AppSwitch.vue'
import { useToast } from '../composables/useToast'
import {
  downloadBlob,
  generateZip,
  groupVariables,
  loadSampleTemplate,
  parseZipFile,
  renderTemplatePreview,
  sampleValueFor,
  SAMPLE_TEMPLATE_NAME,
  type ParsedTemplate,
  type TemplateValue,
} from '../lib/templateEngine'

const toast = useToast()
const parsed = ref<ParsedTemplate | null>(null)
const sourceName = ref('')
const values = ref<Record<string, TemplateValue>>({})
const keepUnfilled = ref(true)
const dragOver = ref(false)
const loading = ref(false)
const generating = ref(false)
const mobileTab = ref<'form' | 'preview'>('form')
const stats = ref<{
  replaced: number
  files: number
  conditions: number
  warnings: string[]
} | null>(null)
const inputRef = ref<HTMLInputElement>()

const varGroups = computed(() => (parsed.value ? groupVariables(parsed.value.variables) : {}))
const varCount = computed(() => (parsed.value ? Object.keys(parsed.value.variables).length : 0))
const booleanCount = computed(() =>
  parsed.value ? Object.values(parsed.value.variables).filter((variable) => variable.kind === 'boolean').length : 0,
)
const previewHtml = computed(() =>
  parsed.value ? renderTemplatePreview(parsed.value, values.value, keepUnfilled.value) : null,
)

function reset(template: ParsedTemplate, name: string) {
  parsed.value = template
  sourceName.value = name
  values.value = Object.fromEntries(
    Object.entries(template.variables).map(([key, meta]) => [key, meta.kind === 'boolean' ? false : '']),
  )
  stats.value = null
  mobileTab.value = 'form'
}

async function handleFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    toast.error('请上传 .zip 格式的模板压缩包')
    return
  }
  loading.value = true
  try {
    const template = await parseZipFile(file)
    reset(template, file.name.replace(/\.zip$/i, ''))
    toast.success(
      '模板解析完成',
      `发现 ${template.files.length} 个文件、${Object.keys(template.variables).length} 个变量`,
    )
  } catch (err) {
    toast.error('压缩包解析失败', err instanceof Error ? err.message : '请确认是有效的 zip 文件')
  } finally {
    loading.value = false
  }
}

async function handleSample() {
  loading.value = true
  try {
    const template = await loadSampleTemplate()
    reset(template, SAMPLE_TEMPLATE_NAME)
    fillSamples()
    toast.success('已载入内置示例模板', '包含嵌套条件块、布尔开关与实时预览')
  } finally {
    loading.value = false
  }
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void handleFile(file)
}

function fillSamples() {
  if (!parsed.value) return
  const next: Record<string, TemplateValue> = {}
  for (const [name, meta] of Object.entries(parsed.value.variables)) {
    next[name] = meta.kind === 'boolean' ? true : sampleValueFor(name)
  }
  values.value = next
}

async function handleGenerate() {
  if (!parsed.value) return
  generating.value = true
  try {
    const result = await generateZip(parsed.value, values.value, keepUnfilled.value)
    downloadBlob(result.blob, `${sourceName.value || 'project'}-generated.zip`)
    stats.value = {
      replaced: result.replacedCount,
      files: result.affectedFiles,
      conditions: result.evaluatedConditions,
      warnings: result.warnings,
    }
    if (result.warnings.length) {
      toast.info('项目已生成,但模板存在语法提示', result.warnings[0])
    } else {
      toast.success('项目已生成并开始下载')
    }
  } catch (err) {
    toast.error('生成失败', err instanceof Error ? err.message : '请重试')
  } finally {
    generating.value = false
  }
}

function variableLocation(name: string): string {
  return parsed.value?.variables[name]?.files.join('、') ?? ''
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-5">
    <div class="rounded-2xl border border-line/10 bg-soft/60 p-6 lg:col-span-2">
      <input
        ref="inputRef"
        type="file"
        accept=".zip"
        class="hidden"
        @change="
          (event) => {
            const file = (event.target as HTMLInputElement).files?.[0]
            if (file) handleFile(file)
            ;(event.target as HTMLInputElement).value = ''
          }
        "
      />
      <div
        class="flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all"
        :class="dragOver ? 'border-brand1/60 bg-brand1/10' : 'border-line/15 hover:border-brand1/40 hover:bg-ink/[0.03]'"
        @click="inputRef?.click()"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <Loader2 v-if="loading" class="h-8 w-8 animate-spin text-brand1" />
        <UploadCloud v-else class="h-8 w-8 text-brand1" />
        <p class="text-sm font-medium text-ink">点击选择或拖拽上传 .zip 模板</p>
        <div class="space-y-1 text-xs leading-relaxed text-faint">
          <p><code class="rounded bg-ink/8 px-1 font-mono">$M{变量名}</code> 替换文字</p>
          <p><code class="rounded bg-ink/8 px-1 font-mono">$M{if 条件}</code> 控制内容显隐</p>
        </div>
      </div>

      <button
        :disabled="loading"
        class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line/12 bg-ink/[0.04] py-2.5 text-sm text-sub transition-colors hover:bg-ink/8 disabled:opacity-60"
        @click="handleSample"
      >
        <Sparkles class="h-4 w-4 text-brand2" />
        使用带条件块的内置示例
      </button>

      <div v-if="parsed" class="mt-5">
        <div class="mb-2 flex items-center justify-between gap-2 text-xs">
          <p class="flex min-w-0 items-center gap-1.5 font-medium text-sub">
            <FolderOpen class="h-3.5 w-3.5 shrink-0 text-brand1" />
            <span class="truncate">{{ sourceName }}.zip · {{ parsed.files.length }} 个文件</span>
          </p>
          <span v-if="booleanCount" class="shrink-0 rounded-full bg-brand2/12 px-2 py-0.5 text-[10px] text-brand2">
            {{ booleanCount }} 个开关
          </span>
        </div>
        <div class="max-h-64 space-y-1 overflow-y-auto pr-1">
          <div
            v-for="file in parsed.files"
            :key="file.path"
            class="flex items-center gap-2 rounded-lg bg-ink/[0.03] px-2.5 py-1.5 text-xs"
          >
            <FileText v-if="file.isText" class="h-3.5 w-3.5 shrink-0 text-brand2" />
            <Binary v-else class="h-3.5 w-3.5 shrink-0 text-faint" />
            <span class="min-w-0 flex-1 truncate font-mono text-sub">{{ file.path }}</span>
            <span
              v-if="file.isText && (Object.keys(file.varHits).length || Object.keys(file.conditionHits).length)"
              class="shrink-0 rounded bg-brand1/15 px-1.5 py-0.5 text-[10px] text-brand1"
            >
              {{ Object.values(file.varHits).reduce((a, b) => a + b, 0) }} 变量 ·
              {{ Object.values(file.conditionHits).reduce((a, b) => a + b, 0) }} 条件
            </span>
            <span v-else-if="!file.isText" class="shrink-0 rounded bg-ink/8 px-1.5 py-0.5 text-[10px] text-faint">
              二进制
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-line/10 bg-soft/60 lg:col-span-3">
      <div v-if="!parsed" class="flex h-full min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]">
          <PackageOpen class="h-6 w-6 text-faint" />
        </div>
        <p class="text-sm text-faint">上传模板压缩包,或载入内置示例模板</p>
        <p class="max-w-xs text-xs leading-relaxed text-faint">解析后会生成变量表单、布尔开关和实时网站预览。</p>
      </div>

      <div v-else-if="varCount === 0" class="flex h-full min-h-80 flex-col items-center justify-center gap-2 p-6 text-center">
        <FileArchive class="h-8 w-8 text-faint" />
        <p class="text-sm text-faint">未在模板中发现变量或条件</p>
        <p class="text-xs text-faint">使用 $M{xxx.yyy} 或 $M{if xxx} 语法后重新上传</p>
      </div>

      <div v-else class="flex min-h-[540px] flex-col">
        <div class="flex items-center justify-between gap-3 border-b border-line/10 px-5 py-3">
          <div class="flex items-center gap-2">
            <SlidersHorizontal class="h-4 w-4 text-brand1" />
            <p class="text-sm font-medium text-ink">模板变量</p>
            <span class="rounded-md bg-brand1/15 px-2 py-0.5 text-xs text-brand1">{{ varCount }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex rounded-lg bg-ink/[0.04] p-1 lg:hidden">
              <button
                class="rounded-md px-2.5 py-1 text-xs"
                :class="mobileTab === 'form' ? 'bg-soft font-medium text-ink shadow' : 'text-faint'"
                @click="mobileTab = 'form'"
              >
                表单
              </button>
              <button
                class="rounded-md px-2.5 py-1 text-xs"
                :class="mobileTab === 'preview' ? 'bg-soft font-medium text-ink shadow' : 'text-faint'"
                @click="mobileTab = 'preview'"
              >
                预览
              </button>
            </div>
            <button
              class="flex items-center gap-1.5 rounded-lg border border-line/12 px-3 py-1.5 text-xs text-sub transition-colors hover:bg-ink/5"
              @click="fillSamples"
            >
              <Wand2 class="h-3.5 w-3.5 text-brand2" />
              填入示例
            </button>
          </div>
        </div>

        <div class="grid min-h-0 flex-1 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.35fr)]">
          <div
            class="min-h-0 border-line/10 p-5 lg:block lg:border-r"
            :class="mobileTab === 'form' ? 'block' : 'hidden'"
          >
            <div class="max-h-[390px] space-y-5 overflow-y-auto pr-1 lg:max-h-[420px]">
              <div v-for="(names, group) in varGroups" :key="group">
                <p class="mb-2 text-[11px] font-semibold tracking-wider text-faint uppercase">{{ group }}</p>
                <div class="space-y-3">
                  <div v-for="name in names" :key="name">
                    <div
                      v-if="parsed.variables[name].kind === 'boolean'"
                      class="flex items-center justify-between gap-3 rounded-xl border border-line/10 bg-app/45 px-3.5 py-3"
                    >
                      <div class="min-w-0">
                        <label class="flex items-center gap-1.5 truncate font-mono text-xs text-brand2">
                          <ToggleLeft class="h-3.5 w-3.5 shrink-0" />
                          {{ name }}
                        </label>
                        <p class="mt-1 truncate text-[10px] text-faint" :title="variableLocation(name)">
                          条件出现于:{{ variableLocation(name) }}
                        </p>
                      </div>
                      <AppSwitch
                        :checked="Boolean(values[name])"
                        @update:checked="values[name] = $event"
                      />
                    </div>
                    <template v-else>
                      <label
                        class="mb-1 block truncate font-mono text-xs text-brand2"
                        :title="variableLocation(name)"
                      >
                        {{ '$M{' + name + '}' }}
                      </label>
                      <input
                        :value="String(values[name] ?? '')"
                        :placeholder="`出现于:${variableLocation(name)}`"
                        :title="`出现于:${variableLocation(name)}`"
                        class="w-full rounded-lg border border-line/12 bg-app/60 px-3 py-2 text-sm text-ink outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:text-faint/70 focus:border-brand1/50"
                        @input="values[name] = ($event.target as HTMLInputElement).value"
                      />
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <label class="mt-4 flex cursor-pointer items-center gap-2 border-t border-line/10 pt-4 text-xs text-sub">
              <AppSwitch v-model:checked="keepUnfilled" />
              未填写的普通变量保留原样
            </label>
          </div>

          <div
            class="min-h-0 bg-app/35 p-4 lg:block"
            :class="mobileTab === 'preview' ? 'block' : 'hidden'"
          >
            <div class="flex h-full min-h-[390px] flex-col overflow-hidden rounded-xl border border-line/12 bg-white shadow-xl shadow-black/10">
              <div class="flex items-center gap-2 border-b border-black/10 bg-zinc-100 px-3 py-2 text-[10px] text-zinc-500">
                <Eye class="h-3.5 w-3.5" />
                实时预览
                <span class="ml-auto max-w-44 truncate">{{ sourceName }}</span>
              </div>
              <iframe
                v-if="previewHtml"
                :srcdoc="previewHtml"
                sandbox="allow-scripts"
                referrerpolicy="no-referrer"
                class="min-h-0 flex-1 bg-white"
                title="模板实时预览"
              />
              <div v-else class="flex flex-1 items-center justify-center p-6 text-center text-xs text-zinc-400">
                模板中没有可预览的 HTML 入口文件
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3 border-t border-line/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 text-xs">
            <p v-if="stats" class="flex items-center gap-1.5 text-emerald-500">
              <CheckCircle2 class="h-3.5 w-3.5 shrink-0" />
              替换 {{ stats.replaced }} 处 · 计算 {{ stats.conditions }} 个条件 · {{ stats.files }} 个文件
            </p>
            <p v-if="stats?.warnings.length" class="mt-1 truncate text-amber-600" :title="stats.warnings.join('\n')">
              {{ stats.warnings.length }} 条模板语法提示:{{ stats.warnings[0] }}
            </p>
            <p v-else-if="!stats" class="text-faint">变量变化会立即反映到右侧预览,确认后再导出 ZIP。</p>
          </div>
          <button
            :disabled="generating"
            class="bg-brand-gradient flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            @click="handleGenerate"
          >
            <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
            <Download v-else class="h-4 w-4" />
            生成项目并下载
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

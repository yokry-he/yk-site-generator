<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Binary,
  CheckCircle2,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  Loader2,
  PackageOpen,
  Sparkles,
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
  sampleValueFor,
  SAMPLE_TEMPLATE_NAME,
  type ParsedTemplate,
} from '../lib/templateEngine'

const toast = useToast()

const parsed = ref<ParsedTemplate | null>(null)
const sourceName = ref('')
const values = ref<Record<string, string>>({})
const keepUnfilled = ref(true)
const dragOver = ref(false)
const loading = ref(false)
const generating = ref(false)
const stats = ref<{ replaced: number; files: number } | null>(null)
const inputRef = ref<HTMLInputElement>()

const varGroups = computed(() => (parsed.value ? groupVariables(parsed.value.variables) : {}))
const varCount = computed(() => (parsed.value ? Object.keys(parsed.value.variables).length : 0))

function reset(p: ParsedTemplate, name: string) {
  parsed.value = p
  sourceName.value = name
  values.value = {}
  stats.value = null
}

async function handleFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    toast.error('请上传 .zip 格式的模板压缩包')
    return
  }
  loading.value = true
  try {
    const p = await parseZipFile(file)
    reset(p, file.name.replace(/\.zip$/i, ''))
    toast.success('模板解析完成', `发现 ${p.files.length} 个文件、${Object.keys(p.variables).length} 个变量`)
  } catch {
    toast.error('压缩包解析失败,请确认是有效的 zip 文件')
  } finally {
    loading.value = false
  }
}

async function handleSample() {
  loading.value = true
  try {
    const p = await loadSampleTemplate()
    reset(p, SAMPLE_TEMPLATE_NAME)
    toast.success('已载入内置示例模板', `一个个人主页模板,含 ${Object.keys(p.variables).length} 个变量`)
  } finally {
    loading.value = false
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) handleFile(f)
}

function fillSamples() {
  if (!parsed.value) return
  const next: Record<string, string> = {}
  for (const name of Object.keys(parsed.value.variables)) next[name] = sampleValueFor(name)
  values.value = next
}

async function handleGenerate() {
  if (!parsed.value) return
  generating.value = true
  try {
    const result = await generateZip(parsed.value, values.value, keepUnfilled.value)
    downloadBlob(result.blob, `${sourceName.value || 'project'}-generated.zip`)
    stats.value = { replaced: result.replacedCount, files: result.affectedFiles }
    toast.success('项目已生成并开始下载')
  } catch {
    toast.error('生成失败,请重试')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-5">
    <!-- 左侧:上传与文件列表 -->
    <div class="rounded-2xl border border-line/10 bg-soft/60 p-6 lg:col-span-2">
      <input
        ref="inputRef"
        type="file"
        accept=".zip"
        class="hidden"
        @change="
          (e) => {
            const f = (e.target as HTMLInputElement).files?.[0]
            if (f) handleFile(f)
            ;(e.target as HTMLInputElement).value = ''
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
        <p class="text-xs leading-relaxed text-faint">
          文本文件中使用
          <code class="rounded bg-ink/8 px-1 font-mono">$M{变量名}</code>
          声明可替换变量
        </p>
      </div>

      <button
        :disabled="loading"
        class="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-line/12 bg-ink/[0.04] py-2.5 text-sm text-sub transition-colors hover:bg-ink/8 disabled:opacity-60"
        @click="handleSample"
      >
        <Sparkles class="h-4 w-4 text-brand2" />
        使用内置示例模板(个人主页)
      </button>

      <!-- 文件列表 -->
      <div v-if="parsed" class="mt-5">
        <p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-sub">
          <FolderOpen class="h-3.5 w-3.5 text-brand1" />
          {{ sourceName }}.zip · {{ parsed.files.length }} 个文件
        </p>
        <div class="max-h-56 space-y-1 overflow-y-auto pr-1">
          <div
            v-for="f in parsed.files"
            :key="f.path"
            class="flex items-center gap-2 rounded-lg bg-ink/[0.03] px-2.5 py-1.5 text-xs"
          >
            <FileText v-if="f.isText" class="h-3.5 w-3.5 shrink-0 text-brand2" />
            <Binary v-else class="h-3.5 w-3.5 shrink-0 text-faint" />
            <span class="min-w-0 flex-1 truncate font-mono text-sub">{{ f.path }}</span>
            <span
              v-if="f.isText && Object.keys(f.varHits).length > 0"
              class="shrink-0 rounded bg-brand1/15 px-1.5 py-0.5 text-[10px] text-brand1"
            >
              {{ Object.values(f.varHits).reduce((a, b) => a + b, 0) }} 处变量
            </span>
            <span v-else-if="!f.isText" class="shrink-0 rounded bg-ink/8 px-1.5 py-0.5 text-[10px] text-faint">
              二进制
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右侧:变量表单与生成 -->
    <div class="rounded-2xl border border-line/10 bg-soft/60 p-6 lg:col-span-3">
      <div v-if="!parsed" class="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-line/20 bg-ink/[0.03]">
          <PackageOpen class="h-6 w-6 text-faint" />
        </div>
        <p class="text-sm text-faint">上传模板压缩包,或载入内置示例模板</p>
        <p class="max-w-xs text-xs leading-relaxed text-faint">
          解析后会自动扫描
          <code class="rounded bg-ink/8 px-1 font-mono">$M{site.title}</code>
          格式的变量并生成填写表单
        </p>
      </div>

      <div v-else-if="varCount === 0" class="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center">
        <FileArchive class="h-8 w-8 text-faint" />
        <p class="text-sm text-faint">未在模板中发现变量</p>
        <p class="text-xs text-faint">在文本文件中使用 $M{xxx.yyy} 语法声明变量后重新上传</p>
      </div>

      <div v-else>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-medium text-ink">
            填写变量值
            <span class="ml-2 rounded-md bg-brand1/15 px-2 py-0.5 text-xs text-brand1">{{ varCount }} 个变量</span>
          </p>
          <button
            class="flex items-center gap-1.5 rounded-lg border border-line/12 px-3 py-1.5 text-xs text-sub transition-colors hover:bg-ink/5"
            @click="fillSamples"
          >
            <Wand2 class="h-3.5 w-3.5 text-brand2" />
            填入示例值
          </button>
        </div>

        <div class="mt-4 max-h-72 space-y-5 overflow-y-auto pr-1">
          <div v-for="(names, group) in varGroups" :key="group">
            <p class="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">{{ group }}</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div v-for="name in names" :key="name">
                <label
                  class="mb-1 block truncate font-mono text-xs text-brand2"
                  :title="parsed.variables[name].files.join('、')"
                >
                  {{ '$M{' + name + '}' }}
                </label>
                <input
                  :value="values[name] ?? ''"
                  :placeholder="`出现于:${parsed.variables[name].files.join('、')}`"
                  :title="`出现于:${parsed.variables[name].files.join('、')}`"
                  class="w-full rounded-lg border border-line/12 bg-app/60 px-3 py-2 text-sm text-ink outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:text-faint/70 focus:border-brand1/50"
                  @input="values[name] = ($event.target as HTMLInputElement).value"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/10 pt-4">
          <label class="flex cursor-pointer items-center gap-2 text-xs text-sub">
            <AppSwitch v-model:checked="keepUnfilled" />
            未填写的变量保留原样
          </label>
          <button
            :disabled="generating"
            class="bg-brand-gradient flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            @click="handleGenerate"
          >
            <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
            <Download v-else class="h-4 w-4" />
            生成项目并下载
          </button>
        </div>

        <p
          v-if="stats"
          class="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500"
        >
          <CheckCircle2 class="h-3.5 w-3.5" />
          替换完成:共替换 {{ stats.replaced }} 处,涉及 {{ stats.files }} 个文件,二进制文件已原样保留
        </p>
      </div>
    </div>
  </div>
</template>

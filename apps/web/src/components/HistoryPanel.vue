<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  AlertTriangle,
  Check,
  Download,
  FolderOpen,
  History,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'
import {
  clearSessions,
  deleteSession,
  exportSessionJson,
  isQuotaError,
  LARGE_SESSION_BYTES,
  listSessions,
  parseSessionJson,
  renameSession,
  toMeta,
  upsertSession,
  type SessionMeta,
  type StoredSession,
} from '../lib/historyStore'
import { getSession } from '../lib/historyStore'
import { useToast } from '../composables/useToast'
import { SITE_TYPES } from '../data/siteTypes'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'openSession', s: StoredSession): void
}>()

const toast = useToast()
const items = ref<SessionMeta[]>([])
const loading = ref(true)
const renamingId = ref<string | null>(null)
const renameText = ref('')
const confirmDeleteId = ref<string | null>(null)
const confirmClear = ref(false)
const fileInputRef = ref<HTMLInputElement>()

function typeName(siteType: string): string {
  return SITE_TYPES.find((t) => t.id === siteType)?.name ?? siteType
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function fmtSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
}

function handleOpError(err: unknown, fallback: string) {
  if (isQuotaError(err)) {
    toast.error('存储空间不足', '浏览器本地存储已满,请清理部分历史会话后重试。')
  } else {
    toast.error(fallback, err instanceof Error ? err.message : undefined)
  }
}

async function reload() {
  loading.value = true
  try {
    items.value = (await listSessions()).map(toMeta)
  } catch (err) {
    handleOpError(err, '读取历史失败')
  } finally {
    loading.value = false
  }
}

async function openItem(meta: SessionMeta) {
  try {
    const s = await getSession(meta.id)
    if (s) emit('openSession', s)
  } catch (err) {
    handleOpError(err, '打开会话失败')
  }
}

function startRename(meta: SessionMeta) {
  renamingId.value = meta.id
  renameText.value = meta.title
  confirmDeleteId.value = null
}

async function commitRename() {
  if (!renamingId.value) return
  try {
    await renameSession(renamingId.value, renameText.value)
    await reload()
  } catch (err) {
    handleOpError(err, '重命名失败')
  } finally {
    renamingId.value = null
  }
}

async function removeItem(id: string) {
  try {
    await deleteSession(id)
    toast.success('已删除', '该会话已从本地历史移除。')
    await reload()
  } catch (err) {
    handleOpError(err, '删除失败')
  } finally {
    confirmDeleteId.value = null
  }
}

async function clearAll() {
  try {
    await clearSessions()
    toast.success('已清空', '全部历史会话已删除。')
    await reload()
  } catch (err) {
    handleOpError(err, '清空失败')
  } finally {
    confirmClear.value = false
  }
}

async function exportItem(meta: SessionMeta) {
  try {
    const s = await getSession(meta.id)
    if (!s) return
    const url = URL.createObjectURL(new Blob([exportSessionJson(s)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${meta.title.replace(/[\\/:*?"<>|]/g, '_')}.session.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    handleOpError(err, '导出失败')
  }
}

async function importFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!file) return
  try {
    const s = parseSessionJson(await file.text())
    await upsertSession(s)
    toast.success('导入成功', `会话「${s.title}」已恢复到本地历史。`)
    await reload()
  } catch (err) {
    if (isQuotaError(err)) handleOpError(err, '')
    else toast.error('导入失败', err instanceof Error ? err.message : '文件无法解析')
  }
}

onMounted(reload)
</script>

<template>
  <!-- 遮罩 -->
  <div class="fixed inset-0 z-40 bg-black/40" @click="emit('close')" />
  <!-- 抽屉 -->
  <aside class="fixed top-0 right-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-line/10 bg-soft shadow-2xl">
    <div class="flex items-center gap-2 border-b border-line/10 px-5 py-4">
      <History class="h-4.5 w-4.5 text-brand1" />
      <h2 class="text-sm font-semibold text-ink">生成历史</h2>
      <span class="text-xs text-faint">{{ items.length }} 条</span>
      <div class="ml-auto flex items-center gap-1">
        <button
          class="flex items-center gap-1 rounded-lg border border-line/12 px-2.5 py-1.5 text-xs text-sub transition-colors hover:bg-ink/5"
          title="从 JSON 文件导入会话"
          @click="fileInputRef?.click()"
        >
          <Upload class="h-3.5 w-3.5" />
          导入
        </button>
        <input ref="fileInputRef" type="file" accept=".json,application/json" class="hidden" @change="importFile" />
        <button class="rounded-lg p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink" @click="emit('close')">
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <div v-if="loading" class="py-16 text-center text-xs text-faint">读取中……</div>
      <div v-else-if="items.length === 0" class="flex flex-col items-center gap-3 py-16 text-center">
        <History class="h-10 w-10 text-faint/50" />
        <p class="text-sm text-mut">还没有生成历史</p>
        <p class="max-w-56 text-xs leading-relaxed text-faint">
          接入模型并完成一次真实生成后,会话(含全部迭代轮次)会自动保存在这里
        </p>
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="meta in items"
          :key="meta.id"
          class="group rounded-xl border border-line/10 bg-app/60 p-3 transition-colors hover:border-brand1/30"
        >
          <!-- 标题行 / 重命名行 -->
          <div v-if="renamingId === meta.id" class="flex items-center gap-1.5">
            <input
              v-model="renameText"
              class="min-w-0 flex-1 rounded-md border border-brand1/40 bg-app px-2 py-1 text-sm text-ink outline-none"
              @keyup.enter="commitRename"
              @keyup.esc="renamingId = null"
            />
            <button class="rounded-md p-1 text-emerald-500 hover:bg-ink/5" @click="commitRename">
              <Check class="h-4 w-4" />
            </button>
            <button class="rounded-md p-1 text-faint hover:bg-ink/5" @click="renamingId = null">
              <X class="h-4 w-4" />
            </button>
          </div>
          <template v-else>
            <div class="flex items-center gap-2">
              <span class="shrink-0 rounded bg-brand1/10 px-1.5 py-0.5 text-[10px] font-medium text-brand1">
                {{ typeName(meta.siteType) }}
              </span>
              <p class="min-w-0 flex-1 truncate text-sm font-medium text-ink" :title="meta.title">
                {{ meta.title }}
              </p>
            </div>
            <div class="mt-1.5 flex items-center gap-2 text-[11px] text-faint">
              <span>{{ meta.roundCount }} 轮</span>
              <span>·</span>
              <span>{{ fmtTime(meta.updatedAt) }}</span>
              <span v-if="meta.model">·</span>
              <span v-if="meta.model" class="truncate">{{ meta.model }}</span>
              <span
                v-if="meta.htmlBytes > LARGE_SESSION_BYTES"
                class="flex items-center gap-0.5 text-amber-600"
                :title="`HTML 总量 ${fmtSize(meta.htmlBytes)}`"
              >
                <AlertTriangle class="h-3 w-3" />
                该会话较大
              </span>
            </div>
            <!-- 操作行 -->
            <div class="mt-2 flex items-center gap-1">
              <template v-if="confirmDeleteId === meta.id">
                <span class="text-[11px] text-red-500">确认删除?</span>
                <button class="rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-500" @click="removeItem(meta.id)">
                  删除
                </button>
                <button class="rounded-md px-2 py-1 text-[11px] text-faint hover:text-ink" @click="confirmDeleteId = null">
                  取消
                </button>
              </template>
              <template v-else>
                <button
                  class="flex items-center gap-1 rounded-md bg-brand1/10 px-2.5 py-1 text-[11px] font-medium text-brand1 transition-colors hover:bg-brand1/20"
                  @click="openItem(meta)"
                >
                  <FolderOpen class="h-3 w-3" />
                  打开
                </button>
                <button class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink" title="重命名" @click="startRename(meta)">
                  <Pencil class="h-3.5 w-3.5" />
                </button>
                <button class="rounded-md p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink" title="导出 JSON" @click="exportItem(meta)">
                  <Download class="h-3.5 w-3.5" />
                </button>
                <button class="rounded-md p-1.5 text-faint transition-colors hover:bg-red-500/10 hover:text-red-500" title="删除" @click="confirmDeleteId = meta.id">
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </template>
            </div>
          </template>
        </li>
      </ul>
    </div>

    <!-- 底部:清空 -->
    <div v-if="items.length > 0" class="border-t border-line/10 px-5 py-3">
      <div v-if="confirmClear" class="flex items-center justify-between">
        <span class="text-xs text-red-500">确认清空全部 {{ items.length }} 条历史?</span>
        <div class="flex gap-2">
          <button class="rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500" @click="clearAll">
            全部删除
          </button>
          <button class="rounded-md px-3 py-1.5 text-xs text-faint hover:text-ink" @click="confirmClear = false">
            取消
          </button>
        </div>
      </div>
      <button v-else class="text-xs text-faint transition-colors hover:text-red-500" @click="confirmClear = true">
        清空全部历史
      </button>
    </div>
  </aside>
</template>

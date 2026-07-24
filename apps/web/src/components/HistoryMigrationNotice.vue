<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { CloudUpload, History, Loader2, X } from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { migrateLocalSessions, pendingLocalSessions } from '../lib/historyMigration'
import type { StoredSession } from '../lib/historyStore'

const { user } = useAuth()
const toast = useToast()
const pending = ref<StoredSession[]>([])
const visible = ref(false)
const busy = ref(false)
let disposed = false

async function inspect() {
  if (!user.value || sessionStorage.getItem(`siteforge:migration-dismissed:${user.value.id}`)) {
    visible.value = false
    return
  }
  try {
    const rows = await pendingLocalSessions(user.value.id)
    if (disposed) return
    pending.value = rows
    visible.value = rows.length > 0
  } catch {
    visible.value = false
  }
}

function dismiss() {
  if (user.value) sessionStorage.setItem(`siteforge:migration-dismissed:${user.value.id}`, '1')
  visible.value = false
}

async function migrate() {
  if (!user.value || busy.value) return
  busy.value = true
  try {
    const result = await migrateLocalSessions(user.value.id, pending.value)
    if (result.migrated) {
      toast.success('本地历史迁移完成', `已创建 ${result.migrated} 个云端项目,本地记录仍然保留。`)
      window.dispatchEvent(new CustomEvent('siteforge:projects-updated'))
    }
    if (result.failed.length) {
      toast.error('部分历史迁移失败', `${result.failed.length} 个会话未迁移,可稍后再次尝试。`)
    }
    await inspect()
  } finally {
    busy.value = false
  }
}

watch(user, inspect, { immediate: true })
onBeforeUnmount(() => {
  disposed = true
})
</script>

<template>
  <Transition name="migration">
    <aside
      v-if="visible"
      class="fixed right-4 bottom-4 z-[70] w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-brand1/20 bg-soft/95 shadow-2xl shadow-black/20 backdrop-blur-xl"
      aria-live="polite"
    >
      <div class="flex items-start gap-3 p-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand1/10">
          <History class="h-5 w-5 text-brand1" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-ink">发现 {{ pending.length }} 条本地生成历史</p>
          <p class="mt-1 text-xs leading-5 text-mut">可迁移为云端项目并保留每一轮版本。迁移不会删除浏览器中的本地记录。</p>
        </div>
        <button class="rounded-lg p-1 text-faint hover:bg-ink/5 hover:text-ink" aria-label="暂不迁移" @click="dismiss">
          <X class="h-4 w-4" />
        </button>
      </div>
      <div class="flex items-center justify-between gap-3 border-t border-line/10 bg-brand1/[0.035] px-4 py-3">
        <span class="truncate text-[10px] text-faint">支持完整迭代轮次迁移</span>
        <button
          :disabled="busy"
          class="bg-brand-gradient flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50"
          @click="migrate"
        >
          <Loader2 v-if="busy" class="h-3.5 w-3.5 animate-spin" />
          <CloudUpload v-else class="h-3.5 w-3.5" />
          {{ busy ? '正在迁移…' : '迁移到云端' }}
        </button>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.migration-enter-active,.migration-leave-active{transition:opacity .2s ease,transform .2s ease}.migration-enter-from,.migration-leave-to{opacity:0;transform:translateY(10px)}
</style>

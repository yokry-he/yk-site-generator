<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, Trash2, TriangleAlert } from 'lucide-vue-next'
import AppDrawer from './ui/AppDrawer.vue'
import { useNotifications, type NotificationKind } from '../composables/useNotifications'

const open = ref(false)
const filter = ref<'all' | 'unread'>('all')
const { items, unreadCount, markRead, markAllRead, remove, clear } = useNotifications()
const visible = computed(() => filter.value === 'unread' ? items.value.filter((item) => !item.readAt) : items.value)
const icons: Record<NotificationKind, typeof Info> = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert }
const classes: Record<NotificationKind, string> = { info: 'bg-sky-500/10 text-sky-500', success: 'bg-emerald-500/10 text-emerald-500', warning: 'bg-amber-500/10 text-amber-500', error: 'bg-red-500/10 text-red-500' }

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}
function activate(item: (typeof items.value)[number]) {
  markRead(item.id)
  if (item.href) window.location.assign(item.href)
}
</script>

<template>
  <button class="fixed right-5 bottom-16 z-40 grid h-10 w-10 place-items-center rounded-full border border-line/10 bg-soft/90 text-faint shadow-xl backdrop-blur transition hover:border-brand1/25 hover:text-brand1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/50 lg:right-6 lg:bottom-20" aria-label="打开通知中心" @click="open = true">
    <Bell class="h-4 w-4" />
    <span v-if="unreadCount" class="absolute -top-1 -right-1 min-w-4 rounded-full bg-red-500 px-1 py-0.5 text-center text-[8px] font-bold text-white">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
  </button>

  <AppDrawer :open="open" title="通知中心" description="重要完成状态、恢复提醒和需要关注的错误会保留在这里。" width="md" @close="open = false">
    <div class="flex items-center justify-between gap-3 border-b border-line/10 p-4">
      <div class="flex rounded-xl bg-ink/[0.045] p-1">
        <button class="rounded-lg px-3 py-1.5 text-xs" :class="filter === 'all' ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-faint'" @click="filter = 'all'">全部 {{ items.length }}</button>
        <button class="rounded-lg px-3 py-1.5 text-xs" :class="filter === 'unread' ? 'bg-soft font-semibold text-ink shadow-sm' : 'text-faint'" @click="filter = 'unread'">未读 {{ unreadCount }}</button>
      </div>
      <button v-if="unreadCount" class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] text-brand1 hover:bg-brand1/8" @click="markAllRead"><CheckCheck class="h-3.5 w-3.5" />全部已读</button>
    </div>

    <div v-if="visible.length" class="divide-y divide-line/8">
      <article v-for="item in visible" :key="item.id" class="group relative p-4 transition hover:bg-ink/[0.025]" :class="!item.readAt && 'bg-brand1/[0.025]'">
        <button class="flex w-full gap-3 text-left" @click="activate(item)">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :class="classes[item.kind]"><component :is="icons[item.kind]" class="h-4 w-4" /></span>
          <span class="min-w-0 flex-1"><span class="flex items-start gap-2"><strong class="min-w-0 flex-1 text-sm text-ink">{{ item.title }}</strong><span v-if="!item.readAt" class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand1" /></span><span v-if="item.description" class="mt-1 block text-xs leading-5 text-mut">{{ item.description }}</span><span class="mt-2 block text-[9px] text-faint">{{ formatDate(item.createdAt) }}</span></span>
        </button>
        <button class="absolute right-3 bottom-3 rounded-lg p-1.5 text-faint opacity-0 hover:bg-red-500/[0.07] hover:text-red-500 group-hover:opacity-100 focus:opacity-100" aria-label="删除通知" @click="remove(item.id)"><Trash2 class="h-3.5 w-3.5" /></button>
      </article>
    </div>
    <div v-else class="flex min-h-72 flex-col items-center justify-center p-8 text-center"><Bell class="h-9 w-9 text-faint" /><h3 class="mt-4 text-sm font-semibold">{{ filter === 'unread' ? '没有未读通知' : '通知中心还是空的' }}</h3><p class="mt-2 text-xs leading-5 text-mut">生成、发布、资源上传和草稿恢复等重要结果会出现在这里。</p></div>
    <template #footer><button v-if="items.length" class="flex w-full items-center justify-center gap-2 rounded-xl border border-line/10 py-2.5 text-xs text-faint hover:bg-red-500/[0.05] hover:text-red-500" @click="clear"><Trash2 class="h-3.5 w-3.5" />清空全部通知</button></template>
  </AppDrawer>
</template>

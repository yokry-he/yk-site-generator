import { computed, ref } from 'vue'

export type NotificationKind = 'info' | 'success' | 'warning' | 'error'
export interface NotificationItem {
  id: string
  kind: NotificationKind
  title: string
  description?: string
  href?: string
  createdAt: string
  readAt?: string
}

const storageKey = 'siteforge:notifications:v1'
const items = ref<NotificationItem[]>(load())

function load(): NotificationItem[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is NotificationItem => Boolean(item && typeof item === 'object' && 'id' in item && 'title' in item)).slice(0, 60) : []
  } catch { return [] }
}
function persist() {
  if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(items.value.slice(0, 60)))
}

export function pushNotification(input: Omit<NotificationItem, 'id' | 'createdAt'>): NotificationItem {
  const item: NotificationItem = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  items.value = [item, ...items.value].slice(0, 60)
  persist()
  return item
}

export function useNotifications() {
  const unreadCount = computed(() => items.value.filter((item) => !item.readAt).length)
  function markRead(id: string) {
    const item = items.value.find((entry) => entry.id === id)
    if (item && !item.readAt) { item.readAt = new Date().toISOString(); items.value = [...items.value]; persist() }
  }
  function markAllRead() {
    const now = new Date().toISOString()
    items.value = items.value.map((item) => item.readAt ? item : { ...item, readAt: now })
    persist()
  }
  function remove(id: string) { items.value = items.value.filter((item) => item.id !== id); persist() }
  function clear() { items.value = []; persist() }
  return { items, unreadCount, push: pushNotification, markRead, markAllRead, remove, clear }
}

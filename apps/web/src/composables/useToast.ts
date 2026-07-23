import { ref } from 'vue'
import { pushNotification } from './useNotifications'

export interface ToastItem {
  id: number
  kind: 'info' | 'success' | 'error'
  title: string
  description?: string
}

const toasts = ref<ToastItem[]>([])
let seq = 0

function shouldPersist(kind: ToastItem['kind'], title: string, description?: string): boolean {
  if (kind === 'error') return true
  if (!description) return false
  return /(生成|发布|上传|保存|恢复|迁移|导出|完成|失败|草稿)/.test(`${title}${description}`)
}

function push(kind: ToastItem['kind'], title: string, description?: string) {
  const id = ++seq
  toasts.value.push({ id, kind, title, description })
  if (shouldPersist(kind, title, description)) {
    pushNotification({ kind: kind === 'info' ? 'info' : kind, title, description })
  }
  window.setTimeout(() => dismiss(id), kind === 'error' ? 5200 : 3600)
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    info: (title: string, description?: string) => push('info', title, description),
    success: (title: string, description?: string) => push('success', title, description),
    error: (title: string, description?: string) => push('error', title, description),
  }
}

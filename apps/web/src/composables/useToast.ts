import { ref } from 'vue'

export interface ToastItem {
  id: number
  kind: 'info' | 'success' | 'error'
  title: string
  description?: string
}

// 模块级单例
const toasts = ref<ToastItem[]>([])
let seq = 0

function push(kind: ToastItem['kind'], title: string, description?: string) {
  const id = ++seq
  toasts.value.push({ id, kind, title, description })
  window.setTimeout(() => dismiss(id), 3600)
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
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

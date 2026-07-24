import { ref } from 'vue'

interface OverlayEntry {
  id: string
  close: () => void
  returnFocus?: HTMLElement | null
}

const stack = ref<OverlayEntry[]>([])
let sequence = 0
let previousOverflow = ''

function syncBodyLock() {
  if (typeof document === 'undefined') return
  if (stack.value.length > 0) {
    if (stack.value.length === 1) previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = previousOverflow
  }
}

export function registerOverlay(close: () => void, returnFocus?: HTMLElement | null): string {
  const id = `overlay-${++sequence}`
  stack.value.push({ id, close, returnFocus })
  syncBodyLock()
  return id
}

export function unregisterOverlay(id: string, restoreFocus = true): void {
  const index = stack.value.findIndex((entry) => entry.id === id)
  if (index < 0) return
  const [entry] = stack.value.splice(index, 1)
  syncBodyLock()
  if (restoreFocus) queueMicrotask(() => entry.returnFocus?.focus())
}

export function closeTopOverlay(): boolean {
  const top = stack.value.at(-1)
  if (!top) return false
  top.close()
  return true
}

export function isTopOverlay(id: string): boolean {
  return stack.value.at(-1)?.id === id
}

export function useOverlayStack() {
  return { stack, registerOverlay, unregisterOverlay, closeTopOverlay, isTopOverlay }
}

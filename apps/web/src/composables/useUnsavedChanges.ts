import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { confirmDialog } from './useConfirmDialog'

export interface UnsavedGuardOptions {
  title?: string
  description?: string
  enabled?: Ref<boolean>
}

export function useUnsavedChanges(dirty: Ref<boolean>, options: UnsavedGuardOptions = {}) {
  async function confirmDiscard(): Promise<boolean> {
    if (!dirty.value || options.enabled?.value === false) return true
    return confirmDialog({
      title: options.title ?? '放弃尚未保存的修改？',
      description: options.description ?? '已自动保存的本地草稿仍会保留；离开后可以继续恢复。',
      confirmLabel: '仍然离开',
      cancelLabel: '继续编辑',
      tone: 'danger',
    })
  }

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value || options.enabled?.value === false) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))
  onBeforeRouteLeave(async () => confirmDiscard())

  return { confirmDiscard }
}

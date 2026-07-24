import { ref } from 'vue'

export interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  verificationText?: string
  verificationLabel?: string
}

interface ConfirmRequest extends Required<Pick<ConfirmDialogOptions, 'title' | 'confirmLabel' | 'cancelLabel' | 'tone'>> {
  description?: string
  verificationText?: string
  verificationLabel?: string
  resolve: (value: boolean) => void
}

const request = ref<ConfirmRequest | null>(null)

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (request.value) request.value.resolve(false)
  return new Promise((resolve) => {
    request.value = {
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? '确认',
      cancelLabel: options.cancelLabel ?? '取消',
      tone: options.tone ?? 'default',
      verificationText: options.verificationText,
      verificationLabel: options.verificationLabel,
      resolve,
    }
  })
}

export function settleConfirmDialog(value: boolean): void {
  const current = request.value
  request.value = null
  current?.resolve(value)
}

export function useConfirmDialog() {
  return { request, confirm: confirmDialog, settle: settleConfirmDialog }
}

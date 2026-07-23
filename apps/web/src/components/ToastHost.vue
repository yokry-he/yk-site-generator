<script setup lang="ts">
import { CheckCircle2, Info, XCircle, X } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()
const icons = { info: Info, success: CheckCircle2, error: XCircle }
const colors = { info: 'text-brand2', success: 'text-emerald-500', error: 'text-red-500' }
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-3 bottom-3 z-[230] flex w-[calc(100vw-1.5rem)] max-w-80 flex-col gap-2 sm:right-4 sm:bottom-4" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id" :role="toast.kind === 'error' ? 'alert' : 'status'" :aria-live="toast.kind === 'error' ? 'assertive' : 'polite'" class="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line/12 bg-soft p-3.5 shadow-2xl">
          <component :is="icons[toast.kind]" :class="['mt-0.5 h-4 w-4 shrink-0', colors[toast.kind]]" aria-hidden="true" />
          <div class="min-w-0 flex-1"><p class="text-sm font-medium text-ink">{{ toast.title }}</p><p v-if="toast.description" class="mt-0.5 text-xs leading-relaxed text-mut">{{ toast.description }}</p></div>
          <button class="compact-hit rounded p-1.5 text-faint hover:text-ink focus-visible:ring-2 focus-visible:ring-brand1/50" aria-label="关闭提示" @click="dismiss(toast.id)"><X class="h-3.5 w-3.5" /></button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,.toast-leave-active{transition:opacity .25s ease,transform .25s ease}.toast-enter-from{opacity:0;transform:translateY(10px)}.toast-leave-to{opacity:0;transform:translateX(20px)}@media(prefers-reduced-motion:reduce){.toast-enter-active,.toast-leave-active{transition:none}}
</style>

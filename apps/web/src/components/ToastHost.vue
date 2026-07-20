<script setup lang="ts">
import { CheckCircle2, Info, XCircle, X } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const { toasts, dismiss } = useToast()

const icons = { info: Info, success: CheckCircle2, error: XCircle }
const colors = {
  info: 'text-brand2',
  success: 'text-emerald-500',
  error: 'text-red-500',
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 bottom-4 z-[90] flex w-80 flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line/12 bg-soft p-3.5 shadow-2xl"
        >
          <component :is="icons[t.kind]" :class="['mt-0.5 h-4 w-4 shrink-0', colors[t.kind]]" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-ink">{{ t.title }}</p>
            <p v-if="t.description" class="mt-0.5 text-xs leading-relaxed text-mut">
              {{ t.description }}
            </p>
          </div>
          <button
            class="rounded p-0.5 text-faint hover:text-ink"
            aria-label="关闭提示"
            @click="dismiss(t.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>

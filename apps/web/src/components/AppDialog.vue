<script setup lang="ts">
import { watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  title?: string
  description?: string
  /** 面板宽度类 */
  widthClass?: string
}>()

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

function close() {
  emit('update:open', false)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.open,
  (v) => {
    if (v) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="open" class="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close" />
        <div
          :class="[
            'relative max-h-[85vh] w-full overflow-hidden rounded-2xl border border-line/12 bg-soft shadow-2xl',
            widthClass ?? 'max-w-lg',
          ]"
          role="dialog"
          aria-modal="true"
        >
          <div v-if="title" class="border-b border-line/10 px-6 py-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="flex items-center gap-2 text-lg font-semibold text-ink">
                  <slot name="icon" />
                  {{ title }}
                </h2>
                <p v-if="description" class="mt-1 text-sm text-mut">{{ description }}</p>
              </div>
              <button
                class="rounded-lg p-1.5 text-faint transition-colors hover:bg-ink/5 hover:text-ink"
                aria-label="关闭"
                @click="close"
              >
                <X class="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}
.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>

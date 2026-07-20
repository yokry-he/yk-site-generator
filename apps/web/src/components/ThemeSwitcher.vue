<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, Palette } from 'lucide-vue-next'
import { THEMES } from '../data/themes'
import { useTheme } from '../composables/useTheme'

const { theme } = useTheme()
const open = ref(false)
const rootRef = ref<HTMLElement>()

function onDocClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      class="flex items-center gap-1.5 rounded-full border border-line/10 bg-ink/5 px-3 py-1.5 text-xs text-mut transition-colors hover:border-line/20 hover:text-ink"
      aria-label="切换主题"
      @click="open = !open"
    >
      <Palette class="h-3.5 w-3.5" />
      <span class="hidden lg:inline">主题</span>
    </button>

    <Transition name="drop">
      <div
        v-if="open"
        class="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line/12 bg-soft p-1.5 shadow-2xl"
      >
        <p class="px-2.5 pt-1.5 pb-1 text-xs text-faint">界面主题</p>
        <button
          v-for="t in THEMES"
          :key="t.id"
          class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-ink/5"
          @click="((theme = t.id), (open = false))"
        >
          <span class="flex -space-x-1">
            <span
              v-for="c in t.swatch"
              :key="c"
              class="h-3.5 w-3.5 rounded-full border border-black/10"
              :style="{ background: c }"
            />
          </span>
          <span class="flex-1 text-sm text-sub">{{ t.name }}</span>
          <Check v-if="theme === t.id" class="h-4 w-4 text-brand1" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drop-enter-active,
.drop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

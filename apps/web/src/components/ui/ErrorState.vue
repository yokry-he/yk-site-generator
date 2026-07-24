<script setup lang="ts">
import { AlertCircle, RefreshCw } from 'lucide-vue-next'
withDefaults(defineProps<{ title?: string; description: string; retrying?: boolean; compact?: boolean }>(), { title: '暂时无法完成操作', retrying: false, compact: false })
const emit = defineEmits<{ (event: 'retry'): void }>()
</script>

<template>
  <section role="alert" class="flex flex-col items-center justify-center rounded-3xl border border-red-500/18 bg-red-500/[0.045] text-center" :class="compact ? 'min-h-40 p-5' : 'min-h-64 p-9'">
    <span class="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/10 text-red-500"><AlertCircle class="h-5 w-5" /></span>
    <h2 class="mt-4 text-base font-semibold text-ink">{{ title }}</h2>
    <p class="mt-2 max-w-md text-xs leading-6 text-mut">{{ description }}</p>
    <button class="mt-5 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.07] px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-500/[0.12] disabled:opacity-50" :disabled="retrying" @click="emit('retry')"><RefreshCw class="h-3.5 w-3.5" :class="retrying && 'animate-spin'" />重新尝试</button>
  </section>
</template>

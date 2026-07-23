<script setup lang="ts">
withDefaults(defineProps<{ rows?: number; cards?: number; label?: string }>(), { rows: 0, cards: 0, label: '正在加载' })
</script>

<template>
  <section role="status" :aria-label="label" aria-live="polite" class="animate-pulse">
    <div v-if="cards" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="index in cards" :key="`card-${index}`" class="h-56 rounded-2xl border border-line/8 bg-ink/[0.04]" />
    </div>
    <div v-else class="space-y-3">
      <div v-for="index in Math.max(rows, 3)" :key="`row-${index}`" class="h-12 rounded-xl bg-ink/[0.04]" :style="{ width: `${100 - ((index - 1) % 3) * 10}%` }" />
    </div>
    <span class="sr-only">{{ label }}</span>
  </section>
</template>

<script setup lang="ts">
import MockBar from './MockBar.vue'

defineProps<{ dark: boolean; accent: string }>()
</script>

<template>
  <div class="grid grid-cols-3 gap-2 px-4 pb-3">
    <div
      v-for="i in 3"
      :key="i"
      class="rounded-lg p-2"
      :class="dark ? 'bg-white/5' : 'border border-slate-200 bg-white'"
    >
      <div class="mb-1.5 h-3 w-3 rounded" :style="{ background: accent, opacity: 0.1 + i * 0.25 }" />
      <MockBar :class-name="`h-1.5 w-full ${dark ? 'bg-zinc-700' : 'bg-slate-200'}`" />
      <MockBar :class-name="`mt-1 h-1.5 w-2/3 ${dark ? 'bg-zinc-700' : 'bg-slate-200'}`" />
    </div>
  </div>
</template>

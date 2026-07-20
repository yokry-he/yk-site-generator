<script setup lang="ts">
import MockBar from './MockBar.vue'

defineProps<{ dark: boolean; accent: string }>()
</script>

<template>
  <div
    class="flex items-center justify-between px-3 py-2"
    :class="dark ? 'bg-black/30' : 'border-b border-slate-200 bg-white'"
  >
    <div class="flex items-center gap-1.5">
      <div class="h-3 w-3 rounded" :style="{ background: accent }" />
      <MockBar :class-name="`h-1.5 w-8 ${dark ? 'bg-zinc-600' : 'bg-slate-300'}`" />
    </div>
    <div class="flex gap-1.5">
      <MockBar v-for="i in 4" :key="i" :class-name="`h-1.5 w-5 ${dark ? 'bg-zinc-700' : 'bg-slate-200'}`" />
    </div>
  </div>
</template>

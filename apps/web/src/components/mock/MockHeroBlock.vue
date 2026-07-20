<script setup lang="ts">
import MockBar from './MockBar.vue'

defineProps<{ dark: boolean; accent: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-1.5 px-6 py-3">
    <MockBar :class-name="`h-2 w-28 ${dark ? 'bg-zinc-200' : 'bg-slate-800'}`" />
    <MockBar :class-name="`h-1.5 w-20 ${dark ? 'bg-zinc-600' : 'bg-slate-300'}`" />
    <div class="mt-1 h-5 w-16 rounded-md" :style="{ background: accent }" />
    <slot />
  </div>
</template>

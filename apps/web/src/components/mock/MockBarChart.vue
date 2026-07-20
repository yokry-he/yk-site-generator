<script setup lang="ts">
defineProps<{ accent: string; heights: number[] }>()
</script>

<template>
  <div class="flex flex-1 items-end justify-around rounded-md border border-white/8 bg-white/5 p-1.5">
    <div
      v-for="(h, i) in heights"
      :key="i"
      class="w-1.5 rounded-sm"
      :style="{ height: `${h}%`, background: accent, opacity: 0.5 + (i % 3) * 0.16 }"
    />
  </div>
</template>

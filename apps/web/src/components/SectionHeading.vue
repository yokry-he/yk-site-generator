<script setup lang="ts">
defineProps<{
  eyebrow: string
  title: string
  desc?: string
}>()
</script>

<template>
  <div class="mx-auto max-w-2xl text-center">
    <p class="text-brand-gradient text-sm font-semibold tracking-widest uppercase">{{ eyebrow }}</p>
    <h2 class="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{{ title }}</h2>
    <p v-if="desc" class="mt-4 text-base leading-relaxed text-mut">{{ desc }}</p>
  </div>
</template>

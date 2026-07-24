<script setup lang="ts">
import { Inbox } from 'lucide-vue-next'
withDefaults(defineProps<{ title: string; description?: string; compact?: boolean }>(), { description: '', compact: false })
</script>

<template>
  <section class="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line/15 text-center" :class="compact ? 'min-h-44 p-6' : 'min-h-72 p-10'">
    <span class="grid h-14 w-14 place-items-center rounded-2xl bg-ink/[0.045] text-faint"><slot name="icon"><Inbox class="h-6 w-6" /></slot></span>
    <h2 class="mt-4 text-base font-semibold text-ink">{{ title }}</h2>
    <p v-if="description" class="mt-2 max-w-md text-xs leading-6 text-mut sm:text-sm">{{ description }}</p>
    <div v-if="$slots.actions" class="mt-5 flex flex-wrap justify-center gap-2"><slot name="actions" /></div>
  </section>
</template>

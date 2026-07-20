<script setup lang="ts">
defineProps<{ checked: boolean }>()
const emit = defineEmits<{ (e: 'update:checked', v: boolean): void }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    class="relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors"
    :class="checked ? 'bg-brand1' : 'bg-line/20'"
    @click="emit('update:checked', !checked)"
  >
    <span
      class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
      :class="checked ? 'translate-x-5.5' : 'translate-x-0.5'"
    />
  </button>
</template>

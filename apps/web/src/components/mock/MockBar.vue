<script setup lang="ts">
defineProps<{ className?: string }>()
</script>

<template>
  <div :class="['rounded-full', className]" />
</template>

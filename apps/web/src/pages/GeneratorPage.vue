<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import GeneratorDemo from '../components/GeneratorDemo.vue'
import { SITE_TYPES } from '../data/siteTypes'

const route = useRoute()

// 从首页 Hero 带过来的需求文本(query.q,刷新/分享链接也能保留)
const prompt = ref(
  typeof route.query.q === 'string' && route.query.q
    ? route.query.q
    : SITE_TYPES.find((t) => t.id === 'dashboard')!.example,
)

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q) prompt.value = q
  },
)
</script>

<template>
  <main class="pt-8">
    <GeneratorDemo v-model:prompt="prompt" />
  </main>
</template>

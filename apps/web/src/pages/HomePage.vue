<script setup lang="ts">
import { LayoutGrid, ListChecks, Images, Tags } from 'lucide-vue-next'
import HeroSection from '../components/HeroSection.vue'
import SiteTypes from '../components/SiteTypes.vue'
import ProcessSteps from '../components/ProcessSteps.vue'
import CtaBand from '../components/CtaBand.vue'

/** 页内锚点与页面的次要链接行(降级后的 hash 跳转入口) */
const QUICK_LINKS = [
  { icon: LayoutGrid, label: '站点类型', to: '/#types' },
  { icon: ListChecks, label: '生成流程', to: '/#process' },
  { icon: Images, label: '模板库', to: '/templates' },
  { icon: Tags, label: '定价', to: '/pricing' },
]
</script>

<template>
  <main>
    <HeroSection />

    <!-- 快速直达 -->
    <div class="relative mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-4 pb-4">
      <span class="mr-1 text-xs text-faint">快速直达</span>
      <RouterLink
        v-for="item in QUICK_LINKS"
        :key="item.label"
        :to="item.to"
        class="flex items-center gap-1.5 rounded-full border border-line/10 bg-ink/[0.03] px-3.5 py-1.5 text-xs text-mut transition-all hover:border-brand1/40 hover:text-brand1"
      >
        <component :is="item.icon" class="h-3.5 w-3.5" />
        {{ item.label }}
      </RouterLink>
    </div>

    <SiteTypes />
    <ProcessSteps />
    <CtaBand />
  </main>
</template>

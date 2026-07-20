<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
</script>

<template>
  <section class="relative overflow-hidden py-24">
    <div class="glow-brand1 pointer-events-none absolute top-1/2 left-1/2 h-64 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]" />
    <div class="relative mx-auto max-w-3xl px-4 text-center">
      <h2 class="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        准备好把想法变成网站了吗?
      </h2>
      <p class="mt-4 text-base text-mut">免费开始,一句话生成你的第一个网站。</p>
      <RouterLink
        to="/generator"
        class="bg-brand-gradient mt-8 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand1/30 transition-transform hover:scale-[1.03] active:scale-95"
      >
        免费开始生成
        <ArrowRight class="h-4 w-4" />
      </RouterLink>
    </div>
  </section>
</template>

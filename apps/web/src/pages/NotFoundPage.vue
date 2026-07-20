<script setup lang="ts">
import { Compass, Home } from 'lucide-vue-next'
</script>

<template>
  <main class="relative flex min-h-[70vh] items-center justify-center overflow-hidden pt-16">
    <div class="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)]" />
    <div class="glow-brand1 pointer-events-none absolute top-1/3 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full blur-[130px]" />

    <div class="relative px-4 text-center">
      <div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-line/10 bg-soft/60">
        <Compass class="h-8 w-8 text-brand1" />
      </div>
      <p class="text-brand-gradient text-6xl font-extrabold tracking-tight">404</p>
      <h1 class="mt-4 text-xl font-bold text-ink">这个页面还没有被生成</h1>
      <p class="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-mut">
        你访问的地址不存在,或者对应的页面已经被移走了。回到首页,让 AI 帮你生成一个真正存在的网站吧。
      </p>
      <RouterLink
        to="/"
        class="bg-brand-gradient mt-8 inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/30 transition-transform hover:scale-[1.03] active:scale-95"
      >
        <Home class="h-4 w-4" />
        返回首页
      </RouterLink>
    </div>
  </main>
</template>

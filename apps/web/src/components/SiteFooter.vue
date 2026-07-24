<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

const COLUMNS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: '产品',
    links: [
      { label: '首页', to: '/' },
      { label: '在线体验', to: '/generator' },
      { label: '模板库', to: '/templates' },
      { label: '定价', to: '/pricing' },
    ],
  },
  {
    title: '页面导航',
    links: [
      { label: '站点类型', to: '/#types' },
      { label: '生成流程', to: '/#process' },
      { label: '模板画廊', to: '/templates' },
      { label: 'AI 生成演示', to: '/generator' },
    ],
  },
  {
    title: '资源',
    links: [
      { label: '使用文档', to: '/docs' },
      { label: '模板变量语法', to: '/docs#template-vars' },
      { label: '模型接入说明', to: '/docs#model-providers' },
      { label: '更新日志', to: '/changelog' },
    ],
  },
  {
    title: '公司',
    links: [
      { label: '关于我们', to: '/about' },
      { label: '联系我们', to: '/about#contact' },
      { label: '更新日志', to: '/changelog' },
    ],
  },
]
</script>

<template>
  <footer class="border-t border-line/10 py-14">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div>
          <RouterLink to="/" class="flex items-center gap-2">
            <span class="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg">
              <Sparkles class="h-4.5 w-4.5 text-white" :stroke-width="2.2" />
            </span>
            <span class="text-lg font-bold tracking-tight text-ink">SiteForge</span>
          </RouterLink>
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-faint">
            智能网站生成平台。用一句话描述需求,AI 帮你生成完整网站——从个人主页到数据大屏。
          </p>
        </div>
        <div v-for="col in COLUMNS" :key="col.title">
          <h4 class="text-sm font-semibold text-sub">{{ col.title }}</h4>
          <ul class="mt-4 space-y-2.5">
            <li v-for="link in col.links" :key="link.label">
              <RouterLink :to="link.to" class="text-sm text-faint transition-colors hover:text-ink">
                {{ link.label }}
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
      <div class="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line/8 pt-6 sm:flex-row">
        <p class="text-xs text-faint">© 2025 SiteForge · 智能网站生成平台。保留所有权利。</p>
        <p class="text-xs text-faint">本页面由 SiteForge 设计理念驱动构建</p>
      </div>
    </div>
  </footer>
</template>

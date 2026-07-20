<script setup lang="ts">
import { GitCommitHorizontal } from 'lucide-vue-next'
import SectionHeading from '../components/SectionHeading.vue'

const ENTRIES = [
  {
    version: 'v0.4.0',
    date: '2025-06-20',
    items: ['站点类型扩充至 14 种,按 4 组分类展示', '新增模板生成器:上传 zip + $M{} 变量替换,浏览器端打包下载', '内置个人主页示例模板'],
  },
  {
    version: 'v0.3.0',
    date: '2025-05-28',
    items: ['新增 6 套界面主题,支持浅色系列', '新增模型设置:支持 8 家大模型厂商接入', '导航栏升级:真实路由 + 当前页高亮'],
  },
  {
    version: 'v0.2.0',
    date: '2025-05-10',
    items: ['AI 生成演示上线:分步进度 + 打字机日志', '新增 23 套 CSS 线框模板', '定价页发布'],
  },
  {
    version: 'v0.1.0',
    date: '2025-04-18',
    items: ['SiteForge 官网首个版本发布', '一句话生成网站的核心交互链路'],
  },
]
</script>

<template>
  <main class="pt-16">
    <section class="relative py-16">
      <div class="glow-brand2 pointer-events-none absolute top-0 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full blur-[130px]" />
      <div class="relative mx-auto max-w-2xl px-4 sm:px-6">
        <SectionHeading eyebrow="更新日志" title="SiteForge 更新日志" desc="每一次更新,都让生成更近一步。" />

        <div class="relative mt-14 space-y-10">
          <div class="absolute top-1 bottom-1 left-[7px] w-px bg-line/12" />
          <div v-for="entry in ENTRIES" :key="entry.version" class="relative pl-8">
            <span class="bg-brand-gradient absolute top-1 left-0 flex h-4 w-4 items-center justify-center rounded-full">
              <GitCommitHorizontal class="h-2.5 w-2.5 text-white" />
            </span>
            <div class="flex flex-wrap items-baseline gap-3">
              <h2 class="text-lg font-bold text-ink">{{ entry.version }}</h2>
              <span class="text-xs text-faint">{{ entry.date }}</span>
            </div>
            <ul class="mt-3 space-y-2">
              <li
                v-for="item in entry.items"
                :key="item"
                class="rounded-lg border border-line/10 bg-soft/60 px-3.5 py-2.5 text-sm text-mut"
              >
                {{ item }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

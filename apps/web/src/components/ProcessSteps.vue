<script setup lang="ts">
import { MessageSquareText, Wand2, MousePointerClick, Globe } from 'lucide-vue-next'
import SectionHeading from './SectionHeading.vue'

const STEPS = [
  { icon: MessageSquareText, title: '描述需求', desc: '用一句自然语言说出你想要的网站,越具体越好。' },
  { icon: Wand2, title: 'AI 生成', desc: 'AI 理解意图,自动规划结构、生成页面与内容。' },
  { icon: MousePointerClick, title: '可视化编辑', desc: '拖拽调整布局,实时改文案、换配色,所见即所得。' },
  { icon: Globe, title: '一键发布', desc: '绑定域名或直接托管,秒级上线,全球加速访问。' },
]
</script>

<template>
  <section id="process" class="relative scroll-mt-20 py-24">
    <div class="glow-brand2 pointer-events-none absolute top-1/2 left-1/2 h-72 w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]" />
    <div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="生成流程"
        title="四步,从想法到上线"
        desc="不需要写一行代码,也不需要懂设计规范。把精力放在你的想法上,剩下的交给 SiteForge。"
      />

      <div class="stagger relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <!-- 桌面端横向连线 -->
        <div class="absolute top-7 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-brand1/40 via-brand2/40 to-brand1/40 lg:block" />

        <div
          v-for="(step, i) in STEPS"
          :key="step.title"
          class="relative flex flex-row gap-4 lg:flex-col lg:items-center lg:text-center"
        >
          <!-- 移动端纵向连线 -->
          <div
            v-if="i < STEPS.length - 1"
            class="absolute top-16 bottom-[-2.5rem] left-7 w-px bg-gradient-to-b from-brand1/40 to-brand2/30 sm:hidden"
          />
          <div class="relative shrink-0">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl border border-line/10 bg-soft shadow-lg shadow-black/10">
              <component :is="step.icon" class="h-6 w-6 text-brand1" :stroke-width="1.8" />
            </div>
            <span class="bg-brand-gradient absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-md">
              {{ i + 1 }}
            </span>
          </div>
          <div class="lg:mt-5">
            <h3 class="text-base font-semibold text-ink lg:text-lg">{{ step.title }}</h3>
            <p class="mt-1.5 max-w-56 text-sm leading-relaxed text-mut lg:mx-auto">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

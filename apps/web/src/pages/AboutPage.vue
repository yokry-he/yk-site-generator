<script setup lang="ts">
import { Sparkles, Mail, MapPin, Users } from 'lucide-vue-next'
import SectionHeading from '../components/SectionHeading.vue'
</script>

<template>
  <main class="pt-16">
    <section class="relative py-16">
      <div class="glow-brand1 pointer-events-none absolute top-0 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full blur-[130px]" />
      <div class="relative mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="关于我们"
          title="让每个人都能拥有自己的网站"
          desc="SiteForge 是一支专注于 AI 建站的小团队。"
        />

        <div class="mt-14 space-y-8 text-sm leading-relaxed text-mut">
          <p>
            我们相信,表达不该被技术门槛拦住。设计师想要作品集,店主想要门店页,老师想要课程站——
            这些需求都值得一个体面的答案,而不是一堆需要学习的工具。
          </p>
          <p>
            SiteForge 用自然语言作为建站入口:你只需要说清楚想要什么,剩下的结构规划、
            组件生成、文案撰写都交给 AI。生成的每一个网站都可以继续编辑、随时发布。
          </p>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="rounded-2xl border border-line/10 bg-soft/60 p-5 text-center">
              <Sparkles class="mx-auto h-6 w-6 text-brand1" />
              <p class="mt-3 text-2xl font-extrabold text-ink">14</p>
              <p class="mt-1 text-xs text-faint">可生成的站点类型</p>
            </div>
            <div class="rounded-2xl border border-line/10 bg-soft/60 p-5 text-center">
              <Users class="mx-auto h-6 w-6 text-brand1" />
              <p class="mt-3 text-2xl font-extrabold text-ink">12,000+</p>
              <p class="mt-1 text-xs text-faint">已生成的网站(演示数据)</p>
            </div>
            <div class="rounded-2xl border border-line/10 bg-soft/60 p-5 text-center">
              <MapPin class="mx-auto h-6 w-6 text-brand1" />
              <p class="mt-3 text-2xl font-extrabold text-ink">杭州</p>
              <p class="mt-1 text-xs text-faint">团队所在地</p>
            </div>
          </div>

          <div id="contact" class="scroll-mt-24 rounded-2xl border border-line/10 bg-soft/60 p-6">
            <h2 class="text-base font-semibold text-ink">联系我们</h2>
            <p class="mt-2 flex items-center gap-2">
              <Mail class="h-4 w-4 text-brand2" />
              hello@siteforge.example.com
            </p>
            <p class="mt-2 text-xs text-faint">
              商务合作、功能建议或问题反馈,都欢迎来信。我们通常在一个工作日内回复。
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

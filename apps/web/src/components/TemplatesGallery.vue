<script setup lang="ts">
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-vue-next'
import { OFFICIAL_TEMPLATES, renderOfficialTemplate } from 'shared'
import SectionHeading from './SectionHeading.vue'
import { typeById } from '../data/siteTypes'

const featured = OFFICIAL_TEMPLATES.filter((template) => template.featured).slice(0, 6)
const previews = Object.fromEntries(featured.map((template) => [template.id, renderOfficialTemplate(template)]))
</script>

<template>
  <section id="templates" class="relative scroll-mt-20 py-24">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="官方模板"
        title="从经过打磨的起点开始"
        desc="每套模板都包含完整响应式布局、可编辑内容与清晰转化路径，还可以直接套用你的品牌套件。"
      />

      <div class="stagger mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="template in featured"
          :key="template.id"
          class="group overflow-hidden rounded-2xl border border-line/10 bg-soft/60 transition-all duration-300 hover:-translate-y-1 hover:border-brand1/35 hover:shadow-2xl hover:shadow-brand1/10"
        >
          <div class="relative aspect-[16/10] overflow-hidden bg-white">
            <iframe
              :srcdoc="previews[template.id]"
              sandbox=""
              loading="lazy"
              tabindex="-1"
              aria-hidden="true"
              class="pointer-events-none h-[200%] w-[200%] origin-top-left scale-50 border-0"
              title=""
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-50" />
            <span class="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold text-zinc-900 shadow-sm backdrop-blur">
              <Sparkles class="h-3 w-3 text-violet-600" />官方精选
            </span>
            <RouterLink
              :to="{ path: '/templates', query: { template: template.slug } }"
              class="bg-brand-gradient absolute inset-x-4 bottom-3 flex translate-y-2 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              预览并使用
              <ArrowUpRight class="h-3.5 w-3.5" />
            </RouterLink>
          </div>
          <div class="p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-semibold text-ink">{{ template.name }}</h3>
                <p class="mt-1 text-[11px] text-faint">{{ typeById(template.siteType)?.name || template.siteType }} · {{ template.industry }}</p>
              </div>
              <div class="flex shrink-0 gap-1">
                <span v-for="color in [template.palette.primary, template.palette.secondary, template.palette.accent]" :key="color" class="h-4 w-4 rounded-full border border-black/5" :style="{ backgroundColor: color }" />
              </div>
            </div>
            <p class="mt-3 line-clamp-2 text-xs leading-5 text-mut">{{ template.description }}</p>
          </div>
        </article>
      </div>

      <div class="mt-10 flex justify-center">
        <RouterLink
          to="/templates"
          class="flex items-center gap-2 rounded-full border border-brand1/20 bg-brand1/[0.07] px-5 py-3 text-sm font-semibold text-brand1 transition hover:bg-brand1/[0.12]"
        >
          浏览全部官方模板
          <ArrowRight class="h-4 w-4" />
        </RouterLink>
      </div>
    </div>
  </section>
</template>

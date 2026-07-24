<script setup lang="ts">
import SectionHeading from './SectionHeading.vue'
import { SITE_TYPES, TYPE_GROUPS } from '../data/siteTypes'
</script>

<template>
  <section id="types" class="relative scroll-mt-20 py-24">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="站点类型"
        title="十四种站点,一个平台全搞定"
        desc="从个人表达,到企业门面,再到实时数据大屏——每种类型都有专属的生成策略与设计体系。"
      />

      <div class="mt-14 space-y-10">
        <div v-for="group in TYPE_GROUPS" :key="group">
          <div class="mb-4 flex items-center gap-3">
            <h3 class="text-sm font-semibold tracking-wider text-brand1">{{ group }}</h3>
            <div class="h-px flex-1 bg-line/10" />
          </div>
          <div class="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div
              v-for="t in SITE_TYPES.filter((x) => x.group === group)"
              :key="t.id"
              class="group relative overflow-hidden rounded-2xl border border-line/10 bg-soft/60 p-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand1/40 hover:shadow-xl hover:shadow-brand1/10"
            >
              <div class="glow-brand1 pointer-events-none absolute -top-16 -right-16 h-36 w-36 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
              <div class="mb-3.5 flex items-center gap-3">
                <div class="bg-brand-gradient inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-brand1/25">
                  <component :is="t.icon" class="h-4.5 w-4.5 text-white" :stroke-width="2" />
                </div>
                <h4 class="text-base font-semibold text-ink">{{ t.name }}</h4>
              </div>
              <p class="text-xs leading-relaxed text-sub">{{ t.desc }}</p>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <span
                  v-for="tag in t.tags"
                  :key="tag"
                  class="rounded-md border border-line/12 bg-ink/[0.04] px-2 py-0.5 text-[11px] text-ink"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

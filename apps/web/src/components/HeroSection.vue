<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Wand2 } from 'lucide-vue-next'
import { SITE_TYPES } from '../data/siteTypes'

const router = useRouter()
const prompt = ref('')

function goGenerate() {
  // 用 query 携带需求文本,刷新/分享链接也能保留
  router.push({ path: '/generator', query: prompt.value.trim() ? { q: prompt.value } : {} })
}
</script>

<template>
  <section id="top" class="relative overflow-hidden pt-32 pb-16 sm:pt-40">
    <!-- 背景装饰:网格 + 光晕 -->
    <div class="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_35%,black,transparent)]" />
    <div class="glow-brand1 pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full blur-[140px]" />
    <div class="glow-brand2 pointer-events-none absolute top-40 left-[15%] h-64 w-64 rounded-full blur-[100px]" />

    <div class="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
      <div class="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-line/10 bg-ink/5 px-4 py-1.5 text-xs text-sub">
        <Wand2 class="h-3.5 w-3.5 text-brand1" />
        AI 驱动的智能网站生成平台
      </div>

      <h1
        class="animate-fade-up text-4xl leading-[1.15] font-extrabold tracking-tight text-ink sm:text-6xl"
        style="animation-delay: 0.08s"
      >
        一句话,
        <span class="text-brand-gradient">生成任何网站</span>
      </h1>

      <p
        class="animate-fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-mut sm:text-lg"
        style="animation-delay: 0.16s"
      >
        个人主页、企业官网、文档站、数据大屏……
        <br class="hidden sm:block" />
        只需描述你的想法,SiteForge 的 AI 即刻为你生成完整可用的网站。
      </p>

      <!-- 需求输入框 -->
      <div class="animate-fade-up mx-auto mt-10 max-w-2xl" style="animation-delay: 0.24s">
        <div class="group relative rounded-2xl border border-line/10 bg-soft/80 p-2 shadow-2xl shadow-brand1/10 backdrop-blur transition-colors focus-within:border-brand1/50">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              v-model="prompt"
              placeholder="描述你想要的网站,例如:一个深色极简的摄影师作品集…"
              class="min-h-12 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-faint sm:text-base"
              @keydown.enter="goGenerate"
            />
            <button
              class="bg-brand-gradient flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-brand1/30 transition-transform hover:scale-[1.02] active:scale-95"
              @click="goGenerate"
            >
              立即生成
              <ArrowRight class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- 站点类型快捷 chips -->
        <div class="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            v-for="t in SITE_TYPES"
            :key="t.id"
            class="rounded-full border border-line/10 bg-ink/[0.04] px-3 py-1.5 text-xs text-mut transition-all hover:border-brand1/40 hover:bg-brand1/10 hover:text-brand1"
            @click="prompt = t.example"
          >
            {{ t.name }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

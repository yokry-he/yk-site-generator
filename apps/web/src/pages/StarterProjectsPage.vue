<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, CheckCircle2, Clock3, Layers3, Sparkles, WandSparkles } from 'lucide-vue-next'
import {
  STARTER_PROJECTS,
  getOfficialTemplate,
  renderStarterProject,
} from 'shared'
import { listStarterProjectDrafts } from '../lib/starterProjectDrafts'

const draftSlugs = ref(new Set<string>())
const projects = computed(() => [...STARTER_PROJECTS].sort((a, b) => Number(b.featured) - Number(a.featured)))
const previews = computed(() => Object.fromEntries(projects.value.map((project) => [project.slug, renderStarterProject(project)])))

onMounted(() => {
  draftSlugs.value = new Set(listStarterProjectDrafts().map((draft) => draft.slug))
})
</script>

<template>
  <main class="min-h-screen pt-16 pb-24">
    <section class="relative overflow-hidden border-b border-line/8 bg-soft/35">
      <div class="pointer-events-none absolute -top-48 left-[8%] h-[430px] w-[430px] rounded-full bg-brand1/14 blur-3xl" />
      <div class="pointer-events-none absolute -right-40 -bottom-56 h-[470px] w-[470px] rounded-full bg-brand2/12 blur-3xl" />
      <div class="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div class="max-w-4xl">
          <span class="inline-flex items-center gap-2 rounded-full border border-brand1/18 bg-brand1/[0.07] px-3 py-1.5 text-[11px] font-semibold text-sub">
            <Sparkles class="h-3.5 w-3.5 text-brand1" />无需模型 · 无需登录 · 无需配置
          </span>
          <h1 class="mt-6 text-4xl font-bold tracking-tight text-ink sm:text-6xl">打开一个成品，直接开始使用</h1>
          <p class="mt-5 max-w-3xl text-sm leading-7 text-mut sm:text-lg">
            每个内置项目都已经包含完整内容、视觉样式和响应式布局。直接打开即可编辑、导出和分享；需要云端版本管理时再登录保存。
          </p>
          <div class="mt-8 flex flex-wrap gap-3 text-xs text-sub">
            <span class="flex items-center gap-1.5 rounded-full border border-line/10 bg-app/55 px-3 py-2"><CheckCircle2 class="h-3.5 w-3.5 text-emerald-500" />完整可运行 HTML</span>
            <span class="flex items-center gap-1.5 rounded-full border border-line/10 bg-app/55 px-3 py-2"><Clock3 class="h-3.5 w-3.5 text-brand2" />数秒进入编辑</span>
            <span class="flex items-center gap-1.5 rounded-full border border-line/10 bg-app/55 px-3 py-2"><Layers3 class="h-3.5 w-3.5 text-brand1" />本地自动保存</span>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid gap-6 lg:grid-cols-2">
        <article v-for="project in projects" :key="project.id" class="group overflow-hidden rounded-3xl border border-line/10 bg-soft/60 shadow-sm transition hover:-translate-y-1 hover:border-brand1/25 hover:shadow-2xl hover:shadow-black/[0.06]">
          <div class="relative h-72 overflow-hidden bg-ink/[0.04] p-3 sm:h-80">
            <div class="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-black/12 to-transparent" />
            <div class="h-full overflow-hidden rounded-xl border border-line/10 bg-white shadow-xl">
              <iframe :srcdoc="previews[project.slug]" sandbox="allow-scripts" loading="lazy" tabindex="-1" class="pointer-events-none h-[760px] w-[1440px] origin-top-left scale-[0.39] sm:scale-[0.44]" :title="`${project.name}预览`" />
            </div>
            <span v-if="project.featured" class="absolute top-5 left-5 z-20 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur">推荐起点</span>
            <span v-if="draftSlugs.has(project.slug)" class="absolute top-5 right-5 z-20 rounded-full bg-emerald-500 px-3 py-1.5 text-[10px] font-semibold text-white">有本地草稿</span>
          </div>

          <div class="p-5 sm:p-6">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-brand1/18 bg-brand1/10 px-2.5 py-1 text-[10px] font-semibold text-ink">{{ getOfficialTemplate(project.templateId)?.industry }}</span>
              <span class="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] text-faint">{{ project.audience }}</span>
            </div>
            <h2 class="mt-4 text-2xl font-bold tracking-tight text-ink">{{ project.name }}</h2>
            <p class="mt-2 text-sm leading-6 text-mut">{{ project.description }}</p>
            <p class="mt-4 text-xs text-sub"><strong>适合：</strong>{{ project.useCase }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <span v-for="highlight in project.highlights" :key="highlight" class="rounded-lg border border-line/10 bg-app/45 px-2.5 py-1.5 text-[10px] text-faint">{{ highlight }}</span>
            </div>
            <div class="mt-6 flex flex-col gap-2 sm:flex-row">
              <RouterLink :to="{ name: 'starter-project', params: { slug: project.slug } }" class="bg-brand-gradient flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand1/20 transition hover:brightness-110">
                {{ draftSlugs.has(project.slug) ? '继续编辑' : '直接使用' }}<ArrowRight class="h-4 w-4" />
              </RouterLink>
              <RouterLink :to="{ name: 'generator', query: { q: `基于内置项目「${project.name}」继续深度定制：${project.description}` } }" class="flex items-center justify-center gap-2 rounded-xl border border-line/12 px-4 py-3 text-sm font-medium text-sub transition hover:border-brand1/25 hover:text-brand1">
                <WandSparkles class="h-4 w-4" />AI 深度定制
              </RouterLink>
            </div>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

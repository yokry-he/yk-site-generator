<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUpRight } from 'lucide-vue-next'
import SectionHeading from './SectionHeading.vue'
import TemplateThumb from './TemplateThumb.vue'
import { TYPE_GROUPS, typeById } from '../data/siteTypes'
import { useToast } from '../composables/useToast'

interface Template {
  name: string
  type: string
  accent: string
  dark: boolean
}

const TEMPLATES: Template[] = [
  // 个人创作
  { name: '暗夜独白', type: 'personal', accent: '#a78bfa', dark: true },
  { name: '极简名片', type: 'personal', accent: '#22d3ee', dark: false },
  { name: '光影集', type: 'portfolio', accent: '#f472b6', dark: true },
  { name: '造物志', type: 'portfolio', accent: '#fb923c', dark: false },
  { name: '一页简历', type: 'resume', accent: '#38bdf8', dark: false },
  { name: '字里行间', type: 'blog', accent: '#f59e0b', dark: false },
  { name: '码农札记', type: 'blog', accent: '#34d399', dark: true },
  // 商业营销
  { name: '创想云科', type: 'business', accent: '#6366f1', dark: false },
  { name: '曜石集团', type: 'business', accent: '#f59e0b', dark: true },
  { name: '云帆 SaaS', type: 'saas', accent: '#7c3aed', dark: false },
  { name: '脉冲数据', type: 'saas', accent: '#0ea5e9', dark: true },
  { name: '峰会议程', type: 'landing', accent: '#8b5cf6', dark: true },
  { name: '新品首发', type: 'landing', accent: '#06b6d4', dark: false },
  { name: '好物橱窗', type: 'shop', accent: '#f59e0b', dark: false },
  { name: '匠心手作', type: 'shop', accent: '#e11d48', dark: true },
  { name: '山海食堂', type: 'restaurant', accent: '#f59e0b', dark: true },
  { name: '芝士课堂', type: 'education', accent: '#10b981', dark: false },
  // 内容社区
  { name: '开发者手册', type: 'docs', accent: '#10b981', dark: false },
  { name: 'API 参考', type: 'docs', accent: '#8b5cf6', dark: true },
  { name: '团队 Wiki', type: 'wiki', accent: '#10b981', dark: false },
  { name: '回音社区', type: 'forum', accent: '#0ea5e9', dark: false },
  // 数据可视化
  { name: '城市脉搏', type: 'dashboard', accent: '#22d3ee', dark: true },
  { name: '运营罗盘', type: 'dashboard', accent: '#34d399', dark: true },
]

const toast = useToast()
const filter = ref('all')

const visible = computed(() =>
  filter.value === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => typeById(t.type)?.group === filter.value),
)
</script>

<template>
  <section id="templates" class="relative scroll-mt-20 py-24">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="模板库"
        title="从精选模板开始,快人一步"
        desc="每一套模板都由 AI 生成、人工精调。选一个喜欢的风格,再让它变成你的样子。"
      />

      <!-- 分组筛选 tab -->
      <div class="mt-10 flex flex-wrap justify-center gap-2">
        <button
          v-for="g in ['all', ...TYPE_GROUPS]"
          :key="g"
          class="rounded-full px-4 py-2 text-sm transition-all"
          :class="
            filter === g
              ? 'bg-brand-gradient font-semibold text-white shadow-lg shadow-brand1/25'
              : 'border border-line/10 bg-ink/[0.04] text-mut hover:border-line/20 hover:text-ink'
          "
          @click="filter = g"
        >
          {{ g === 'all' ? '全部' : g }}
        </button>
      </div>

      <!-- 模板网格(key 切换触发交错动画) -->
      <div :key="filter" class="stagger mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="tpl in visible"
          :key="tpl.name"
          class="group overflow-hidden rounded-2xl border border-line/10 bg-soft/60 transition-all duration-300 hover:-translate-y-1 hover:border-brand1/40 hover:shadow-xl hover:shadow-brand1/10"
        >
          <div class="relative aspect-[4/3] overflow-hidden">
            <TemplateThumb :type="tpl.type" :accent="tpl.accent" :dark="tpl.dark" />
            <button
              class="bg-brand-gradient absolute inset-x-4 bottom-3 flex translate-y-2 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
              @click="toast.info('演示环境', `模板「${tpl.name}」已加入你的工作台(演示)。`)"
            >
              使用模板
              <ArrowUpRight class="h-3.5 w-3.5" />
            </button>
          </div>
          <div class="flex items-center justify-between px-4 py-3">
            <span class="text-sm font-medium text-ink">{{ tpl.name }}</span>
            <span class="rounded-md border border-line/10 bg-ink/[0.04] px-2 py-0.5 text-xs text-mut">
              {{ typeById(tpl.type)?.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import SectionHeading from './SectionHeading.vue'
import { useToast } from '../composables/useToast'

const toast = useToast()

const PLANS = [
  {
    name: '免费版',
    price: '¥0',
    period: '永久免费',
    desc: '适合个人尝鲜与轻量使用',
    cta: '立即开始',
    highlight: false,
    features: ['每月 3 次 AI 生成', '2 个站点,基础模板库', 'siteforge.app 子域名', '社区支持'],
  },
  {
    name: '专业版',
    price: '¥49',
    period: '每月',
    desc: '适合创作者与独立开发者',
    cta: '升级专业版',
    highlight: true,
    features: [
      '无限次 AI 生成与重生成',
      '20 个站点,全部高级模板',
      '自定义域名 + 免费 SSL',
      '可视化编辑器全部功能',
      '优先技术支持',
    ],
  },
  {
    name: '团队版',
    price: '¥199',
    period: '每月',
    desc: '适合团队协作与品牌客户',
    cta: '联系销售',
    highlight: false,
    features: [
      '专业版全部功能',
      '10 个团队成员席位',
      '团队组件库与品牌规范',
      'SSO 登录与权限管理',
      '专属客户成功经理',
    ],
  },
]
</script>

<template>
  <section id="pricing" class="relative scroll-mt-20 py-24">
    <div class="glow-brand1 pointer-events-none absolute bottom-0 left-1/2 h-72 w-[680px] -translate-x-1/2 rounded-full blur-[130px]" />
    <div class="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="定价"
        title="简单透明的价格"
        desc="从免费开始,随你的成长随时升级。所有方案都支持随时取消。"
      />

      <div class="stagger mt-14 grid items-stretch gap-6 md:grid-cols-3">
        <div
          v-for="plan in PLANS"
          :key="plan.name"
          class="relative flex flex-col rounded-2xl border p-7 transition-all duration-300"
          :class="
            plan.highlight
              ? 'border-brand1/50 bg-gradient-to-b from-brand1/12 to-soft/80 shadow-2xl shadow-brand1/20 md:-my-3 md:py-10'
              : 'border-line/10 bg-soft/60 hover:border-line/20'
          "
        >
          <span
            v-if="plan.highlight"
            class="bg-brand-gradient absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-lg"
          >
            最受欢迎
          </span>
          <h3 class="text-lg font-semibold text-ink">{{ plan.name }}</h3>
          <p class="mt-1 text-sm text-mut">{{ plan.desc }}</p>
          <div class="mt-5 flex items-baseline gap-2">
            <span class="text-4xl font-extrabold tracking-tight text-ink">{{ plan.price }}</span>
            <span class="text-sm text-faint">/ {{ plan.period }}</span>
          </div>
          <ul class="mt-6 flex-1 space-y-3">
            <li v-for="f in plan.features" :key="f" class="flex items-start gap-2.5 text-sm text-sub">
              <Check
                class="mt-0.5 h-4 w-4 shrink-0"
                :class="plan.highlight ? 'text-brand1' : 'text-brand2'"
              />
              {{ f }}
            </li>
          </ul>
          <button
            class="mt-8 w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]"
            :class="
              plan.highlight
                ? 'bg-brand-gradient text-white shadow-lg shadow-brand1/30 hover:brightness-110'
                : 'border border-line/15 bg-ink/5 text-ink hover:bg-ink/10'
            "
            @click="toast.info('演示环境', `「${plan.name}」暂未开放购买,敬请期待。`)"
          >
            {{ plan.cta }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

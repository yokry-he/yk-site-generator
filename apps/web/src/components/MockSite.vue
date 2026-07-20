<script setup lang="ts">
/**
 * 用纯 CSS 绘制的各类型网站缩略骨架预览。
 * 通过可复用基元(Nav / HeroBlock / CardRow / BarChart 等)组合出 14 种类型,
 * mock 代表"生成的网站",配色与界面主题无关,固定即可。
 */
import MockBar from './mock/MockBar.vue'
import MockNav from './mock/MockNav.vue'
import MockHeroBlock from './mock/MockHeroBlock.vue'
import MockCardRow from './mock/MockCardRow.vue'
import MockBarChart from './mock/MockBarChart.vue'

defineProps<{ type: string }>()

const portfolioCells = [
  'from-violet-500/70 to-fuchsia-500/50 row-span-2',
  'from-cyan-500/60 to-sky-500/40',
  'from-amber-500/50 to-orange-500/30',
  'from-emerald-500/50 to-teal-500/30 row-span-2',
  'from-rose-500/50 to-pink-500/30',
  'from-indigo-500/60 to-violet-500/40',
]
</script>

<template>
  <!-- 个人主页 -->
  <div v-if="type === 'personal'" class="flex h-full flex-col items-center justify-center gap-2.5 bg-zinc-950 px-6 py-4">
    <div class="h-10 w-10 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400" />
    <MockBar class-name="h-2.5 w-24 bg-zinc-200" />
    <MockBar class-name="h-1.5 w-36 bg-zinc-700" />
    <MockBar class-name="h-1.5 w-28 bg-zinc-700" />
    <div class="mt-1 flex gap-1.5">
      <span
        v-for="t in ['设计', '前端', '摄影']"
        :key="t"
        class="rounded-md border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[8px] text-violet-300"
      >
        {{ t }}
      </span>
    </div>
    <div class="mt-1 flex gap-2">
      <div v-for="i in 4" :key="i" class="h-3.5 w-3.5 rounded-full bg-zinc-700" />
    </div>
  </div>

  <!-- 作品集 -->
  <div v-else-if="type === 'portfolio'" class="flex h-full flex-col bg-zinc-950 p-3">
    <div class="mb-2 flex items-center justify-between">
      <MockBar class-name="h-2 w-16 bg-zinc-200" />
      <div class="flex gap-1.5">
        <MockBar v-for="i in 3" :key="i" class-name="h-1.5 w-6 bg-zinc-700" />
      </div>
    </div>
    <div class="grid flex-1 grid-cols-3 grid-rows-3 gap-1.5">
      <div v-for="(c, i) in portfolioCells" :key="i" :class="`rounded-md bg-gradient-to-br ${c}`" />
    </div>
  </div>

  <!-- 在线简历 -->
  <div v-else-if="type === 'resume'" class="flex h-full bg-slate-50">
    <div class="flex w-1/3 flex-col items-center gap-1.5 bg-slate-800 p-3">
      <div class="h-8 w-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-400" />
      <MockBar class-name="h-1.5 w-12 bg-slate-300" />
      <div v-for="(w, i) in [70, 90, 55, 80]" :key="i" class="mt-1 w-full">
        <MockBar class-name="mb-0.5 h-1 w-3/4 bg-slate-600" />
        <div class="h-1 rounded-full bg-slate-700">
          <div class="h-full rounded-full bg-sky-400" :style="{ width: `${w}%` }" />
        </div>
      </div>
    </div>
    <div class="flex-1 space-y-2 p-3">
      <MockBar class-name="h-2 w-1/2 bg-slate-800" />
      <div v-for="i in 3" :key="i" class="flex gap-1.5">
        <div class="mt-0.5 h-2 w-2 shrink-0 rounded-full border-2 border-sky-400" />
        <div class="flex-1">
          <MockBar class-name="h-1.5 w-3/4 bg-slate-300" />
          <MockBar class-name="mt-1 h-1 w-1/2 bg-slate-200" />
        </div>
      </div>
    </div>
  </div>

  <!-- 博客站 -->
  <div v-else-if="type === 'blog'" class="flex h-full flex-col bg-white">
    <MockNav :dark="false" accent="#f59e0b" />
    <div class="flex-1 space-y-2.5 overflow-hidden p-3">
      <div v-for="i in 4" :key="i" class="border-b border-slate-100 pb-2">
        <MockBar class-name="h-1.5 w-3/4 bg-slate-700" />
        <div class="mt-1 flex gap-1.5">
          <MockBar class-name="h-1 w-8 bg-amber-300" />
          <MockBar class-name="h-1 w-10 bg-slate-200" />
        </div>
        <MockBar class-name="mt-1 h-1 w-full bg-slate-200" />
      </div>
    </div>
  </div>

  <!-- 企业官网 -->
  <div v-else-if="type === 'business'" class="flex h-full flex-col bg-slate-50">
    <MockNav :dark="false" accent="#6366f1" />
    <MockHeroBlock :dark="false" accent="#6366f1" />
    <MockCardRow :dark="false" accent="#22d3ee" />
  </div>

  <!-- SaaS 产品页 -->
  <div v-else-if="type === 'saas'" class="flex h-full flex-col bg-white">
    <MockNav :dark="false" accent="#7c3aed" />
    <MockHeroBlock :dark="false" accent="#7c3aed" />
    <div class="mx-4 mb-2 flex items-center justify-center gap-2 rounded-lg bg-slate-50 py-1.5">
      <MockBar v-for="i in 5" :key="i" class-name="h-1.5 w-6 bg-slate-300" />
    </div>
    <div class="grid grid-cols-3 gap-2 px-4 pb-3">
      <div
        v-for="(p, i) in [0, 49, 199]"
        :key="i"
        class="rounded-lg p-2"
        :class="i === 1 ? 'bg-violet-600' : 'border border-slate-200'"
      >
        <MockBar :class-name="`h-1.5 w-2/3 ${i === 1 ? 'bg-white/80' : 'bg-slate-300'}`" />
        <div class="mt-1 text-[10px] font-bold" :class="i === 1 ? 'text-white' : 'text-slate-500'">¥{{ p }}</div>
      </div>
    </div>
  </div>

  <!-- 活动落地页 -->
  <div v-else-if="type === 'landing'" class="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-violet-950/60 to-zinc-950 px-6">
    <span class="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[8px] text-violet-300">
      限时报名中
    </span>
    <MockBar class-name="h-2.5 w-36 bg-zinc-100" />
    <MockBar class-name="h-1.5 w-28 bg-zinc-600" />
    <div class="mt-1 flex gap-1.5">
      <div
        v-for="n in ['02', '18', '45']"
        :key="n"
        class="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-cyan-300"
      >
        {{ n }}
      </div>
    </div>
    <div class="mt-1.5 h-6 w-20 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500" />
  </div>

  <!-- 电商橱窗 -->
  <div v-else-if="type === 'shop'" class="flex h-full flex-col bg-amber-50/60">
    <MockNav :dark="false" accent="#f59e0b" />
    <div class="grid flex-1 grid-cols-4 gap-2 p-3">
      <div v-for="i in 8" :key="i" class="flex flex-col gap-1">
        <div
          class="flex-1 rounded-md"
          :style="{ background: ['#fcd34d', '#fdba74', '#fca5a5', '#c4b5fd'][i % 4], opacity: 0.75 }"
        />
        <MockBar class-name="h-1 w-full bg-amber-200" />
        <div class="text-[8px] font-bold text-amber-700">¥{{ [59, 89, 129, 45][i % 4] }}</div>
      </div>
    </div>
  </div>

  <!-- 餐饮门店页 -->
  <div v-else-if="type === 'restaurant'" class="flex h-full flex-col bg-stone-900">
    <div class="flex h-1/3 items-center justify-center bg-gradient-to-br from-amber-600/60 to-red-700/40">
      <MockBar class-name="h-2 w-24 bg-amber-100/90" />
    </div>
    <div class="flex-1 space-y-2 p-3">
      <div v-for="(p, i) in [38, 58, 88, 26]" :key="i" class="flex items-center gap-1.5">
        <MockBar class-name="h-1.5 w-14 bg-stone-400" />
        <div class="flex-1 border-b border-dotted border-stone-600" />
        <span class="text-[8px] font-bold text-amber-400">¥{{ p }}</span>
      </div>
      <div class="mt-2 flex justify-between">
        <MockBar class-name="h-1 w-20 bg-stone-600" />
        <div class="h-4 w-14 rounded-full bg-amber-500" />
      </div>
    </div>
  </div>

  <!-- 教育课程页 -->
  <div v-else-if="type === 'education'" class="flex h-full flex-col bg-slate-50">
    <MockNav :dark="false" accent="#10b981" />
    <div class="grid flex-1 grid-cols-2 gap-2 p-3">
      <div v-for="(p, i) in [75, 40, 90, 20]" :key="i" class="rounded-lg border border-slate-200 bg-white p-2">
        <div class="mb-1.5 h-6 rounded" :style="{ background: ['#a7f3d0', '#bae6fd', '#fde68a', '#fbcfe8'][i] }" />
        <MockBar class-name="h-1.5 w-full bg-slate-300" />
        <div class="mt-1.5 h-1 rounded-full bg-slate-100">
          <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${p}%` }" />
        </div>
      </div>
    </div>
  </div>

  <!-- 文档站 -->
  <div v-else-if="type === 'docs'" class="flex h-full bg-white">
    <div class="w-1/4 border-r border-slate-200 bg-slate-50 p-2.5">
      <MockBar class-name="mb-2 h-1.5 w-3/4 bg-slate-300" />
      <MockBar
        v-for="i in 6"
        :key="i"
        :class-name="`mb-1.5 h-1.5 ${i === 2 ? 'w-full bg-violet-400/70' : 'w-5/6 bg-slate-200'}`"
      />
    </div>
    <div class="flex-1 p-3">
      <MockBar class-name="mb-2 h-2.5 w-1/2 bg-slate-800" />
      <MockBar v-for="i in 3" :key="i" class-name="mb-1.5 h-1.5 w-full bg-slate-200" />
      <MockBar class-name="mb-2 h-1.5 w-2/3 bg-slate-200" />
      <div class="rounded-md bg-zinc-900 p-2">
        <MockBar class-name="mb-1 h-1.5 w-3/4 bg-cyan-400/60" />
        <MockBar class-name="mb-1 h-1.5 w-1/2 bg-violet-400/60" />
        <MockBar class-name="h-1.5 w-2/3 bg-zinc-600" />
      </div>
    </div>
  </div>

  <!-- 知识库 Wiki -->
  <div v-else-if="type === 'wiki'" class="flex h-full flex-col bg-white">
    <div class="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
      <div class="h-3 w-3 rounded bg-emerald-500" />
      <div class="flex-1 rounded-md bg-slate-100 px-2 py-1 text-[8px] text-slate-400">搜索词条……</div>
    </div>
    <div class="flex flex-1">
      <div class="w-1/4 space-y-1.5 border-r border-slate-100 p-2.5">
        <MockBar
          v-for="i in 4"
          :key="i"
          :class-name="`h-1.5 ${i === 1 ? 'w-full bg-emerald-400/70' : 'w-4/5 bg-slate-200'}`"
        />
      </div>
      <div class="flex-1 p-2.5">
        <MockBar class-name="mb-2 h-2 w-1/2 bg-slate-800" />
        <MockBar class-name="mb-1.5 h-1 w-full bg-slate-200" />
        <MockBar class-name="mb-2 h-1 w-3/4 bg-slate-200" />
        <div class="grid grid-cols-3 gap-px overflow-hidden rounded border border-slate-200 bg-slate-200">
          <div v-for="i in 6" :key="i" class="bg-white p-1">
            <MockBar class-name="h-1 w-full bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 社区论坛 -->
  <div v-else-if="type === 'forum'" class="flex h-full flex-col bg-slate-50">
    <MockNav :dark="false" accent="#0ea5e9" />
    <div class="flex-1 space-y-1.5 overflow-hidden p-3">
      <div
        v-for="(n, i) in [128, 86, 45, 23, 9]"
        :key="i"
        class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
      >
        <div
          class="h-4 w-4 shrink-0 rounded-full"
          :style="{ background: ['#7dd3fc', '#c4b5fd', '#fda4af', '#86efac', '#fcd34d'][i] }"
        />
        <div class="min-w-0 flex-1">
          <MockBar class-name="h-1.5 w-4/5 bg-slate-300" />
          <MockBar class-name="mt-1 h-1 w-1/3 bg-slate-200" />
        </div>
        <span v-if="i === 0" class="rounded bg-red-100 px-1 py-0.5 text-[7px] font-bold text-red-500">热</span>
        <span class="text-[8px] text-slate-400">{{ n }}</span>
      </div>
    </div>
  </div>

  <!-- 数据大屏 -->
  <div v-else class="flex h-full flex-col gap-2 bg-[#050810] p-3">
    <div class="flex items-center justify-between">
      <MockBar class-name="h-2 w-24 bg-cyan-400/70" />
      <MockBar class-name="h-1.5 w-12 bg-zinc-700" />
    </div>
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="[num, color] in [['2,847', 'text-cyan-300'], ['96.2%', 'text-violet-300'], ['1,204', 'text-emerald-300']]"
        :key="num"
        class="rounded-md border border-white/8 bg-white/5 p-1.5"
      >
        <div class="text-[11px] leading-none font-bold" :class="color">{{ num }}</div>
        <MockBar class-name="mt-1 h-1 w-3/4 bg-zinc-700" />
      </div>
    </div>
    <div class="flex flex-1 gap-2">
      <MockBarChart accent="#8b5cf6" :heights="[40, 65, 50, 80, 58, 92, 70, 45]" />
      <div class="flex-1 rounded-md border border-white/8 bg-white/5 p-1.5">
        <svg viewBox="0 0 100 50" class="h-full w-full" preserveAspectRatio="none">
          <polyline points="0,38 15,30 30,34 45,18 60,24 75,10 90,16 100,6" fill="none" stroke="#22d3ee" stroke-width="2" />
          <polyline points="0,44 15,40 30,42 45,32 60,36 75,28 90,30 100,22" fill="none" stroke="#a78bfa" stroke-width="1.5" opacity="0.7" />
        </svg>
      </div>
    </div>
  </div>
</template>

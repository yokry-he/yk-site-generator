<script setup lang="ts">
/** 模板缩略图:按类型绘制的 CSS 线框(与界面主题无关,由 dark/accent 决定观感) */
import { computed } from 'vue'
import MockBar from './mock/MockBar.vue'

const props = defineProps<{ type: string; accent: string; dark: boolean }>()

const bg = computed(() => (props.dark ? 'bg-zinc-900' : 'bg-slate-100'))
const bar = computed(() => (props.dark ? 'bg-zinc-600' : 'bg-slate-300'))
const soft = computed(() => (props.dark ? 'bg-zinc-800' : 'bg-slate-200'))
</script>

<template>
  <!-- 个人主页 -->
  <div v-if="type === 'personal'" :class="`flex h-full flex-col items-center justify-center gap-1.5 ${bg}`">
    <div class="h-6 w-6 rounded-full" :style="{ background: accent }" />
    <MockBar :class-name="`h-1.5 w-12 ${soft}`" />
    <MockBar :class-name="`h-1 w-16 ${soft}`" />
    <div class="mt-1 flex gap-1">
      <div v-for="i in 3" :key="i" class="h-2 w-2 rounded-full" :style="{ background: accent, opacity: 0.3 + i * 0.2 }" />
    </div>
  </div>

  <!-- 作品集 -->
  <div v-else-if="type === 'portfolio'" :class="`grid h-full grid-cols-3 grid-rows-2 gap-1 p-2 ${bg}`">
    <div
      v-for="i in 6"
      :key="i"
      class="rounded"
      :style="{ background: accent, opacity: 0.25 + ((i * 7) % 5) * 0.14 }"
    />
  </div>

  <!-- 在线简历 -->
  <div v-else-if="type === 'resume'" :class="`flex h-full ${bg}`">
    <div class="flex w-1/3 flex-col items-center gap-1 p-2" :class="dark ? 'bg-zinc-950/70' : 'bg-slate-700'">
      <div class="h-4 w-4 rounded-full" :style="{ background: accent }" />
      <div v-for="(w, i) in [70, 90, 55]" :key="i" class="h-0.5 w-full rounded-full bg-white/20">
        <div class="h-full rounded-full" :style="{ width: `${w}%`, background: accent }" />
      </div>
    </div>
    <div class="flex-1 space-y-1.5 p-2">
      <MockBar :class-name="`h-1.5 w-1/2 ${bar}`" />
      <div v-for="i in 3" :key="i" class="flex gap-1">
        <div class="mt-0.5 h-1.5 w-1.5 rounded-full" :style="{ background: accent }" />
        <MockBar :class-name="`h-1 flex-1 ${soft}`" />
      </div>
    </div>
  </div>

  <!-- 博客站 -->
  <div v-else-if="type === 'blog'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center justify-between px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-1.5 w-6 rounded-full" :style="{ background: accent }" />
      <div class="flex gap-1">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 w-3 ${bar}`" />
      </div>
    </div>
    <div class="flex-1 space-y-2 p-2.5">
      <div v-for="i in 3" :key="i">
        <MockBar :class-name="`h-1.5 w-3/4 ${bar}`" />
        <div class="mt-1 flex gap-1">
          <div class="h-1 w-6 rounded-full" :style="{ background: accent, opacity: 0.6 }" />
          <MockBar :class-name="`h-1 w-8 ${soft}`" />
        </div>
        <MockBar :class-name="`mt-1 h-1 w-full ${soft}`" />
      </div>
    </div>
  </div>

  <!-- 企业官网 -->
  <div v-else-if="type === 'business'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center justify-between px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-1.5 w-6 rounded-full" :style="{ background: accent }" />
      <div class="flex gap-1">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 w-3 ${bar}`" />
      </div>
    </div>
    <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
      <MockBar :class-name="`h-1.5 w-20 ${bar}`" />
      <MockBar :class-name="`h-1 w-14 ${soft}`" />
      <div class="mt-0.5 h-3 w-10 rounded" :style="{ background: accent }" />
    </div>
    <div class="grid grid-cols-3 gap-1 px-2.5 pb-2">
      <div v-for="i in 3" :key="i" :class="`h-5 rounded ${soft}`" />
    </div>
  </div>

  <!-- SaaS 产品页 -->
  <div v-else-if="type === 'saas'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center justify-between px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-1.5 w-6 rounded-full" :style="{ background: accent }" />
      <div class="flex gap-1">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 w-3 ${bar}`" />
      </div>
    </div>
    <div class="flex flex-1 flex-col items-center justify-center gap-1.5">
      <MockBar :class-name="`h-1.5 w-20 ${bar}`" />
      <div class="mt-0.5 flex gap-1">
        <MockBar v-for="i in 4" :key="i" :class-name="`h-1 w-5 ${soft}`" />
      </div>
    </div>
    <div class="grid grid-cols-3 gap-1 px-2.5 pb-2">
      <div
        v-for="i in 3"
        :key="i"
        class="flex h-6 items-center justify-center rounded text-[8px] font-bold"
        :style="i === 2 ? { background: accent, color: '#fff' } : undefined"
      >
        <MockBar v-if="i !== 2" :class-name="`h-1 w-6 ${soft}`" />
        <template v-else>¥49</template>
      </div>
    </div>
  </div>

  <!-- 活动落地页 -->
  <div v-else-if="type === 'landing'" :class="`flex h-full flex-col items-center justify-center gap-1.5 ${bg}`">
    <div class="h-2 w-8 rounded-full" :style="{ background: accent, opacity: 0.4 }" />
    <MockBar :class-name="`h-1.5 w-20 ${bar}`" />
    <MockBar :class-name="`h-1 w-14 ${soft}`" />
    <div class="mt-0.5 flex gap-1">
      <div v-for="i in 3" :key="i" :class="`h-4 w-4 rounded ${soft}`" />
    </div>
    <div class="mt-0.5 h-3.5 w-12 rounded-full" :style="{ background: accent }" />
  </div>

  <!-- 电商橱窗 -->
  <div v-else-if="type === 'shop'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center justify-between px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-1.5 w-6 rounded-full" :style="{ background: accent }" />
      <div class="flex gap-1">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 w-3 ${bar}`" />
      </div>
    </div>
    <div class="grid flex-1 grid-cols-4 gap-1 p-2">
      <div v-for="i in 8" :key="i" class="flex flex-col gap-0.5">
        <div class="flex-1 rounded" :style="{ background: accent, opacity: 0.3 + (i % 4) * 0.18 }" />
        <MockBar :class-name="`h-0.5 w-full ${soft}`" />
      </div>
    </div>
  </div>

  <!-- 餐饮门店页 -->
  <div v-else-if="type === 'restaurant'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex h-1/3 items-center justify-center" :style="{ background: `${accent}55` }">
      <MockBar :class-name="`h-1.5 w-16 ${dark ? 'bg-zinc-200' : 'bg-white'}`" />
    </div>
    <div class="flex-1 space-y-1.5 p-2.5">
      <div v-for="i in 3" :key="i" class="flex items-center gap-1">
        <MockBar :class-name="`h-1 w-10 ${bar}`" />
        <div class="flex-1 border-b border-dotted" :class="dark ? 'border-zinc-700' : 'border-slate-300'" />
        <div class="h-1.5 w-4 rounded-full" :style="{ background: accent }" />
      </div>
    </div>
  </div>

  <!-- 教育课程页 -->
  <div v-else-if="type === 'education'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center justify-between px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-1.5 w-6 rounded-full" :style="{ background: accent }" />
      <div class="flex gap-1">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 w-3 ${bar}`" />
      </div>
    </div>
    <div class="grid flex-1 grid-cols-2 gap-1.5 p-2">
      <div
        v-for="i in 4"
        :key="i"
        class="rounded p-1.5"
        :class="dark ? 'bg-zinc-800' : 'border border-slate-200 bg-white'"
      >
        <div class="mb-1 h-3 rounded" :style="{ background: accent, opacity: 0.3 + i * 0.15 }" />
        <MockBar :class-name="`h-1 w-full ${soft}`" />
        <div :class="`mt-1 h-0.5 rounded-full ${soft}`">
          <div class="h-full rounded-full" :style="{ width: `${30 + i * 20}%`, background: accent }" />
        </div>
      </div>
    </div>
  </div>

  <!-- 文档站 -->
  <div v-else-if="type === 'docs'" :class="`flex h-full ${bg}`">
    <div
      class="w-1/3 space-y-1 border-r p-2"
      :class="dark ? 'border-white/8 bg-zinc-950/50' : 'border-slate-200 bg-white'"
    >
      <div
        v-for="i in 5"
        :key="i"
        class="h-1 rounded-full"
        :class="i === 2 ? '' : soft"
        :style="i === 2 ? { background: accent, height: '4px' } : undefined"
      />
    </div>
    <div class="flex-1 space-y-1 p-2">
      <MockBar :class-name="`h-1.5 w-2/3 ${bar}`" />
      <MockBar :class-name="`h-1 w-full ${soft}`" />
      <MockBar :class-name="`h-1 w-5/6 ${soft}`" />
      <div class="mt-1 h-6 rounded" :style="{ background: dark ? '#0c0c10' : '#1e293b' }">
        <div class="mt-1.5 ml-1.5 h-1 w-1/2 rounded-full" :style="{ background: accent, opacity: 0.7 }" />
      </div>
    </div>
  </div>

  <!-- 知识库 Wiki -->
  <div v-else-if="type === 'wiki'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center gap-1.5 px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-2 w-2 rounded" :style="{ background: accent }" />
      <div :class="`h-3 flex-1 rounded ${soft}`" />
    </div>
    <div class="flex flex-1">
      <div class="w-1/4 space-y-1 p-2">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 ${i === 1 ? 'w-full' : 'w-4/5'} ${soft}`" />
      </div>
      <div class="flex-1 space-y-1 p-2">
        <MockBar :class-name="`h-1.5 w-1/2 ${bar}`" />
        <div :class="`grid grid-cols-3 gap-px rounded ${soft}`">
          <div v-for="i in 6" :key="i" :class="`p-1 ${bg}`">
            <MockBar :class-name="`h-0.5 w-full ${bar}`" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 社区论坛 -->
  <div v-else-if="type === 'forum'" :class="`flex h-full flex-col ${bg}`">
    <div class="flex items-center justify-between px-2.5 py-1.5" :class="dark ? 'bg-zinc-950/60' : 'bg-white'">
      <div class="h-1.5 w-6 rounded-full" :style="{ background: accent }" />
      <div class="flex gap-1">
        <MockBar v-for="i in 3" :key="i" :class-name="`h-1 w-3 ${bar}`" />
      </div>
    </div>
    <div class="flex-1 space-y-1 p-2">
      <div
        v-for="i in 4"
        :key="i"
        class="flex items-center gap-1.5 rounded px-1.5 py-1"
        :class="dark ? 'bg-zinc-800' : 'border border-slate-200 bg-white'"
      >
        <div class="h-2.5 w-2.5 rounded-full" :style="{ background: accent, opacity: 0.4 + i * 0.18 }" />
        <MockBar :class-name="`h-1 flex-1 ${soft}`" />
        <span v-if="i === 1" class="rounded bg-red-500/15 px-1 text-[7px] font-bold text-red-500">热</span>
      </div>
    </div>
  </div>

  <!-- 数据大屏 -->
  <div v-else class="flex h-full flex-col gap-1 bg-[#050810] p-2">
    <div class="grid grid-cols-3 gap-1">
      <div v-for="i in 3" :key="i" class="rounded border border-white/8 bg-white/5 p-1">
        <div class="h-1.5 w-2/3 rounded-full" :style="{ background: accent }" />
      </div>
    </div>
    <div class="flex flex-1 items-end justify-around rounded border border-white/8 bg-white/5 px-1.5 pb-1">
      <div
        v-for="(h, i) in [45, 70, 55, 90, 62, 78]"
        :key="i"
        class="w-1 rounded-sm"
        :style="{ height: `${h}%`, background: accent, opacity: 0.55 + (i % 3) * 0.15 }"
      />
    </div>
  </div>
</template>

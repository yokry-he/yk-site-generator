<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Sparkles, Menu, X, Plug } from 'lucide-vue-next'
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'

const NAV_LINKS = [
  { label: '首页', to: '/' },
  { label: '在线体验', to: '/generator' },
  { label: '模板库', to: '/templates' },
  { label: '定价', to: '/pricing' },
]

const route = useRoute()
const scrolled = ref(false)
const open = ref(false)
const { activeProvider } = useModelConfig()
const { show: showModelSettings } = useModelDialog()

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

function onScroll() {
  scrolled.value = window.scrollY > 12
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-all duration-300"
    :class="scrolled ? 'border-b border-line/8 bg-app/70 backdrop-blur-xl' : 'bg-transparent'"
  >
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <RouterLink to="/" class="flex shrink-0 items-center gap-2">
        <span class="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-brand1/25">
          <Sparkles class="h-4.5 w-4.5 text-white" :stroke-width="2.2" />
        </span>
        <span class="text-lg font-bold tracking-tight text-ink">SiteForge</span>
      </RouterLink>

      <nav class="hidden items-center gap-7 lg:flex">
        <RouterLink
          v-for="link in NAV_LINKS"
          :key="link.to"
          :to="link.to"
          class="relative text-sm transition-colors"
          :class="isActive(link.to) ? 'font-semibold text-ink' : 'text-mut hover:text-ink'"
        >
          {{ link.label }}
          <span
            v-if="isActive(link.to)"
            class="bg-brand-gradient absolute -bottom-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
          />
        </RouterLink>
      </nav>

      <div class="flex items-center gap-2">
        <ThemeSwitcher />
        <button
          class="relative hidden items-center gap-1.5 rounded-full border border-line/10 bg-ink/5 px-3 py-1.5 text-xs text-mut transition-colors hover:border-line/20 hover:text-ink sm:flex"
          @click="showModelSettings"
        >
          <Plug class="h-3.5 w-3.5" />
          <span class="hidden lg:inline">模型设置</span>
          <span v-if="activeProvider" class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400" />
        </button>
        <RouterLink
          to="/generator"
          class="bg-brand-gradient hidden rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-brand1/25 transition-transform hover:scale-[1.03] active:scale-95 sm:inline-block"
        >
          免费开始
        </RouterLink>
        <button
          class="rounded-lg p-2 text-mut hover:bg-ink/5 hover:text-ink lg:hidden"
          aria-label="打开菜单"
          @click="open = !open"
        >
          <X v-if="open" class="h-5 w-5" />
          <Menu v-else class="h-5 w-5" />
        </button>
      </div>
    </div>

    <nav v-if="open" class="border-t border-line/8 bg-app/95 px-4 py-4 backdrop-blur-xl lg:hidden">
      <div class="flex flex-col gap-1">
        <RouterLink
          v-for="link in NAV_LINKS"
          :key="link.to"
          :to="link.to"
          class="rounded-lg px-3 py-2.5 text-sm"
          :class="isActive(link.to) ? 'bg-brand1/12 font-semibold text-ink' : 'text-sub hover:bg-ink/5 hover:text-ink'"
          @click="open = false"
        >
          {{ link.label }}
        </RouterLink>
        <button
          class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-sub hover:bg-ink/5 hover:text-ink"
          @click="((open = false), showModelSettings())"
        >
          <Plug class="h-4 w-4" />
          模型设置
          <span v-if="activeProvider" class="h-2 w-2 rounded-full bg-emerald-400" />
        </button>
        <RouterLink
          to="/generator"
          class="bg-brand-gradient mt-2 rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white"
          @click="open = false"
        >
          免费开始
        </RouterLink>
      </div>
    </nav>
  </header>
</template>

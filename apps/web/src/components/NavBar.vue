<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChevronDown,
  CircleHelp,
  FlaskConical,
  FolderKanban,
  Gauge,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageSquareText,
  Palette,
  Plug,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-vue-next'
import ThemeSwitcher from './ThemeSwitcher.vue'
import { useAuth } from '../composables/useAuth'
import { useAuthDialog } from '../composables/useAuthDialog'
import { useModelConfig } from '../composables/useModelConfig'
import { useModelDialog } from '../composables/useModelDialog'
import { useToast } from '../composables/useToast'

const NAV_LINKS = [
  { label: '首页', to: '/' },
  { label: '在线体验', to: '/generator' },
  { label: '模板库', to: '/templates' },
  { label: '定价', to: '/pricing' },
]

const route = useRoute()
const router = useRouter()
const scrolled = ref(false)
const open = ref(false)
const accountOpen = ref(false)
const { activeProvider } = useModelConfig()
const { show: showModelSettings } = useModelDialog()
const { user, isAuthenticated, isAdmin, isOperator, hasPermission, logout } = useAuth()
const { show: showAuth } = useAuthDialog()
const toast = useToast()
const initials = computed(() => user.value?.email.slice(0, 2).toUpperCase() ?? 'SF')

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

function onScroll() {
  scrolled.value = window.scrollY > 12
}

function openOnboarding() {
  accountOpen.value = false
  open.value = false
  window.dispatchEvent(new CustomEvent('siteforge:open-onboarding'))
}

async function signOut() {
  accountOpen.value = false
  open.value = false
  await logout()
  toast.success('已安全退出账号')
  if (
    route.path.startsWith('/projects') ||
    route.path === '/usage' ||
    route.path === '/brand' ||
    route.path.startsWith('/admin')
  ) await router.push('/')
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('[data-account-menu]')) accountOpen.value = false
}

watch(() => route.path, () => {
  open.value = false
  accountOpen.value = false
})

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('click', onDocumentClick)
})
</script>

<template>
  <header class="fixed inset-x-0 top-0 z-50 transition-all duration-300" :class="scrolled ? 'border-b border-line/8 bg-app/75 backdrop-blur-xl' : 'bg-transparent'">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <RouterLink to="/" class="flex shrink-0 items-center gap-2"><span class="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg shadow-lg shadow-brand1/25"><Sparkles class="h-4.5 w-4.5 text-white" :stroke-width="2.2" /></span><span class="text-lg font-bold tracking-tight text-ink">SiteForge</span></RouterLink>

      <nav class="hidden items-center gap-7 lg:flex">
        <RouterLink v-for="link in NAV_LINKS" :key="link.to" :to="link.to" class="relative text-sm transition-colors" :class="isActive(link.to) ? 'font-semibold text-ink' : 'text-mut hover:text-ink'">{{ link.label }}<span v-if="isActive(link.to)" class="bg-brand-gradient absolute -bottom-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" /></RouterLink>
        <template v-if="isAuthenticated">
          <RouterLink to="/projects" class="relative text-sm transition-colors" :class="isActive('/projects') ? 'font-semibold text-ink' : 'text-mut hover:text-ink'">我的项目<span v-if="isActive('/projects')" class="bg-brand-gradient absolute -bottom-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" /></RouterLink>
          <RouterLink to="/brand" class="relative text-sm transition-colors" :class="isActive('/brand') ? 'font-semibold text-ink' : 'text-mut hover:text-ink'">品牌<span v-if="isActive('/brand')" class="bg-brand-gradient absolute -bottom-2 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full" /></RouterLink>
        </template>
      </nav>

      <div class="flex items-center gap-2">
        <ThemeSwitcher />
        <button class="relative hidden items-center gap-1.5 rounded-full border border-line/10 bg-ink/5 px-3 py-1.5 text-xs text-mut transition-colors hover:border-line/20 hover:text-ink sm:flex" @click="showModelSettings"><Plug class="h-3.5 w-3.5" /><span class="hidden xl:inline">模型设置</span><span v-if="activeProvider" class="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400" /></button>

        <div v-if="isAuthenticated" data-account-menu class="relative hidden sm:block">
          <button class="flex max-w-52 items-center gap-2 rounded-full border border-line/10 bg-soft/70 p-1 pr-2.5 text-xs text-sub shadow-sm transition-colors hover:border-brand1/25 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/45" :aria-expanded="accountOpen" aria-haspopup="menu" @click.stop="accountOpen = !accountOpen"><span class="bg-brand-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white">{{ initials }}</span><span class="hidden max-w-28 truncate xl:block">{{ user?.email }}</span><ChevronDown class="h-3.5 w-3.5 transition-transform" :class="accountOpen ? 'rotate-180' : ''" /></button>
          <Transition name="menu"><div v-if="accountOpen" role="menu" class="absolute top-[calc(100%+10px)] right-0 w-72 overflow-hidden rounded-2xl border border-line/10 bg-soft/95 p-2 shadow-2xl shadow-black/15 backdrop-blur-xl">
            <div class="border-b border-line/10 px-3 py-2.5"><div class="flex items-center justify-between gap-2"><p class="text-[10px] font-medium tracking-wider text-faint uppercase">当前账号</p><span v-if="isOperator" class="rounded-full px-2 py-0.5 text-[9px] font-bold" :class="isAdmin ? 'bg-violet-500/10 text-violet-500' : 'bg-sky-500/10 text-sky-500'">{{ isAdmin ? 'ADMIN' : 'SUPPORT' }}</span></div><p class="mt-1 truncate text-xs font-medium text-ink">{{ user?.email }}</p></div>
            <RouterLink to="/projects" role="menuitem" class="mt-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><FolderKanban class="h-4 w-4 text-brand1" />我的项目</RouterLink>
            <RouterLink to="/brand" role="menuitem" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><Palette class="h-4 w-4 text-brand2" />品牌套件</RouterLink>
            <RouterLink to="/usage" role="menuitem" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><Gauge class="h-4 w-4 text-brand2" />额度与用量</RouterLink>
            <button role="menuitem" class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-sub hover:bg-ink/5 hover:text-ink" @click="openOnboarding"><CircleHelp class="h-4 w-4 text-amber-500" />重新打开新手引导</button>
            <div v-if="isOperator" class="my-1 border-t border-line/10 pt-1">
              <RouterLink v-if="isAdmin" to="/admin" role="menuitem" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-violet-500 hover:bg-violet-500/[0.07]"><ShieldCheck class="h-4 w-4" />运营总览</RouterLink>
              <RouterLink v-if="hasPermission('templates.read')" to="/admin/templates" role="menuitem" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><LayoutTemplate class="h-4 w-4 text-violet-500" />模板运营</RouterLink>
              <RouterLink v-if="hasPermission('feedback.read')" to="/admin/quality" role="menuitem" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><MessageSquareText class="h-4 w-4 text-amber-500" />质量反馈</RouterLink>
              <RouterLink v-if="hasPermission('feature_flags.read')" to="/admin/feature-flags" role="menuitem" class="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><FlaskConical class="h-4 w-4 text-cyan-500" />功能开关</RouterLink>
            </div>
            <button role="menuitem" class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-500/[0.07]" @click="signOut"><LogOut class="h-4 w-4" />退出登录</button>
          </div></Transition>
        </div>

        <button v-else class="hidden items-center gap-1.5 rounded-full border border-line/12 bg-soft/60 px-3.5 py-2 text-sm font-medium text-sub transition-colors hover:border-brand1/30 hover:text-brand1 sm:flex" @click="showAuth"><UserRound class="h-4 w-4" />登录</button>
        <RouterLink to="/generator" class="bg-brand-gradient hidden rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-lg shadow-brand1/25 transition-transform hover:scale-[1.03] active:scale-95 md:inline-block">{{ isAuthenticated ? '新建网站' : '免费开始' }}</RouterLink>
        <button class="rounded-lg p-2 text-mut hover:bg-ink/5 hover:text-ink lg:hidden" aria-label="打开菜单" @click="open = !open"><X v-if="open" class="h-5 w-5" /><Menu v-else class="h-5 w-5" /></button>
      </div>
    </div>

    <nav v-if="open" class="border-t border-line/8 bg-app/95 px-4 py-4 shadow-xl backdrop-blur-xl lg:hidden"><div class="mx-auto flex max-w-7xl flex-col gap-1">
      <RouterLink v-for="link in NAV_LINKS" :key="link.to" :to="link.to" class="rounded-lg px-3 py-2.5 text-sm" :class="isActive(link.to) ? 'bg-brand1/12 font-semibold text-ink' : 'text-sub hover:bg-ink/5 hover:text-ink'">{{ link.label }}</RouterLink>
      <template v-if="isAuthenticated"><RouterLink to="/projects" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><FolderKanban class="h-4 w-4 text-brand1" />我的项目</RouterLink><RouterLink to="/brand" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><Palette class="h-4 w-4 text-brand2" />品牌套件</RouterLink><RouterLink to="/usage" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><Gauge class="h-4 w-4 text-brand2" />额度与用量</RouterLink><button class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-sub hover:bg-ink/5 hover:text-ink" @click="openOnboarding"><CircleHelp class="h-4 w-4 text-amber-500" />新手引导</button><template v-if="isOperator"><RouterLink v-if="isAdmin" to="/admin" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-violet-500 hover:bg-violet-500/[0.07]"><ShieldCheck class="h-4 w-4" />运营总览</RouterLink><RouterLink v-if="hasPermission('templates.read')" to="/admin/templates" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><LayoutTemplate class="h-4 w-4 text-violet-500" />模板运营</RouterLink><RouterLink v-if="hasPermission('feedback.read')" to="/admin/quality" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><MessageSquareText class="h-4 w-4 text-amber-500" />质量反馈</RouterLink><RouterLink v-if="hasPermission('feature_flags.read')" to="/admin/feature-flags" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-sub hover:bg-ink/5 hover:text-ink"><FlaskConical class="h-4 w-4 text-cyan-500" />功能开关</RouterLink></template></template>
      <button class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-sub hover:bg-ink/5 hover:text-ink" @click="((open = false), showModelSettings())"><Plug class="h-4 w-4" />模型设置<span v-if="activeProvider" class="h-2 w-2 rounded-full bg-emerald-400" /></button>
      <button v-if="!isAuthenticated" class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-sub hover:bg-ink/5 hover:text-ink" @click="((open = false), showAuth())"><UserRound class="h-4 w-4" />登录或创建账号</button><button v-else class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-red-500 hover:bg-red-500/[0.07]" @click="signOut"><LogOut class="h-4 w-4" />退出登录</button><RouterLink to="/generator" class="bg-brand-gradient mt-2 rounded-full px-5 py-2.5 text-center text-sm font-semibold text-white">{{ isAuthenticated ? '新建网站' : '免费开始' }}</RouterLink>
    </div></nav>
  </header>
</template>

<style scoped>
.menu-enter-active,.menu-leave-active{transition:opacity .15s ease,transform .15s ease}.menu-enter-from,.menu-leave-to{opacity:0;transform:translateY(-4px)}
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Command, Keyboard, Search, ShieldCheck } from 'lucide-vue-next'
import AppDialog from './ui/AppDialog.vue'

const open = ref(false)
const groups = [
  { title: '全局', icon: Command, items: [['Ctrl/⌘ + K', '打开命令面板'], ['?', '打开快捷键帮助'], ['Esc', '关闭最上层弹窗或抽屉']] },
  { title: '编辑器', icon: Keyboard, items: [['Ctrl/⌘ + S', '保存为新版本'], ['Ctrl/⌘ + Z', '撤销'], ['Ctrl/⌘ + Shift + Z', '重做'], ['1 / 2 / 3', '切换桌面、平板和手机预览']] },
  { title: '导航与检查', icon: Search, items: [['/', '聚焦当前页面搜索'], ['Alt + Q', '打开质量检查'], ['Alt + P', '打开页面预览']] },
]

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
  if (!typing && event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); open.value = true }
}
function show() { open.value = true }

onMounted(() => { window.addEventListener('keydown', onKey); window.addEventListener('siteforge:open-shortcuts', show) })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('siteforge:open-shortcuts', show) })
</script>

<template>
  <AppDialog :open="open" title="快捷键中心" description="核心流程均提供键盘路径；快捷键会避开输入框和可编辑文字。" size="lg" @close="open = false">
    <div class="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
      <section v-for="group in groups" :key="group.title" class="rounded-2xl border border-line/10 bg-soft/45 p-4">
        <div class="flex items-center gap-2"><component :is="group.icon" class="h-4 w-4 text-brand1" /><h3 class="text-xs font-semibold">{{ group.title }}</h3></div>
        <dl class="mt-4 space-y-3"><div v-for="item in group.items" :key="item[0]" class="flex items-center justify-between gap-3"><dt class="text-[10px] leading-4 text-mut">{{ item[1] }}</dt><dd><kbd class="whitespace-nowrap rounded-lg border border-line/10 bg-app/60 px-2 py-1 text-[9px] font-semibold text-sub shadow-sm">{{ item[0] }}</kbd></dd></div></dl>
      </section>
    </div>
    <div class="mx-5 mb-5 flex items-start gap-3 rounded-2xl border border-brand1/15 bg-brand1/[0.055] p-4 sm:mx-6 sm:mb-6"><ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-brand1" /><p class="text-xs leading-6 text-mut">对话框会锁定焦点，关闭后焦点返回触发按钮。启用“减少动态效果”时，页面会自动关闭非必要过渡动画。</p></div>
  </AppDialog>
</template>

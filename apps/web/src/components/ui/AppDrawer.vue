<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { isTopOverlay, registerOverlay, unregisterOverlay } from '../../composables/useOverlayStack'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  side?: 'left' | 'right' | 'bottom'
  width?: 'sm' | 'md' | 'lg'
  closeOnBackdrop?: boolean
}>(), { title: '', description: '', side: 'right', width: 'md', closeOnBackdrop: true })
const emit = defineEmits<{ (event: 'close'): void }>()
const panelRef = ref<HTMLElement>()
let overlayId = ''
let trigger: HTMLElement | null = null
const widthClass = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' }
function close() { emit('close') }
function focusables(): HTMLElement[] { return panelRef.value ? [...panelRef.value.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')] : [] }
function focusInitial() { const first = panelRef.value?.querySelector<HTMLElement>('[autofocus],[data-autofocus]') ?? focusables()[0]; if (first) first.focus(); else panelRef.value?.focus() }
function onKey(event: KeyboardEvent) {
  if (!props.open || !overlayId || !isTopOverlay(overlayId)) return
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab') return
  const items = focusables()
  if (!items.length) { event.preventDefault(); panelRef.value?.focus(); return }
  const first = items[0]
  const last = items.at(-1)!
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
watch(() => props.open, async (open) => {
  if (open) {
    trigger = document.activeElement as HTMLElement | null
    overlayId = registerOverlay(close, trigger)
    window.addEventListener('keydown', onKey)
    await nextTick()
    focusInitial()
  } else if (overlayId) {
    window.removeEventListener('keydown', onKey)
    unregisterOverlay(overlayId)
    overlayId = ''
  }
}, { immediate: true })
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); if (overlayId) unregisterOverlay(overlayId) })
</script>

<template>
  <Teleport to="body"><Transition name="sf-drawer"><div v-if="open" class="fixed inset-0 z-[235] bg-black/50 backdrop-blur-sm" @mousedown.self="closeOnBackdrop && close()"><aside ref="panelRef" role="dialog" aria-modal="true" :aria-label="title || '侧边面板'" tabindex="-1" class="absolute flex overflow-hidden border-line/10 bg-app shadow-2xl outline-none" :class="[side === 'bottom' ? 'inset-x-0 bottom-0 max-h-[88vh] flex-col rounded-t-3xl border-t' : `inset-y-0 ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} w-full flex-col ${widthClass[width]}`]"><div v-if="side === 'bottom'" class="mx-auto mt-2 h-1 w-12 rounded-full bg-line/15" /><header class="flex items-start gap-4 border-b border-line/10 px-5 py-4 sm:px-6"><div class="min-w-0 flex-1"><h2 class="text-base font-semibold">{{ title }}</h2><p v-if="description" class="mt-1 text-xs leading-5 text-mut">{{ description }}</p></div><button class="rounded-xl p-2 text-faint hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/50" aria-label="关闭" @click="close"><X class="h-4 w-4" /></button></header><div class="min-h-0 flex-1 overflow-y-auto"><slot /></div><footer v-if="$slots.footer" class="border-t border-line/10 bg-soft/45 px-5 py-4 sm:px-6"><slot name="footer" /></footer></aside></div></Transition></Teleport>
</template>

<style scoped>
.sf-drawer-enter-active,.sf-drawer-leave-active{transition:opacity .18s ease}.sf-drawer-enter-active aside,.sf-drawer-leave-active aside{transition:transform .24s cubic-bezier(.22,1,.36,1)}.sf-drawer-enter-from,.sf-drawer-leave-to{opacity:0}.sf-drawer-enter-from aside[class*="right-0"],.sf-drawer-leave-to aside[class*="right-0"]{transform:translateX(100%)}.sf-drawer-enter-from aside[class*="left-0"],.sf-drawer-leave-to aside[class*="left-0"]{transform:translateX(-100%)}.sf-drawer-enter-from aside[class*="bottom-0"],.sf-drawer-leave-to aside[class*="bottom-0"]{transform:translateY(100%)}@media(prefers-reduced-motion:reduce){.sf-drawer-enter-active,.sf-drawer-leave-active,.sf-drawer-enter-active aside,.sf-drawer-leave-active aside{transition:none}}
</style>

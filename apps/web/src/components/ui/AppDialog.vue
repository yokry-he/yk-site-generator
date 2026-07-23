<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { isTopOverlay, registerOverlay, unregisterOverlay } from '../../composables/useOverlayStack'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  showClose?: boolean
  labelledBy?: string
}>(), { title: '', description: '', size: 'md', closeOnBackdrop: true, closeOnEscape: true, showClose: true, labelledBy: '' })
const emit = defineEmits<{ (event: 'close'): void }>()
const panelRef = ref<HTMLElement>()
let overlayId = ''
let trigger: HTMLElement | null = null

const sizeClass = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-6xl', full: 'max-w-[calc(100vw-1rem)] h-[calc(100vh-1rem)]' }
function close() { emit('close') }
function focusables(): HTMLElement[] {
  if (!panelRef.value) return []
  return [...panelRef.value.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}
function focusInitial() {
  const autofocus = panelRef.value?.querySelector<HTMLElement>('[autofocus],[data-autofocus]')
  const first = autofocus ?? focusables()[0]
  if (first) first.focus()
  else panelRef.value?.focus()
}
function onKey(event: KeyboardEvent) {
  if (!props.open || !overlayId || !isTopOverlay(overlayId)) return
  if (event.key === 'Escape' && props.closeOnEscape) { event.preventDefault(); close(); return }
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
  <Teleport to="body"><Transition name="sf-dialog"><div v-if="open" class="fixed inset-0 z-[240] flex items-center justify-center bg-black/55 p-2 backdrop-blur-sm sm:p-4" @mousedown.self="closeOnBackdrop && close()"><section ref="panelRef" role="dialog" aria-modal="true" :aria-labelledby="labelledBy || (title ? 'sf-dialog-title' : undefined)" :aria-describedby="description ? 'sf-dialog-description' : undefined" tabindex="-1" class="flex max-h-[calc(100vh-1rem)] w-full flex-col overflow-hidden rounded-3xl border border-line/10 bg-app shadow-2xl outline-none" :class="sizeClass[size]"><header v-if="title || description || showClose" class="flex items-start gap-4 border-b border-line/10 px-5 py-4 sm:px-6"><div class="min-w-0 flex-1"><h2 v-if="title" id="sf-dialog-title" class="text-base font-semibold text-ink sm:text-lg">{{ title }}</h2><p v-if="description" id="sf-dialog-description" class="mt-1 text-xs leading-5 text-mut sm:text-sm">{{ description }}</p></div><button v-if="showClose" class="rounded-xl p-2 text-faint transition hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand1/50" aria-label="关闭" @click="close"><X class="h-4 w-4" /></button></header><div class="min-h-0 flex-1 overflow-y-auto"><slot /></div><footer v-if="$slots.footer" class="border-t border-line/10 bg-soft/45 px-5 py-4 sm:px-6"><slot name="footer" /></footer></section></div></Transition></Teleport>
</template>

<style scoped>
.sf-dialog-enter-active,.sf-dialog-leave-active{transition:opacity .16s ease}.sf-dialog-enter-active section,.sf-dialog-leave-active section{transition:transform .2s cubic-bezier(.22,1,.36,1),opacity .16s ease}.sf-dialog-enter-from,.sf-dialog-leave-to{opacity:0}.sf-dialog-enter-from section,.sf-dialog-leave-to section{transform:translateY(10px) scale(.985);opacity:0}@media(prefers-reduced-motion:reduce){.sf-dialog-enter-active,.sf-dialog-leave-active,.sf-dialog-enter-active section,.sf-dialog-leave-active section{transition:none}}
</style>

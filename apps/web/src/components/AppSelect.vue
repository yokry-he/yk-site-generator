<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectGroup {
  label?: string
  options: SelectOption[]
}

const props = defineProps<{
  modelValue: string
  groups: SelectGroup[]
  placeholder?: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const open = ref(false)
const rootRef = ref<HTMLElement>()

const currentLabel = computed(() => {
  for (const g of props.groups) {
    const hit = g.options.find((o) => o.value === props.modelValue)
    if (hit) return hit.label
  }
  return ''
})

function choose(v: string) {
  emit('update:modelValue', v)
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 rounded-lg border border-line/15 bg-app/60 px-3 py-2.5 text-sm text-ink outline-none transition-colors hover:border-line/25 focus:border-brand1/50"
      @click="open = !open"
    >
      <span class="flex min-w-0 items-center gap-2">
        <slot name="prefix" />
        <span class="truncate" :class="currentLabel ? 'text-ink' : 'text-faint'">
          {{ currentLabel || placeholder || '请选择' }}
        </span>
      </span>
      <ChevronDown class="h-4 w-4 shrink-0 text-faint transition-transform" :class="open && 'rotate-180'" />
    </button>

    <Transition name="drop">
      <div
        v-if="open"
        class="absolute z-50 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-line/12 bg-soft p-1.5 shadow-2xl"
      >
        <template v-for="(g, gi) in groups" :key="gi">
          <p v-if="g.label" class="px-2.5 pt-2 pb-1 text-xs text-faint">{{ g.label }}</p>
          <button
            v-for="o in g.options"
            :key="o.value"
            type="button"
            class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors"
            :class="o.value === modelValue ? 'bg-brand1/12 text-ink' : 'text-sub hover:bg-ink/5'"
            @click="choose(o.value)"
          >
            <span class="flex-1 truncate">{{ o.label }}</span>
            <Check v-if="o.value === modelValue" class="h-4 w-4 shrink-0 text-brand1" />
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drop-enter-active,
.drop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

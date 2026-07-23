<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AlertTriangle, ShieldCheck } from 'lucide-vue-next'
import AppDialog from './ui/AppDialog.vue'
import { useConfirmDialog } from '../composables/useConfirmDialog'

const { request, settle } = useConfirmDialog()
const verification = ref('')
const canConfirm = computed(() => !request.value?.verificationText || verification.value === request.value.verificationText)

watch(request, () => { verification.value = '' })
</script>

<template>
  <AppDialog
    :open="Boolean(request)"
    :title="request?.title"
    :description="request?.description"
    size="sm"
    :close-on-backdrop="false"
    @close="settle(false)"
  >
    <div v-if="request" class="p-5 sm:p-6">
      <div class="flex gap-3 rounded-2xl border p-4" :class="request.tone === 'danger' ? 'border-red-500/20 bg-red-500/[0.06]' : 'border-brand1/18 bg-brand1/[0.055]'">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl" :class="request.tone === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-brand1/10 text-brand1'">
          <AlertTriangle v-if="request.tone === 'danger'" class="h-5 w-5" />
          <ShieldCheck v-else class="h-5 w-5" />
        </span>
        <p class="text-xs leading-6 text-mut">{{ request.tone === 'danger' ? '此操作可能影响现有内容，请确认影响范围后继续。' : '确认后将立即执行此操作。' }}</p>
      </div>
      <label v-if="request.verificationText" class="mt-5 block text-xs font-semibold text-sub">
        {{ request.verificationLabel || `请输入「${request.verificationText}」确认` }}
        <input v-model="verification" autofocus class="mt-2 w-full rounded-xl border border-line/12 bg-soft/65 px-3 py-2.5 text-sm text-ink outline-none focus:border-brand1/45" autocomplete="off" />
      </label>
    </div>
    <template #footer>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button class="rounded-xl border border-line/12 px-4 py-2.5 text-sm font-medium text-sub hover:bg-ink/5 hover:text-ink" @click="settle(false)">{{ request?.cancelLabel }}</button>
        <button :disabled="!canConfirm" class="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" :class="request?.tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-gradient'" @click="settle(true)">{{ request?.confirmLabel }}</button>
      </div>
    </template>
  </AppDialog>
</template>

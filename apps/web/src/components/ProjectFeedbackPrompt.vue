<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Check,
  ChevronDown,
  Loader2,
  MessageSquareText,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import {
  getMyFeedback,
  submitQualityFeedback,
  type FeedbackCategory,
  type QualityFeedback,
} from '../lib/growth'

const route = useRoute()
const { isAuthenticated } = useAuth()
const toast = useToast()

const existing = ref<QualityFeedback | null>(null)
const sentiment = ref<QualityFeedback['sentiment'] | null>(null)
const categories = ref<FeedbackCategory[]>([])
const message = ref('')
const loading = ref(false)
const saving = ref(false)
const expanded = ref(false)
const dismissed = ref(false)

const categoryOptions: Array<{ id: FeedbackCategory; label: string }> = [
  { id: 'layout', label: '布局与层级' },
  { id: 'copy', label: '文案内容' },
  { id: 'colors', label: '配色风格' },
  { id: 'images', label: '图片素材' },
  { id: 'mobile', label: '移动端' },
  { id: 'interaction', label: '交互效果' },
  { id: 'missing', label: '内容缺失' },
  { id: 'error', label: '页面错误' },
  { id: 'other', label: '其他' },
]

const projectId = computed(() => route.name === 'project-detail' ? String(route.params.id ?? '') : '')
const versionId = computed(() => typeof route.query.version === 'string' ? route.query.version : '')
const contextKey = computed(() => projectId.value && versionId.value ? `${projectId.value}:${versionId.value}` : '')
const visible = computed(() =>
  Boolean(isAuthenticated.value && projectId.value && versionId.value && !dismissed.value),
)
const helperText = computed(() => {
  if (sentiment.value === 'positive') return '哪些方面做得好？可多选，也可以直接提交。'
  if (sentiment.value === 'negative') return '哪里最影响使用？这些信息会进入质量改进队列。'
  return '你的反馈会与当前项目版本关联，不会公开展示。'
})

function hydrate(feedback: QualityFeedback | null) {
  existing.value = feedback
  sentiment.value = feedback?.sentiment ?? null
  categories.value = feedback?.categories ? [...feedback.categories] : []
  message.value = feedback?.message ?? ''
  expanded.value = false
}

async function load() {
  if (!contextKey.value || !isAuthenticated.value) return
  dismissed.value = sessionStorage.getItem(`siteforge:feedback-dismissed:${contextKey.value}`) === '1'
  loading.value = true
  try {
    hydrate(await getMyFeedback(projectId.value, versionId.value))
  } catch {
    hydrate(null)
  } finally {
    loading.value = false
  }
}

function choose(value: QualityFeedback['sentiment']) {
  sentiment.value = value
  expanded.value = true
}

function toggleCategory(category: FeedbackCategory) {
  categories.value = categories.value.includes(category)
    ? categories.value.filter((item) => item !== category)
    : [...categories.value, category].slice(0, 5)
}

async function submit() {
  if (!sentiment.value || saving.value) return
  saving.value = true
  try {
    const feedback = await submitQualityFeedback({
      projectId: projectId.value,
      versionId: versionId.value,
      sentiment: sentiment.value,
      categories: categories.value,
      message: message.value.trim() || undefined,
      metadata: { source: 'project-workspace' },
    })
    hydrate(feedback)
    toast.success('感谢你的反馈', sentiment.value === 'negative' ? '问题已进入质量改进队列。' : '这会帮助我们识别有效的生成方向。')
  } catch (err) {
    toast.error('反馈提交失败', err instanceof Error ? err.message : '请稍后重试')
  } finally {
    saving.value = false
  }
}

function dismiss() {
  dismissed.value = true
  if (contextKey.value) sessionStorage.setItem(`siteforge:feedback-dismissed:${contextKey.value}`, '1')
}

function edit() {
  sentiment.value = existing.value?.sentiment ?? null
  categories.value = existing.value?.categories ? [...existing.value.categories] : []
  message.value = existing.value?.message ?? ''
  expanded.value = true
}

watch([contextKey, isAuthenticated], () => void load(), { immediate: true })
</script>

<template>
  <Teleport to="body">
    <Transition name="feedback">
      <aside
        v-if="visible"
        class="fixed right-3 bottom-3 z-[90] w-[calc(100vw-1.5rem)] max-w-md overflow-hidden rounded-2xl border border-line/12 bg-soft/95 text-ink shadow-2xl shadow-black/15 backdrop-blur-xl sm:right-5 sm:bottom-5"
        aria-live="polite"
      >
        <div v-if="loading" class="flex items-center gap-2 px-4 py-3 text-xs text-faint">
          <Loader2 class="h-3.5 w-3.5 animate-spin" />正在读取版本反馈
        </div>

        <template v-else-if="existing && !expanded">
          <div class="flex items-center gap-3 p-3.5">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="existing.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'">
              <ThumbsUp v-if="existing.sentiment === 'positive'" class="h-4 w-4" />
              <ThumbsDown v-else class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold">已记录这版的反馈</p>
              <p class="mt-1 truncate text-[10px] text-faint">{{ existing.sentiment === 'positive' ? '整体符合预期' : '仍有需要改进的地方' }} · {{ existing.status === 'open' ? '待处理' : existing.status }}</p>
            </div>
            <button class="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-brand1 hover:bg-brand1/8" @click="edit">修改</button>
            <button class="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭反馈提示" @click="dismiss"><X class="h-4 w-4" /></button>
          </div>
        </template>

        <template v-else>
          <header class="flex items-start gap-3 border-b border-line/10 px-4 py-3.5">
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand1/10 text-brand1"><MessageSquareText class="h-4.5 w-4.5" /></span>
            <div class="min-w-0 flex-1"><h2 class="text-sm font-semibold">这版网站符合预期吗？</h2><p class="mt-1 text-[10px] leading-4 text-faint">{{ helperText }}</p></div>
            <button class="rounded-lg p-1.5 text-faint hover:bg-ink/5 hover:text-ink" aria-label="关闭反馈提示" @click="dismiss"><X class="h-4 w-4" /></button>
          </header>

          <div class="p-4">
            <div class="grid grid-cols-2 gap-2" role="group" aria-label="选择反馈结果">
              <button class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-emerald-500/45" :class="sentiment === 'positive' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-line/10 bg-app/50 text-mut hover:text-ink'" :aria-pressed="sentiment === 'positive'" @click="choose('positive')"><ThumbsUp class="h-4 w-4" />符合预期</button>
              <button class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-amber-500/45" :class="sentiment === 'negative' ? 'border-amber-500/30 bg-amber-500/10 text-amber-600' : 'border-line/10 bg-app/50 text-mut hover:text-ink'" :aria-pressed="sentiment === 'negative'" @click="choose('negative')"><ThumbsDown class="h-4 w-4" />需要改进</button>
            </div>

            <Transition name="details">
              <div v-if="expanded && sentiment" class="mt-4">
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="item in categoryOptions" :key="item.id" class="rounded-full border px-2.5 py-1.5 text-[10px] transition focus-visible:ring-2 focus-visible:ring-brand1/40" :class="categories.includes(item.id) ? 'border-brand1/25 bg-brand1/10 font-semibold text-brand1' : 'border-line/10 bg-app/45 text-faint hover:text-ink'" :aria-pressed="categories.includes(item.id)" @click="toggleCategory(item.id)"><Check v-if="categories.includes(item.id)" class="mr-1 inline h-3 w-3" />{{ item.label }}</button>
                </div>
                <label class="mt-3 grid gap-1.5"><span class="flex items-center justify-between text-[10px] font-medium text-sub"><span>补充说明 <span class="font-normal text-faint">· 可选</span></span><span class="font-normal text-faint">{{ message.length }}/1000</span></span><textarea v-model="message" maxlength="1000" rows="3" :placeholder="sentiment === 'negative' ? '例如：手机端首屏按钮被遮挡，希望标题更简洁……' : '例如：信息层级很清晰，配色符合品牌预期……'" class="resize-none rounded-xl border border-line/10 bg-app/60 px-3 py-2.5 text-xs leading-5 text-ink outline-none focus:border-brand1/40 focus:ring-4 focus:ring-brand1/7" /></label>
                <div class="mt-3 flex items-center justify-between gap-3"><button class="flex items-center gap-1 text-[10px] text-faint hover:text-ink" @click="expanded = false">收起详情<ChevronDown class="h-3 w-3" /></button><button :disabled="saving" class="bg-brand-gradient flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-brand1/15 disabled:opacity-55" @click="submit"><Loader2 v-if="saving" class="h-3.5 w-3.5 animate-spin" /><Send v-else class="h-3.5 w-3.5" />提交反馈</button></div>
              </div>
            </Transition>
          </div>
        </template>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.feedback-enter-active,.feedback-leave-active{transition:opacity .2s ease,transform .22s cubic-bezier(.22,1,.36,1)}.feedback-enter-from,.feedback-leave-to{opacity:0;transform:translateY(12px) scale(.985)}.details-enter-active,.details-leave-active{transition:opacity .16s ease,transform .18s ease}.details-enter-from,.details-leave-to{opacity:0;transform:translateY(-4px)}
</style>

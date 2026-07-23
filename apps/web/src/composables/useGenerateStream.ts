import { computed, onBeforeUnmount, ref } from 'vue'
import {
  generateSite,
  GenerateHttpError,
  type GenerateRequest,
  type ParseSummary,
} from '../lib/generate'

export type GeneratePhase = 'idle' | 'connecting' | 'streaming' | 'parsing' | 'done' | 'error'

export interface GenerateError {
  code: string
  message: string
  /** 建议动作:打开模型设置(如 Key 无效) */
  action?: 'openModelSettings'
  /** 面向用户的建议文案 */
  hint: string
}

/** 服务端错误分类 → 中文提示与建议动作 */
const ERROR_HINTS: Record<string, { hint: string; action?: GenerateError['action'] }> = {
  PROVIDER_AUTH: { hint: '请检查模型设置中的 API Key 是否正确或已过期', action: 'openModelSettings' },
  PROVIDER_QUOTA: { hint: '请到对应厂商控制台查看额度并充值后重试' },
  QUOTA_EXCEEDED: { hint: '本月账号额度已用完,可在“额度与用量”中查看重置日期和明细' },
  PROVIDER_RATE_LIMIT: { hint: '请求过于频繁,稍等 1 分钟再试' },
  PROVIDER_NETWORK: { hint: '请检查网络连接,或确认模型服务的 Base URL 是否正确' },
  TIMEOUT: { hint: '生成超时,可以重试;复杂需求建议拆分描述' },
  BAD_REQUEST: { hint: '请求参数有误,请调整需求描述后重试' },
  INTERNAL: { hint: '服务器内部错误,请稍后重试' },
}

/** 生成阶段(映射到分步进度 UI 的 5 步) */
export const GENERATE_STAGES = ['已连接', '首 token 到达', '流式生成中', '解析产物', '完成'] as const

export function useGenerateStream() {
  const phase = ref<GeneratePhase>('idle')
  /** 0..4 对应 GENERATE_STAGES;-1 未开始 */
  const stageIndex = ref(-1)
  const tokenCount = ref(0)
  /** 已累计的原始模型输出 */
  const text = ref('')
  const error = ref<GenerateError | null>(null)
  const parseSummary = ref<ParseSummary | null>(null)
  /** 是否被用户主动停止 */
  const stopped = ref(false)

  let controller: AbortController | null = null

  const charCount = computed(() => text.value.length)
  const isActive = computed(
    () => phase.value === 'connecting' || phase.value === 'streaming' || phase.value === 'parsing',
  )

  function toError(code: string, message: string): GenerateError {
    const meta = ERROR_HINTS[code] ?? ERROR_HINTS.INTERNAL
    return { code, message, hint: meta.hint, action: meta.action }
  }

  async function start(req: GenerateRequest): Promise<void> {
    stop() // 防御:先停掉上一次
    controller = new AbortController()
    phase.value = 'connecting'
    stageIndex.value = -1
    tokenCount.value = 0
    text.value = ''
    error.value = null
    parseSummary.value = null
    stopped.value = false

    try {
      for await (const ev of generateSite(req, { signal: controller.signal })) {
        if (ev.type === 'token') {
          if (stageIndex.value < 0) stageIndex.value = 0
          if (stageIndex.value < 2) stageIndex.value = tokenCount.value === 0 ? 1 : 2
          else if (stageIndex.value === 1) stageIndex.value = 2
          phase.value = 'streaming'
          tokenCount.value += 1
          text.value += ev.delta
        } else if (ev.type === 'done') {
          phase.value = 'parsing'
          stageIndex.value = 3
          parseSummary.value = ev.parse
          phase.value = 'done'
          stageIndex.value = 4
        } else if (ev.type === 'error') {
          error.value = toError(ev.code, ev.message)
          phase.value = 'error'
        }
      }
      // 流自然结束但没有 done 事件(连接中断等)
      if (phase.value === 'streaming' || phase.value === 'connecting') {
        error.value = toError('PROVIDER_NETWORK', '生成过程中连接中断,未收到完成事件')
        phase.value = 'error'
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户主动停止:保留已生成内容,不视为错误
        stopped.value = true
        if (phase.value !== 'done') phase.value = text.value ? 'parsing' : 'idle'
        return
      }
      if (err instanceof GenerateHttpError) {
        error.value = toError(err.code, err.message)
      } else {
        error.value = toError('PROVIDER_NETWORK', err instanceof Error ? err.message : '网络请求失败')
      }
      phase.value = 'error'
    }
  }

  function stop() {
    controller?.abort()
    controller = null
  }

  function reset() {
    stop()
    phase.value = 'idle'
    stageIndex.value = -1
    tokenCount.value = 0
    text.value = ''
    error.value = null
    parseSummary.value = null
    stopped.value = false
  }

  onBeforeUnmount(stop)

  return {
    phase,
    stageIndex,
    tokenCount,
    charCount,
    text,
    error,
    parseSummary,
    stopped,
    isActive,
    start,
    stop,
    reset,
  }
}

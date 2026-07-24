import { computed, onBeforeUnmount, ref } from 'vue'
import {
  generateSite,
  GenerateHttpError,
  type GeneratePerformance,
  type GenerateRequest,
  type ParseSummary,
} from '../lib/generate'
import { createStreamTextBuffer } from '../lib/stream-text-buffer'

export type GeneratePhase = 'idle' | 'connecting' | 'streaming' | 'parsing' | 'done' | 'error'

export interface GenerateError {
  code: string
  message: string
  action?: 'openModelSettings'
  hint: string
}

const ERROR_HINTS: Record<string, { hint: string; action?: GenerateError['action'] }> = {
  PROVIDER_AUTH: { hint: '请检查模型设置中的 API Key 是否正确或已过期', action: 'openModelSettings' },
  PROVIDER_QUOTA: { hint: '请到对应厂商控制台查看额度并充值后重试' },
  QUOTA_EXCEEDED: { hint: '本月账号额度已用完，可在“额度与用量”中查看重置日期和明细' },
  PROVIDER_RATE_LIMIT: { hint: '请求过于频繁，稍等片刻再试；已生成内容会继续保留' },
  PROVIDER_NETWORK: { hint: '检查网络或 Base URL；可以基于已接收内容继续生成' },
  TIMEOUT: { hint: '生成超时，可保留部分结果继续；复杂需求建议拆分修改' },
  BAD_REQUEST: { hint: '请求参数有误，请调整需求描述后重试' },
  INTERNAL: { hint: '服务器内部错误，当前已接收内容不会丢失' },
}

export const GENERATE_STAGES = ['已连接', '首 token 到达', '流式生成中', '解析产物', '完成'] as const

export function useGenerateStream() {
  const phase = ref<GeneratePhase>('idle')
  const stageIndex = ref(-1)
  const tokenCount = ref(0)
  const text = ref('')
  const retainedPartial = ref('')
  const error = ref<GenerateError | null>(null)
  const parseSummary = ref<ParseSummary | null>(null)
  const performance = ref<GeneratePerformance | null>(null)
  const stopped = ref(false)
  const lastRequest = ref<GenerateRequest | null>(null)

  let controller: AbortController | null = null
  let startedAt = 0
  let firstTokenAt = 0

  const buffer = createStreamTextBuffer((delta, count) => {
    text.value += delta
    tokenCount.value += count
    performance.value = {
      ...(performance.value ?? { outputChars: 0 }),
      firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
      durationMs: startedAt ? Date.now() - startedAt : 0,
      outputChars: text.value.length,
    }
  })

  const charCount = computed(() => text.value.length)
  const isActive = computed(() => phase.value === 'connecting' || phase.value === 'streaming' || phase.value === 'parsing')
  const hasPartialOutput = computed(() => Boolean(text.value.trim() || retainedPartial.value.trim()))
  const canRetry = computed(() => Boolean(lastRequest.value) && !isActive.value)

  function toError(code: string, message: string): GenerateError {
    const meta = ERROR_HINTS[code] ?? ERROR_HINTS.INTERNAL
    return { code, message, hint: meta.hint, action: meta.action }
  }

  async function start(req: GenerateRequest): Promise<void> {
    controller?.abort()
    controller = new AbortController()
    buffer.clear()
    lastRequest.value = structuredClone(req)
    phase.value = 'connecting'
    stageIndex.value = -1
    tokenCount.value = 0
    text.value = ''
    error.value = null
    parseSummary.value = null
    performance.value = null
    stopped.value = false
    startedAt = Date.now()
    firstTokenAt = 0

    try {
      for await (const ev of generateSite(req, { signal: controller.signal })) {
        if (ev.type === 'token') {
          if (!firstTokenAt) firstTokenAt = Date.now()
          if (stageIndex.value < 0) stageIndex.value = 0
          if (stageIndex.value < 2) stageIndex.value = tokenCount.value === 0 ? 1 : 2
          phase.value = 'streaming'
          buffer.push(ev.delta)
        } else if (ev.type === 'done') {
          buffer.flush()
          phase.value = 'parsing'
          stageIndex.value = 3
          parseSummary.value = ev.parse
          performance.value = ev.performance ?? {
            firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
            durationMs: Date.now() - startedAt,
            outputChars: text.value.length,
          }
          retainedPartial.value = ''
          phase.value = 'done'
          stageIndex.value = 4
        } else if (ev.type === 'error') {
          buffer.flush()
          if (text.value.trim()) retainedPartial.value = text.value
          performance.value = {
            ...(performance.value ?? { outputChars: text.value.length }),
            firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
            durationMs: Date.now() - startedAt,
            outputChars: text.value.length,
          }
          error.value = toError(ev.code, ev.message)
          phase.value = 'error'
        }
      }
      if (phase.value === 'streaming' || phase.value === 'connecting') {
        buffer.flush()
        if (text.value.trim()) retainedPartial.value = text.value
        error.value = toError('PROVIDER_NETWORK', '生成过程中连接中断，未收到完成事件')
        phase.value = 'error'
      }
    } catch (err) {
      buffer.flush()
      if (err instanceof DOMException && err.name === 'AbortError') {
        stopped.value = true
        if (text.value.trim()) retainedPartial.value = text.value
        if (phase.value !== 'done') phase.value = text.value ? 'parsing' : 'idle'
        return
      }
      if (text.value.trim()) retainedPartial.value = text.value
      error.value = err instanceof GenerateHttpError
        ? toError(err.code, err.message)
        : toError('PROVIDER_NETWORK', err instanceof Error ? err.message : '网络请求失败')
      phase.value = 'error'
    }
  }

  async function retryLast(): Promise<void> {
    if (!lastRequest.value || isActive.value) return
    await start(structuredClone(lastRequest.value))
  }

  async function resumeFromPartial(instruction = '继续完成上次中断的页面，保留正确内容，补齐缺失部分并输出完整可运行产物'): Promise<void> {
    if (!lastRequest.value || isActive.value) return
    buffer.flush()
    const partial = retainedPartial.value || text.value
    if (!partial.trim()) return retryLast()
    const request = structuredClone(lastRequest.value)
    request.history = [
      ...(request.history ?? []),
      { instruction, artifact: partial, round: (request.history?.length ?? 0) + 1 },
    ]
    await start(request)
  }

  function stop() {
    buffer.flush()
    controller?.abort()
    controller = null
  }

  function reset(options: { keepPartial?: boolean } = {}) {
    controller?.abort()
    controller = null
    buffer.clear()
    if (!options.keepPartial) retainedPartial.value = ''
    phase.value = 'idle'
    stageIndex.value = -1
    tokenCount.value = 0
    text.value = ''
    error.value = null
    parseSummary.value = null
    performance.value = null
    stopped.value = false
  }

  onBeforeUnmount(() => {
    stop()
    buffer.dispose()
  })

  return {
    phase, stageIndex, tokenCount, charCount, text, retainedPartial, error, parseSummary,
    performance, stopped, lastRequest, isActive, hasPartialOutput, canRetry,
    start, retryLast, resumeFromPartial, stop, reset,
  }
}

/** 厂商适配层统一协议(SF-1-3) */

/** 统一内部流式事件:token 增量 / 错误 / 完成 */
export type StreamEvent =
  | { type: 'token'; delta: string }
  | { type: 'done' }

/** 错误分类:映射 HTTP 状态码与中文 message */
export type ProviderErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_QUOTA'
  | 'PROVIDER_NETWORK'
  | 'PROVIDER_RATE_LIMIT'
  | 'BAD_REQUEST'
  | 'INTERNAL'

export const PROVIDER_ERROR_META: Record<ProviderErrorCode, { status: number; message: string }> = {
  PROVIDER_AUTH: { status: 401, message: 'API Key 无效或已过期,请检查密钥' },
  PROVIDER_QUOTA: { status: 402, message: '账户额度不足,请充值后重试' },
  PROVIDER_NETWORK: { status: 502, message: '无法连接模型服务,请检查网络或 Base URL' },
  PROVIDER_RATE_LIMIT: { status: 429, message: '模型服务限流,请稍后重试' },
  BAD_REQUEST: { status: 400, message: '请求参数有误' },
  INTERNAL: { status: 500, message: '服务器内部错误' },
}

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message?: string,
  ) {
    super(message ?? PROVIDER_ERROR_META[code].message)
    this.name = 'ProviderError'
  }
}

/** 按上游 HTTP 状态码分类 */
export function classifyHttpError(status: number, detail?: string): ProviderError {
  const suffix = detail ? `:${detail.slice(0, 120)}` : ''
  if (status === 401 || status === 403) return new ProviderError('PROVIDER_AUTH', `${PROVIDER_ERROR_META.PROVIDER_AUTH.message}${suffix}`)
  if (status === 402) return new ProviderError('PROVIDER_QUOTA', `${PROVIDER_ERROR_META.PROVIDER_QUOTA.message}${suffix}`)
  if (status === 429) return new ProviderError('PROVIDER_RATE_LIMIT', `${PROVIDER_ERROR_META.PROVIDER_RATE_LIMIT.message}${suffix}`)
  if (status === 400) return new ProviderError('BAD_REQUEST', `模型服务拒绝了请求${suffix}`)
  return new ProviderError('PROVIDER_NETWORK', `模型服务异常(HTTP ${status})${suffix}`)
}

/** 网络/超时异常归类 */
export function classifyFetchError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return new ProviderError('PROVIDER_NETWORK', '连接模型服务超时,请稍后重试')
  }
  return new ProviderError(
    'PROVIDER_NETWORK',
    `网络请求失败:${err instanceof Error ? err.message.slice(0, 120) : String(err)}`,
  )
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** 统一的厂商调用入参;apiKey 只存在于请求生命周期,不落地、不打日志 */
export interface ProviderCallInput {
  model: string
  apiKey: string
  baseUrl?: string
  messages: ChatMessage[]
  maxTokens?: number
  /** 总超时(毫秒) */
  totalTimeoutMs: number
  /** 连接超时(毫秒) */
  connectTimeoutMs: number
}

/** 适配器签名:返回 token 增量异步迭代器,出错抛 ProviderError */
export type ProviderAdapter = (input: ProviderCallInput) => AsyncGenerator<StreamEvent, void, unknown>

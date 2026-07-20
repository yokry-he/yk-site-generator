import { classifyFetchError, ProviderError } from './types'

/**
 * 逐条解析 SSE 流:产出每个 data: 负载(字符串)。
 * 兼容 \n 与 \r\n 换行;忽略注释行与 event: 行(负载统一走 data)。
 * 读取中断(abort/超时/网络)统一归类为 ProviderError。
 */
export async function* readSsePayloads(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      if (signal?.aborted) throw new ProviderError('PROVIDER_NETWORK', '连接模型服务超时,请稍后重试')
      let done: boolean
      let value: Uint8Array | undefined
      try {
        ;({ done, value } = await reader.read())
      } catch (err) {
        throw classifyFetchError(err)
      }
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件以空行分隔;data 行可能多条,这里按行扫描
      let idx: number
      while ((idx = buffer.search(/\r?\n/)) >= 0) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx).replace(/^\r?\n/, '')
        if (line.startsWith('data:')) {
          yield line.slice(5).replace(/^ /, '')
        }
      }
    }
    if (buffer.startsWith('data:')) yield buffer.slice(5).replace(/^ /, '')
  } finally {
    reader.releaseLock()
  }
}

/** 从 fetch Response 中尽量提取上游错误详情(不打日志,仅用于错误映射) */
export async function extractUpstreamDetail(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text()
    try {
      const json = JSON.parse(text) as { error?: { message?: string }; message?: string }
      return json.error?.message ?? json.message ?? text.slice(0, 200)
    } catch {
      return text.slice(0, 200)
    }
  } catch {
    return undefined
  }
}

/**
 * 带双超时的 fetch:连接超时只守护「收到响应头」之前;
 * 一旦响应建立即解除,流式读取阶段只受总超时(totalSignal)约束。
 * (直接用 AbortSignal.timeout 组合进 fetch signal 会在连接超时到点后
 *  把正在消费的响应体一并掐断,这是流式场景的经典坑。)
 */
export async function fetchWithTimeouts(
  url: string,
  init: RequestInit,
  connectTimeoutMs: number,
  totalSignal: AbortSignal,
): Promise<Response> {
  const connect = new AbortController()
  const timer = setTimeout(() => connect.abort(), connectTimeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.any([totalSignal, connect.signal]),
    })
  } finally {
    clearTimeout(timer)
  }
}

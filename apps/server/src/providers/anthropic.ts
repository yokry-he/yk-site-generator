import { fetchWithTimeouts, readSsePayloads, extractUpstreamDetail } from './sse'
import {
  classifyFetchError,
  classifyHttpError,
  ProviderError,
  type ProviderCallInput,
  type StreamEvent,
} from './types'

export const ANTHROPIC_DEFAULT_BASE_URL = 'https://api.anthropic.com'

/**
 * Anthropic Messages 适配器:
 * POST {baseUrl}/v1/messages,stream: true,解析 content_block_delta 的 text。
 * system 单独传字段,messages 只含 user/assistant。
 */
export async function* anthropicStream(
  input: ProviderCallInput,
): AsyncGenerator<StreamEvent, void, unknown> {
  const base = (input.baseUrl ?? ANTHROPIC_DEFAULT_BASE_URL).replace(/\/$/, '')
  const system = input.messages.find((m) => m.role === 'system')?.content
  const messages = input.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const controller = new AbortController()
  const totalTimer = setTimeout(() => controller.abort(), input.totalTimeoutMs)
  try {
    let res: Response
    try {
      res = await fetchWithTimeouts(
        `${base}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': input.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: input.model,
            system,
            messages,
            stream: true,
            max_tokens: input.maxTokens ?? 4096,
          }),
        },
        input.connectTimeoutMs,
        controller.signal,
      )
    } catch (err) {
      throw classifyFetchError(err)
    }
    if (!res.ok) throw classifyHttpError(res.status, await extractUpstreamDetail(res))
    if (!res.body) throw new ProviderError('PROVIDER_NETWORK', '模型服务返回了空响应体')

    for await (const payload of readSsePayloads(res.body, controller.signal)) {
      let json: {
        type?: string
        delta?: { type?: string; text?: string }
        error?: { message?: string }
      }
      try {
        json = JSON.parse(payload)
      } catch {
        continue
      }
      if (json.type === 'error') {
        throw new ProviderError('PROVIDER_NETWORK', `模型服务中途出错:${json.error?.message ?? '未知'}`)
      }
      if (json.type === 'content_block_delta' && json.delta?.text) {
        yield { type: 'token', delta: json.delta.text }
      }
      if (json.type === 'message_stop') break
    }
    yield { type: 'done' }
  } finally {
    clearTimeout(totalTimer)
  }
}

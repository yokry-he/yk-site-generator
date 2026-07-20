import { fetchWithTimeouts, readSsePayloads, extractUpstreamDetail } from './sse'
import {
  classifyFetchError,
  classifyHttpError,
  ProviderError,
  type ProviderCallInput,
  type StreamEvent,
} from './types'

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com'

/**
 * Gemini 适配器:
 * POST {baseUrl}/v1beta/models/{model}:streamGenerateContent?alt=sse,
 * key 走查询参数,解析 candidates[0].content.parts[].text。
 */
export async function* geminiStream(
  input: ProviderCallInput,
): AsyncGenerator<StreamEvent, void, unknown> {
  const base = (input.baseUrl ?? GEMINI_DEFAULT_BASE_URL).replace(/\/$/, '')
  const system = input.messages.find((m) => m.role === 'system')?.content
  const userText = input.messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.content)
    .join('\n\n')

  const controller = new AbortController()
  const totalTimer = setTimeout(() => controller.abort(), input.totalTimeoutMs)
  try {
    let res: Response
    try {
      res = await fetchWithTimeouts(
        `${base}/v1beta/models/${encodeURIComponent(input.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(input.apiKey)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
            generationConfig: { maxOutputTokens: input.maxTokens ?? 4096 },
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
      let json: { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      try {
        json = JSON.parse(payload)
      } catch {
        continue
      }
      for (const part of json.candidates?.[0]?.content?.parts ?? []) {
        if (part.text) yield { type: 'token', delta: part.text }
      }
    }
    yield { type: 'done' }
  } finally {
    clearTimeout(totalTimer)
  }
}

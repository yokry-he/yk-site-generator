import { fetchWithTimeouts, readSsePayloads, extractUpstreamDetail } from './sse'
import {
  classifyFetchError,
  classifyHttpError,
  ProviderError,
  type ProviderCallInput,
  type StreamEvent,
} from './types'

/** OpenAI-compatible provider default base URLs. */
export const OPENAI_COMPATIBLE_DEFAULTS: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  kimi: 'https://api.moonshot.cn/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  openai: 'https://api.openai.com/v1',
}

function usesCompletionTokenBudget(model: string): boolean {
  const normalized = model.toLowerCase()
  return normalized.startsWith('gpt-5') || /^o\d(?:-|$)/u.test(normalized)
}

/**
 * Builds a Chat Completions request while avoiding parameters rejected by
 * current OpenAI reasoning models. Other compatible providers keep the widely
 * supported max_tokens + temperature shape.
 */
export function buildOpenAiCompatibleRequestBody(input: ProviderCallInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    stream: true,
  }

  if (usesCompletionTokenBudget(input.model)) {
    body.max_completion_tokens = input.maxTokens ?? 4096
  } else {
    body.max_tokens = input.maxTokens ?? 4096
    body.temperature = 0.7
  }

  return body
}

/**
 * OpenAI-compatible streaming adapter used by DeepSeek, Kimi, GLM, Qwen,
 * Doubao, and OpenAI itself.
 */
export async function* openaiCompatibleStream(
  input: ProviderCallInput,
  defaultBaseUrl: string,
): AsyncGenerator<StreamEvent, void, unknown> {
  const base = (input.baseUrl ?? defaultBaseUrl).replace(/\/$/, '')
  const controller = new AbortController()
  const totalTimer = setTimeout(() => controller.abort(), input.totalTimeoutMs)
  try {
    let res: Response
    try {
      res = await fetchWithTimeouts(
        `${base}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${input.apiKey}`,
          },
          body: JSON.stringify(buildOpenAiCompatibleRequestBody(input)),
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
      if (payload === '[DONE]') break
      let json: { choices?: { delta?: { content?: string } }[] }
      try {
        json = JSON.parse(payload)
      } catch {
        continue
      }
      const delta = json.choices?.[0]?.delta?.content
      if (delta) yield { type: 'token', delta }
    }
    yield { type: 'done' }
  } finally {
    clearTimeout(totalTimer)
  }
}

import { anthropicStream } from './anthropic'
import { geminiStream } from './gemini'
import { OPENAI_COMPATIBLE_DEFAULTS, openaiCompatibleStream } from './openai-compatible'
import { ProviderError, type ProviderCallInput, type StreamEvent } from './types'

export * from './types'
export { OPENAI_COMPATIBLE_DEFAULTS } from './openai-compatible'
export { ANTHROPIC_DEFAULT_BASE_URL } from './anthropic'
export { GEMINI_DEFAULT_BASE_URL } from './gemini'

export const SUPPORTED_PROVIDERS = [
  ...Object.keys(OPENAI_COMPATIBLE_DEFAULTS),
  'anthropic',
  'gemini',
] as const
export type ProviderId = (typeof SUPPORTED_PROVIDERS)[number]

/** 按厂商分发到对应适配器 */
export function streamFromProvider(
  provider: string,
  input: ProviderCallInput,
): AsyncGenerator<StreamEvent, void, unknown> {
  if (provider in OPENAI_COMPATIBLE_DEFAULTS) {
    return openaiCompatibleStream(input, OPENAI_COMPATIBLE_DEFAULTS[provider])
  }
  if (provider === 'anthropic') return anthropicStream(input)
  if (provider === 'gemini') return geminiStream(input)
  throw new ProviderError(
    'BAD_REQUEST',
    `不支持的厂商:${provider}。支持:${SUPPORTED_PROVIDERS.join(', ')}`,
  )
}

/** 轻量测连:OpenAI 兼容走 GET /models;Anthropic 走 /v1/models;Gemini 走 /v1beta/models */
export function testConnectionTarget(provider: string, baseUrl?: string): { url: string; headers: Record<string, string> } | null {
  if (provider in OPENAI_COMPATIBLE_DEFAULTS) {
    const base = (baseUrl ?? OPENAI_COMPATIBLE_DEFAULTS[provider]).replace(/\/$/, '')
    return { url: `${base}/models`, headers: {} }
  }
  if (provider === 'anthropic') {
    const base = (baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')
    return { url: `${base}/v1/models`, headers: { 'anthropic-version': '2023-06-01' } }
  }
  if (provider === 'gemini') {
    const base = (baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '')
    return { url: `${base}/v1beta/models`, headers: {} }
  }
  return null
}

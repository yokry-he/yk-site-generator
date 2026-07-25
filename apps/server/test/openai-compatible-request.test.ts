import { describe, expect, it } from 'vitest'
import { buildOpenAiCompatibleRequestBody } from '../src/providers/openai-compatible'
import type { ProviderCallInput } from '../src/providers/types'

function input(model: string): ProviderCallInput {
  return {
    model,
    apiKey: 'test-key',
    messages: [{ role: 'user', content: 'Build a polished product landing page.' }],
    maxTokens: 7200,
    connectTimeoutMs: 10_000,
    totalTimeoutMs: 180_000,
  }
}

describe('OpenAI-compatible request body', () => {
  it('uses max_completion_tokens and omits temperature for GPT-5 and o-series models', () => {
    expect(buildOpenAiCompatibleRequestBody(input('gpt-5.2'))).toMatchObject({
      model: 'gpt-5.2',
      stream: true,
      max_completion_tokens: 7200,
    })
    expect(buildOpenAiCompatibleRequestBody(input('gpt-5.2'))).not.toHaveProperty('max_tokens')
    expect(buildOpenAiCompatibleRequestBody(input('gpt-5.2'))).not.toHaveProperty('temperature')

    expect(buildOpenAiCompatibleRequestBody(input('o4-mini'))).toHaveProperty('max_completion_tokens', 7200)
  })

  it('keeps broadly compatible parameters for non-reasoning and third-party models', () => {
    expect(buildOpenAiCompatibleRequestBody(input('gpt-4.1'))).toMatchObject({
      max_tokens: 7200,
      temperature: 0.7,
    })
    expect(buildOpenAiCompatibleRequestBody(input('deepseek-v4-pro'))).toMatchObject({
      max_tokens: 7200,
      temperature: 0.7,
    })
  })
})

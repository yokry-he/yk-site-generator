import { describe, expect, it } from 'vitest'
import { MODEL_PROVIDERS, providerById } from '../src/data/providers'

describe('model provider catalog', () => {
  it('keeps unique provider, recommended, and default model identifiers', () => {
    expect(new Set(MODEL_PROVIDERS.map((provider) => provider.id)).size).toBe(MODEL_PROVIDERS.length)

    for (const provider of MODEL_PROVIDERS) {
      expect(provider.models).toContain(provider.defaultModel)
      expect(new Set(provider.models).size).toBe(provider.models.length)
      expect(provider.catalogUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
    }
  })

  it('recommends current flagship model families while retaining old aliases separately', () => {
    expect(providerById('openai')?.models).toContain('gpt-5.2')
    expect(providerById('gemini')?.defaultModel).toBe('gemini-3.6-flash')
    expect(providerById('deepseek')?.models).toEqual(['deepseek-v4-pro', 'deepseek-v4-flash'])
    expect(providerById('deepseek')?.legacyModels).toEqual(expect.arrayContaining(['deepseek-chat', 'deepseek-reasoner']))
    expect(providerById('qwen')?.models).toContain('qwen3.7-max')
    expect(providerById('glm')?.models).toContain('glm-5.2')
    expect(providerById('doubao')?.models).toContain('doubao-seed-2-0-pro-260215')
  })
})

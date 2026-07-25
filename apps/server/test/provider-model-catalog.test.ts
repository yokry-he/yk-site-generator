import { describe, expect, it } from 'vitest'
import { parseProviderModelCatalog, readProviderCatalog } from '../src/providers/model-catalog'

describe('provider model catalog', () => {
  it('keeps OpenAI text models and excludes media, realtime, embedding, and moderation models', () => {
    const models = parseProviderModelCatalog('openai', {
      data: [
        { id: 'gpt-5.2' },
        { id: 'gpt-5-mini' },
        { id: 'o4-mini' },
        { id: 'gpt-realtime' },
        { id: 'gpt-image-1' },
        { id: 'text-embedding-3-large' },
        { id: 'omni-moderation-latest' },
      ],
    })

    expect(models).toEqual(['gpt-5.2', 'gpt-5-mini', 'o4-mini'])
  })

  it('normalizes Gemini model names and requires a text generation method when declared', () => {
    const models = parseProviderModelCatalog('gemini', {
      models: [
        { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embedding-2', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['streamGenerateContent'] },
      ],
    })

    expect(models).toEqual(['gemini-3.6-flash', 'gemini-3.5-flash-lite'])
  })

  it('deduplicates compatible provider model IDs and ignores malformed entries', () => {
    const models = parseProviderModelCatalog('deepseek', {
      data: [
        { id: 'deepseek-v4-pro' },
        { id: 'deepseek-v4-pro' },
        { model: 'deepseek-v4-flash' },
        { id: 'not-a-deepseek-model' },
        { id: 'bad model id' },
      ],
    })

    expect(models).toEqual(['deepseek-v4-pro', 'deepseek-v4-flash'])
  })

  it('parses a bounded response body and rejects an oversized declared catalog', async () => {
    const response = new Response(JSON.stringify({ data: [{ id: 'glm-5.2' }] }), {
      headers: { 'content-type': 'application/json' },
    })
    await expect(readProviderCatalog(response)).resolves.toEqual({ data: [{ id: 'glm-5.2' }] })

    const oversized = new Response('{}', { headers: { 'content-length': String(512 * 1024 + 1) } })
    await expect(readProviderCatalog(oversized)).resolves.toBeNull()
  })
})

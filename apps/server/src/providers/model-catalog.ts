const MAX_CATALOG_BYTES = 512 * 1024
const MAX_MODEL_COUNT = 120
const MAX_MODEL_ID_LENGTH = 160

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function catalogEntries(payload: unknown): unknown[] {
  const record = asRecord(payload)
  if (!record) return []
  if (Array.isArray(record.data)) return record.data
  if (Array.isArray(record.models)) return record.models
  if (Array.isArray(record.items)) return record.items
  return []
}

function modelIdOf(value: unknown): string | null {
  if (typeof value === 'string') return value
  const record = asRecord(value)
  if (!record) return null
  const candidate = [record.id, record.name, record.model, record.model_id].find((item) => typeof item === 'string')
  if (typeof candidate !== 'string') return null
  return candidate.startsWith('models/') ? candidate.slice('models/'.length) : candidate
}

function supportsGeminiTextGeneration(value: unknown): boolean {
  const record = asRecord(value)
  const methods = record?.supportedGenerationMethods
  if (!Array.isArray(methods)) return true
  return methods.some((method) => method === 'generateContent' || method === 'streamGenerateContent')
}

function isTextGenerationModel(provider: string, id: string, entry: unknown): boolean {
  const normalized = id.toLowerCase()
  if (!normalized || normalized.length > MAX_MODEL_ID_LENGTH || /\s/u.test(normalized)) return false

  if (provider === 'openai') {
    if (/(audio|realtime|transcribe|tts|image|embedding|moderation|search|sora|whisper|dall-e)/u.test(normalized)) return false
    return normalized.startsWith('gpt-') || /^o\d(?:-|$)/u.test(normalized)
  }
  if (provider === 'anthropic') return normalized.startsWith('claude-')
  if (provider === 'gemini') return normalized.startsWith('gemini-') && supportsGeminiTextGeneration(entry)
  if (provider === 'deepseek') return normalized.startsWith('deepseek-')
  if (provider === 'kimi') return normalized.startsWith('kimi-') || normalized.startsWith('moonshot-')
  if (provider === 'glm') return normalized.startsWith('glm-')
  if (provider === 'qwen') return normalized.startsWith('qwen') || normalized.startsWith('qwq-')
  if (provider === 'doubao') return normalized.startsWith('doubao-') || normalized.startsWith('ep-')
  return false
}

/**
 * Normalizes the different /models response shapes used by supported providers.
 * Only chat/text-generation models are returned; embeddings, media, realtime and
 * moderation models are excluded from the UI catalog.
 */
export function parseProviderModelCatalog(provider: string, payload: unknown): string[] {
  const models: string[] = []
  const seen = new Set<string>()

  for (const entry of catalogEntries(payload)) {
    const id = modelIdOf(entry)?.trim()
    if (!id || seen.has(id) || !isTextGenerationModel(provider, id, entry)) continue
    seen.add(id)
    models.push(id)
    if (models.length >= MAX_MODEL_COUNT) break
  }

  return models
}

/** Reads a provider model catalog without allowing an unbounded response body. */
export async function readProviderCatalog(response: Response): Promise<unknown | null> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CATALOG_BYTES) return null
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > MAX_CATALOG_BYTES) {
        await reader.cancel('provider model catalog exceeds size limit')
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    return null
  }
}

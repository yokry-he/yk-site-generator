import { Hono } from 'hono'
import { z } from 'zod'
import { connectTimeoutMs } from '../lib/config'
import { validateProviderBaseUrlForRequest } from '../lib/provider-url-policy'
import { takeToken } from '../lib/rate-limit'
import {
  classifyFetchError,
  classifyHttpError,
  SUPPORTED_PROVIDERS,
  testConnectionTarget,
} from '../providers'
import { parseProviderModelCatalog, readProviderCatalog } from '../providers/model-catalog'
import { errorBody } from '../types'

const testSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  /** The selected model is echoed back for availability diagnostics. */
  model: z.string().trim().min(1).max(160).optional(),
})

/**
 * POST /api/providers/test —— test a real provider connection and synchronize
 * the text-generation models visible to the supplied API key.
 *
 * The API key lives only for this request. It is never persisted or logged.
 */
const providers = new Hono()

providers.post('/test', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!takeToken(ip)) {
    return c.json(errorBody('PROVIDER_RATE_LIMIT', '请求过于频繁,请每分钟不超过 10 次'), 429)
  }

  let body: z.infer<typeof testSchema>
  try {
    body = testSchema.parse(await c.req.json())
    body.baseUrl = await validateProviderBaseUrlForRequest(body.baseUrl)
  } catch (err) {
    const msg =
      err instanceof z.ZodError
        ? err.issues.map((i) => i.message).join(';')
        : err instanceof Error
          ? err.message
          : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', `参数校验失败:${msg}`), 400)
  }

  const target = testConnectionTarget(body.provider, body.baseUrl)
  if (!target) {
    return c.json(errorBody('BAD_REQUEST', `不支持的厂商:${body.provider}`), 400)
  }

  // Gemini authenticates its models endpoint through a query parameter.
  const url =
    body.provider === 'gemini'
      ? `${target.url}?key=${encodeURIComponent(body.apiKey)}`
      : target.url
  const headers: Record<string, string> = { ...target.headers }
  if (body.provider === 'anthropic') headers['x-api-key'] = body.apiKey
  else if (body.provider !== 'gemini') headers.authorization = `Bearer ${body.apiKey}`

  const started = Date.now()
  try {
    const res = await fetch(url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(connectTimeoutMs()),
    })
    const latencyMs = Date.now() - started
    if (!res.ok) {
      const err = classifyHttpError(res.status)
      return c.json({ ok: false, latencyMs, error: { code: err.code, message: err.message } })
    }

    const payload = await readProviderCatalog(res)
    const models = parseProviderModelCatalog(body.provider, payload)
    const selectedModelAvailable = body.model && models.length > 0
      ? models.includes(body.model)
      : undefined

    return c.json({
      ok: true,
      latencyMs,
      models,
      catalogSource: models.length ? 'provider' : 'unavailable',
      selectedModelAvailable,
    })
  } catch (err) {
    const latencyMs = Date.now() - started
    const classified = classifyFetchError(err)
    return c.json({
      ok: false,
      latencyMs,
      error: { code: classified.code, message: classified.message },
    })
  }
})

export default providers

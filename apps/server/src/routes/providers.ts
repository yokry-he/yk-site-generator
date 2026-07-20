import { Hono } from 'hono'
import { z } from 'zod'
import { connectTimeoutMs } from '../lib/config'
import { takeToken } from '../lib/rate-limit'
import {
  classifyFetchError,
  classifyHttpError,
  SUPPORTED_PROVIDERS,
  testConnectionTarget,
} from '../providers'
import { errorBody } from '../types'

const testSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  /** 保留字段:未来可用来探测指定模型;当前测连用 models list,与模型无关 */
  model: z.string().optional(),
})

/**
 * POST /api/providers/test —— 真实测试连接(SF-1-4)
 * 发最轻量请求(models list),返回 { ok, latencyMs, error? }。
 * apiKey 只在请求生命周期内存活:不落地、不打日志。
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
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map((i) => i.message).join(';') : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', `参数校验失败:${msg}`), 400)
  }

  const target = testConnectionTarget(body.provider, body.baseUrl)
  if (!target) {
    return c.json(errorBody('BAD_REQUEST', `不支持的厂商:${body.provider}`), 400)
  }

  // Gemini 的 key 走查询参数
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
      signal: AbortSignal.timeout(connectTimeoutMs()),
    })
    const latencyMs = Date.now() - started
    if (!res.ok) {
      const err = classifyHttpError(res.status)
      return c.json({ ok: false, latencyMs, error: { code: err.code, message: err.message } })
    }
    return c.json({ ok: true, latencyMs })
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

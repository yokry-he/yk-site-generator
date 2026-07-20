import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { resetRateLimit } from '../src/lib/rate-limit'

const app = createApp()

const body = { provider: 'deepseek', apiKey: 'test-key-not-real' }

beforeEach(() => resetRateLimit())
afterEach(() => vi.unstubAllGlobals())

describe('POST /api/providers/test', () => {
  it('连接成功:{ ok: true, latencyMs }', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    )
    const res = await app.request('/api/providers/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(typeof json.latencyMs).toBe('number')
    // DeepSeek 走 OpenAI 兼容 /models,带 Bearer
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(String(url)).toBe('https://api.deepseek.com/models')
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer test-key-not-real' })
  })

  it('Key 错误(401):{ ok: false, error.code = PROVIDER_AUTH }', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const res = await app.request('/api/providers/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('PROVIDER_AUTH')
  })

  it('限流(429 上游):PROVIDER_RATE_LIMIT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    const res = await app.request('/api/providers/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect((await res.json()).error.code).toBe('PROVIDER_RATE_LIMIT')
  })

  it('网络异常:PROVIDER_NETWORK', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))))
    const res = await app.request('/api/providers/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.error.code).toBe('PROVIDER_NETWORK')
  })

  it('参数缺失返回 400', async () => {
    const res = await app.request('/api/providers/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'deepseek' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('BAD_REQUEST')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app'
import { resetRateLimit } from '../src/lib/rate-limit'

const app = createApp()

const validBody = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  apiKey: 'test-key-not-real',
  siteType: 'personal',
  requirement: '深色极简的个人主页',
  mode: 'balanced',
}

/** 用 SSE 文本构造一个 Response */
function sseResponse(lines: string[]): Response {
  const text = lines.map((l) => `data: ${l}\n\n`).join('')
  return new Response(new TextEncoder().encode(text), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function openaiChunk(delta: string): string {
  return JSON.stringify({ choices: [{ delta: { content: delta } }] })
}

interface SseEvent {
  event: string
  data: string
}

/** 读取 SSE 响应全文并解析为事件序列 */
async function readEvents(res: Response): Promise<SseEvent[]> {
  const text = await res.text()
  const events: SseEvent[] = []
  for (const block of text.split('\n\n')) {
    const event = block.match(/^event: (.+)$/m)?.[1]
    const data = block.match(/^data: (.+)$/m)?.[1]
    if (event && data) events.push({ event, data })
  }
  return events
}

beforeEach(() => {
  resetRateLimit()
  process.env.RATE_LIMIT_PER_MIN = '10'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.RATE_LIMIT_PER_MIN
  delete process.env.PROVIDER_CONNECT_TIMEOUT_MS
})

describe('POST /api/generate', () => {
  it('正常流:token 事件序列 + done 含解析摘要(parse.ok=true)', async () => {
    const html = '<!DOCTYPE html><html><head><title>t</title></head><body><h1>hi</h1></body></html>'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          openaiChunk('```html\n'),
          openaiChunk(html),
          openaiChunk('\n```'),
          '[DONE]',
        ]),
      ),
    )
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(200)
    const events = await readEvents(res)
    const kinds = events.map((e) => e.event)
    expect(kinds.filter((k) => k === 'token').length).toBe(3)
    expect(kinds[kinds.length - 1]).toBe('done')
    const done = JSON.parse(events[events.length - 1].data)
    expect(done.parse.ok).toBe(true)
    expect(done.parse.fileCount).toBe(1)
    expect(done.parse.entry).toBe('index.html')
    expect(done.performance.generationMode).toBe('balanced')
    expect(done.performance.maxTokens).toBe(4600)
    expect(done.performance.outputChars).toBeGreaterThan(0)
    expect(typeof done.performance.durationMs).toBe('number')
  })

  it('精致成品模式使用更高预算并注入质量自检提示', async () => {
    const html = '<!DOCTYPE html><html><head></head><body>quality</body></html>'
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => sseResponse([openaiChunk('```html\n' + html + '\n```'), '[DONE]']))
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, mode: 'quality' }),
    })
    const events = await readEvents(res)
    expect(events.some((event) => event.event === 'done')).toBe(true)
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody.max_tokens).toBe(7200)
    expect(sentBody.messages[0].content).toContain('当前生成策略：精致成品')
    expect(sentBody.messages[0].content).toContain('静默自检')
  })

  it('认证失败(401):error 事件,PROVIDER_AUTH', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid key' } }), { status: 401 })),
    )
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const events = await readEvents(res)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error')
    const err = JSON.parse(events[0].data)
    expect(err.code).toBe('PROVIDER_AUTH')
  })

  it('连接超时:error 事件,PROVIDER_NETWORK', async () => {
    process.env.PROVIDER_CONNECT_TIMEOUT_MS = '50'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted', 'AbortError')),
            )
          }),
      ),
    )
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const events = await readEvents(res)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('error')
    expect(JSON.parse(events[0].data).code).toBe('PROVIDER_NETWORK')
  })

  it('限流:超出 RATE_LIMIT_PER_MIN 返回 429 与统一错误体', async () => {
    process.env.RATE_LIMIT_PER_MIN = '2'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([openaiChunk('x'), '[DONE]'])),
    )
    const mk = () =>
      app.request('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
        body: JSON.stringify(validBody),
      })
    await (await mk()).text()
    await (await mk()).text()
    const third = await mk()
    expect(third.status).toBe(429)
    const body = await third.json()
    expect(body.error.code).toBe('PROVIDER_RATE_LIMIT')
  })

  it('解析失败(输出为纯散文):done 事件 parse.ok=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([openaiChunk('抱歉,我无法完成这个请求。'), '[DONE]'])),
    )
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const events = await readEvents(res)
    const done = events.find((e) => e.event === 'done')
    expect(done).toBeDefined()
    expect(JSON.parse(done!.data).parse.ok).toBe(false)
  })

  it('慢速流不被连接超时掐断:响应建立后只受总超时约束', async () => {
    process.env.PROVIDER_CONNECT_TIMEOUT_MS = '50' // 连接超时 50ms
    const html = '<!DOCTYPE html><html><head></head><body>ok</body></html>'
    const chunks = [openaiChunk('```html\n'), openaiChunk(html), openaiChunk('\n```'), '[DONE]']
    // 每片间隔 120ms(远超连接超时),整个流 ~500ms
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        for (const c of chunks) {
          await new Promise((r) => setTimeout(r, 120))
          controller.enqueue(enc.encode(`data: ${c}\n\n`))
        }
        controller.close()
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, { status: 200 })))
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    const events = await readEvents(res)
    expect(events.some((e) => e.event === 'error')).toBe(false)
    const done = events.find((e) => e.event === 'done')
    expect(done).toBeDefined()
    expect(JSON.parse(done!.data).parse.ok).toBe(true)
  })

  it('history 非空走迭代提示词:请求体含产物与修改指令', async () => {
    const artifact = '<!DOCTYPE html><html><body><h1>旧版</h1></body></html>'
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      sseResponse([openaiChunk('```html\n' + artifact + '\n```'), '[DONE]']),
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...validBody,
        history: [{ instruction: '把配色改成暖色系', artifact, round: 2 }],
      }),
    })
    const events = await readEvents(res)
    expect(events.some((e) => e.event === 'done')).toBe(true)
    // 验证发往厂商的 messages 是迭代提示词
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    const userMsg = sentBody.messages.find((m: { role: string }) => m.role === 'user')
    expect(userMsg.content).toContain('【当前产物(第 1 轮)】')
    expect(userMsg.content).toContain(artifact)
    expect(userMsg.content).toContain('【修改指令(第 2 轮)】')
    expect(userMsg.content).toContain('把配色改成暖色系')
  })

  it('请求体超过 2MB 返回 400', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(2 * 1024 * 1024 + 1),
      },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('2MB')
  })

  it('参数校验失败返回 400 BAD_REQUEST', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, apiKey: '' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('BAD_REQUEST')
  })

  it('未知生成策略返回 400', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, mode: 'ultra' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('BAD_REQUEST')
  })

  it('未知站点类型返回 400', async () => {
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, siteType: 'no-such-type' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.message).toContain('未知站点类型')
  })
})

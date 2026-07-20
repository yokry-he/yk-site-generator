import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  extractPartialHtml,
  generateSite,
  GenerateHttpError,
  readSseEventStream,
  type GenerateEvent,
} from '../src/lib/generate'

/** 把字符串数组编码成分片字节流(可指定分片边界,模拟不完整 SSE 行) */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c))
      controller.close()
    },
  })
}

function sseText(events: { event: string; data: string }[]): string {
  return events.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join('')
}

afterEach(() => vi.unstubAllGlobals())

describe('readSseEventStream', () => {
  it('解析标准事件序列', async () => {
    const events: { event: string; data: string }[] = []
    for await (const ev of readSseEventStream(
      streamOf([sseText([
        { event: 'token', data: '{"delta":"a"}' },
        { event: 'token', data: '{"delta":"b"}' },
      ])]),
    )) {
      events.push(ev)
    }
    expect(events).toEqual([
      { event: 'token', data: '{"delta":"a"}' },
      { event: 'token', data: '{"delta":"b"}' },
    ])
  })

  it('跨分片的事件能正确拼合;畸形行与残缺事件被跳过', async () => {
    const chunks = [
      'event: token\nda', // 在 data 行中间切断
      'ta: {"delta":"x"}\n\n',
      ': 这是注释行\n', // 注释行,忽略
      'event: ghost\n\n', // 无 data,应被跳过
      'data: 没有event\n\n', // 无 event,应被跳过
      'event: token\ndata: {"delta":"y"}\n\n',
    ]
    const events: { event: string; data: string }[] = []
    for await (const ev of readSseEventStream(streamOf(chunks))) events.push(ev)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ event: 'token', data: '{"delta":"x"}' })
    expect(events[1]).toEqual({ event: 'token', data: '{"delta":"y"}' })
  })
})

describe('generateSite', () => {
  const req = {
    provider: 'deepseek',
    model: 'deepseek-chat',
    apiKey: 'test-key',
    siteType: 'personal',
    requirement: '测试',
  }

  function mockFetch(body: string, status = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        status === 200
          ? new Response(streamOf([body]), { status })
          : new Response(body, { status }),
      ),
    )
  }

  it('正常 token 序列 → done', async () => {
    mockFetch(
      sseText([
        { event: 'token', data: '{"delta":"<html>"}' },
        { event: 'token', data: '{"delta":"</html>"}' },
        { event: 'done', data: '{"parse":{"ok":true,"fileCount":1,"entry":"index.html","warnings":[]}}' },
      ]),
    )
    const events: GenerateEvent[] = []
    for await (const ev of generateSite(req)) events.push(ev)
    expect(events).toHaveLength(3)
    expect(events[0]).toEqual({ type: 'token', delta: '<html>' })
    expect(events[2]).toMatchObject({ type: 'done', parse: { ok: true, fileCount: 1 } })
  })

  it('中途 error 事件:透传 code 与 message,且后续事件不再依赖', async () => {
    mockFetch(
      sseText([
        { event: 'token', data: '{"delta":"x"}' },
        { event: 'error', data: '{"code":"PROVIDER_AUTH","message":"Key 无效"}' },
      ]),
    )
    const events: GenerateEvent[] = []
    for await (const ev of generateSite(req)) events.push(ev)
    expect(events[1]).toEqual({ type: 'error', code: 'PROVIDER_AUTH', message: 'Key 无效' })
  })

  it('畸形 data JSON 被跳过,不中断流', async () => {
    mockFetch(
      sseText([
        { event: 'token', data: '这不是JSON' },
        { event: 'token', data: '{"delta":"ok"}' },
        { event: 'done', data: '{"parse":{"ok":false,"fileCount":0,"warnings":[]}}' },
      ]),
    )
    const events: GenerateEvent[] = []
    for await (const ev of generateSite(req)) events.push(ev)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'token', delta: 'ok' })
  })

  it('HTTP 错误:抛出 GenerateHttpError,解析统一错误体', async () => {
    mockFetch('{"error":{"code":"PROVIDER_RATE_LIMIT","message":"请求过于频繁"}}', 429)
    await expect(async () => {
      for await (const _ of generateSite(req)) void _
    }).rejects.toMatchObject({
      name: 'GenerateHttpError',
      status: 429,
      code: 'PROVIDER_RATE_LIMIT',
    })
  })

  it('abort:中断后流停止', async () => {
    const controller = new AbortController()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_url: string, init?: RequestInit) =>
          new Response(
            new ReadableStream<Uint8Array>({
              async start(c) {
                const enc = new TextEncoder()
                for (let i = 0; i < 100; i++) {
                  if (init?.signal?.aborted) break
                  await new Promise((r) => setTimeout(r, 10))
                  c.enqueue(enc.encode(`event: token\ndata: {"delta":"${i}"}\n\n`))
                }
                c.close()
              },
            }),
            { status: 200 },
          ),
      ),
    )
    const events: GenerateEvent[] = []
    const consume = (async () => {
      for await (const ev of generateSite(req, { signal: controller.signal })) events.push(ev)
    })()
    setTimeout(() => controller.abort(), 55)
    await consume.catch(() => {})
    expect(events.length).toBeLessThan(100)
    expect(events.length).toBeGreaterThan(0)
  })
})

describe('extractPartialHtml', () => {
  it('从围栏+散文混合输出中提取 HTML', () => {
    const text = '前言\n```html path="index.html"\n<!DOCTYPE html>\n<html><body>hi</body></html>\n```'
    expect(extractPartialHtml(text)).toBe('<!DOCTYPE html>\n<html><body>hi</body></html>')
  })

  it('截断的未闭合内容原样返回(浏览器容错)', () => {
    const text = '```html\n<html><body><h1>半截'
    expect(extractPartialHtml(text)).toBe('<html><body><h1>半截')
  })

  it('找不到 HTML 起点返回 null', () => {
    expect(extractPartialHtml('{"files": []} 只有清单')).toBeNull()
  })
})

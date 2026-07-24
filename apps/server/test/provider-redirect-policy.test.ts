import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeouts } from '../src/providers/sse'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('模型厂商重定向策略', () => {
  it('流式请求即使调用方传入 follow 也强制使用 redirect:error', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('ok'),
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchWithTimeouts(
      'https://api.example.com/v1/chat/completions',
      { method: 'POST', redirect: 'follow' },
      1_000,
      new AbortController().signal,
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
    })
  })
})

/**
 * /api/generate SSE 客户端(SF-1-5)。
 * 框架无关,便于单测:fetch + ReadableStream 手动解析(POST 不能用 EventSource)。
 */

export interface GenerateRequest {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  siteType: string
  requirement: string
  history?: { artifactHtml?: string; feedback: string }[]
  maxTokens?: number
}

export interface ParseSummary {
  ok: boolean
  fileCount: number
  entry?: string
  warnings: string[]
}

export type GenerateEvent =
  | { type: 'token'; delta: string }
  | { type: 'done'; parse: ParseSummary }
  | { type: 'error'; code: string; message: string }

/** HTTP 层错误(4xx/5xx JSON 错误体),带服务端错误分类 code */
export class GenerateHttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'GenerateHttpError'
    this.status = status
    this.code = code
  }
}

/** 逐条解析 SSE 字节流为 { event, data } 对;畸形行/残缺事件容错跳过 */
export async function* readSseEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }, void, unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // 事件以空行分隔
      let sep: number
      while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '')
        let event: string | undefined
        const dataLines: string[] = []
        for (const line of rawEvent.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).replace(/^ /, '')
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
          // 其他行(注释/残缺)忽略
        }
        if (event && dataLines.length > 0) {
          yield { event, data: dataLines.join('\n') }
        }
        // 缺 event 或 data 的残缺事件:跳过
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * 发起生成请求并产出统一事件流。
 * - HTTP 非 200:解析统一错误体,抛 GenerateHttpError
 * - 事件 JSON 畸形:跳过该行,不中断流
 * - 中断:外部 AbortController 触发时 read() 抛 AbortError,由调用方处理
 */
export async function* generateSite(
  req: GenerateRequest,
  options: { signal?: AbortSignal; endpoint?: string } = {},
): AsyncGenerator<GenerateEvent, void, unknown> {
  const res = await fetch(options.endpoint ?? '/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal: options.signal ?? null,
  })
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let message = `请求失败(HTTP ${res.status})`
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } }
      if (json.error?.code) code = json.error.code
      if (json.error?.message) message = json.error.message
    } catch {
      /* 非 JSON 错误体,用默认信息 */
    }
    throw new GenerateHttpError(res.status, code, message)
  }
  if (!res.body) throw new GenerateHttpError(res.status, 'INTERNAL', '响应没有内容流')

  for await (const ev of readSseEventStream(res.body)) {
    if (ev.event === 'token') {
      try {
        const parsed = JSON.parse(ev.data) as { delta?: string }
        if (parsed.delta) yield { type: 'token', delta: parsed.delta }
      } catch {
        /* 畸形 token 行:跳过 */
      }
    } else if (ev.event === 'done') {
      try {
        const parsed = JSON.parse(ev.data) as { parse?: ParseSummary }
        yield {
          type: 'done',
          parse: parsed.parse ?? { ok: false, fileCount: 0, warnings: ['done 事件缺少解析摘要'] },
        }
      } catch {
        yield { type: 'done', parse: { ok: false, fileCount: 0, warnings: ['done 事件解析失败'] } }
      }
    } else if (ev.event === 'error') {
      let code = 'INTERNAL'
      let message = '生成失败'
      try {
        const parsed = JSON.parse(ev.data) as { code?: string; message?: string }
        if (parsed.code) code = parsed.code
        if (parsed.message) message = parsed.message
      } catch {
        /* 用默认错误 */
      }
      yield { type: 'error', code, message }
    }
    // 未知事件类型:忽略
  }
}

/** 从已累计的模型输出中提取可用于 iframe 增量预览的 HTML 片段 */
export function extractPartialHtml(text: string): string | null {
  const start = text.search(/<!doctype html|<html[\s>]/i)
  if (start < 0) return null
  let html = text.slice(start)
  // 去掉可能被截断的结尾代码围栏
  html = html.replace(/\n?```[\s\S]*$/, '')
  return html
}

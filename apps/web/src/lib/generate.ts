import type { GenerationMode } from 'shared'
import { apiUrl } from './api'

export interface GenerateRequest {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  siteType: string
  requirement: string
  history?: { instruction: string; artifact?: string; round?: number }[]
  mode?: GenerationMode
  maxTokens?: number
}

export interface ParseSummary {
  ok: boolean
  fileCount: number
  entry?: string
  warnings: string[]
}

export interface GeneratePerformance {
  firstTokenMs?: number | null
  durationMs: number
  outputChars: number
  generationMode?: GenerationMode
  maxTokens?: number
}

export type GenerateEvent =
  | { type: 'token'; delta: string }
  | { type: 'done'; parse: ParseSummary; performance?: GeneratePerformance }
  | { type: 'error'; code: string; message: string }

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
      let sep: number
      while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '')
        let event: string | undefined
        const dataLines: string[] = []
        for (const line of rawEvent.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).replace(/^ /, '')
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
        }
        if (event && dataLines.length > 0) yield { event, data: dataLines.join('\n') }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* generateSite(
  req: GenerateRequest,
  options: { signal?: AbortSignal; endpoint?: string } = {},
): AsyncGenerator<GenerateEvent, void, unknown> {
  const accessToken = typeof localStorage === 'undefined' ? null : localStorage.getItem('siteforge:access-token')
  const res = await fetch(options.endpoint ?? apiUrl('/api/generate'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
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
      // Non-JSON error body.
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
        // Skip malformed token events without terminating the stream.
      }
    } else if (ev.event === 'done') {
      try {
        const parsed = JSON.parse(ev.data) as { parse?: ParseSummary; performance?: GeneratePerformance }
        yield {
          type: 'done',
          parse: parsed.parse ?? { ok: false, fileCount: 0, warnings: ['done 事件缺少解析摘要'] },
          performance: parsed.performance,
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
        // Use defaults.
      }
      yield { type: 'error', code, message }
    }
  }
}

export function extractPartialHtml(text: string): string | null {
  const start = text.search(/<!doctype html|<html[\s>]/i)
  if (start < 0) return null
  let html = text.slice(start)
  html = html.replace(/\n?```[\s\S]*$/, '')
  return html
}

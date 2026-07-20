import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { buildGenerationPrompt, buildIterationPrompt } from 'prompts'
import { parseModelOutput } from 'shared'
import { connectTimeoutMs, totalTimeoutMs } from '../lib/config'
import { takeToken } from '../lib/rate-limit'
import {
  PROVIDER_ERROR_META,
  ProviderError,
  SUPPORTED_PROVIDERS,
  streamFromProvider,
  type ProviderErrorCode,
} from '../providers'
import { errorBody } from '../types'

/** 请求体上限:迭代历史需装下单 HTML 产物,放宽到 2MB */
const MAX_BODY_BYTES = 2 * 1024 * 1024

/** 迭代历史元素(SF-1-6):artifact 为当前产物单 HTML(可选截断),instruction 为本轮修改指令 */
const historyItemSchema = z.object({
  instruction: z.string().min(1),
  artifact: z.string().optional(),
  round: z.number().int().positive().optional(),
})

const bodySchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  siteType: z.string().min(1),
  requirement: z.string().min(1),
  history: z.array(historyItemSchema).optional(),
  maxTokens: z.number().int().positive().max(8192).optional(),
})

/**
 * POST /api/generate —— 生成代理(SSE)
 * 事件序列:token*(delta 增量) → done(含解析摘要);出错时 error → 结束。
 * apiKey 只在请求生命周期内存活:不落地、不打日志。
 */
const generate = new Hono()

generate.post('/', async (c) => {
  // 限流:每 IP 令牌桶
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!takeToken(ip)) {
    return c.json(errorBody('PROVIDER_RATE_LIMIT', '请求过于频繁,请每分钟不超过 10 次'), 429)
  }

  // 请求体上限(content-length 预检,迭代历史含完整产物,上限 2MB)
  const contentLength = Number(c.req.header('content-length') ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return c.json(errorBody('BAD_REQUEST', '请求体超过 2MB 上限,请缩短迭代历史中的产物内容'), 400)
  }

  // 参数校验
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await c.req.json())
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map((i) => i.message).join(';') : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', `参数校验失败:${msg}`), 400)
  }

  // 组装提示词:history 非空 → 迭代提示词(SF-1-6);否则初次生成提示词
  let messages: { role: 'system' | 'user'; content: string }[]
  try {
    const lastHistory = body.history?.[body.history.length - 1]
    const built = lastHistory?.artifact
      ? buildIterationPrompt({
          siteType: body.siteType,
          currentArtifact: lastHistory.artifact,
          instruction: lastHistory.instruction,
          round: lastHistory.round ?? 2,
        })
      : buildGenerationPrompt({
          siteType: body.siteType,
          requirement: body.requirement,
          history: body.history?.map((h) => ({ feedback: h.instruction, artifactHtml: h.artifact })),
        })
    messages = [
      { role: 'system', content: built.system },
      { role: 'user', content: built.user },
    ]
  } catch (err) {
    return c.json(
      errorBody('BAD_REQUEST', err instanceof Error ? err.message : '提示词组装失败'),
      400,
    )
  }

  return streamSSE(c, async (stream) => {
    let fullText = ''
    try {
      const events = streamFromProvider(body.provider, {
        model: body.model,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        messages,
        maxTokens: body.maxTokens,
        connectTimeoutMs: connectTimeoutMs(),
        totalTimeoutMs: totalTimeoutMs(),
      })
      for await (const ev of events) {
        if (ev.type === 'token') {
          fullText += ev.delta
          await stream.writeSSE({ event: 'token', data: JSON.stringify({ delta: ev.delta }) })
        }
      }
    } catch (err) {
      const pErr =
        err instanceof ProviderError ? err : new ProviderError('INTERNAL', '生成过程中出现内部错误')
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ code: pErr.code, message: pErr.message }),
      })
      return
    }

    // 流结束:服务端解析产物并给出摘要
    const parsed = parseModelOutput(fullText)
    await stream.writeSSE({
      event: 'done',
      data: JSON.stringify({
        parse: parsed
          ? {
              ok: true,
              fileCount: parsed.tree.files.length,
              entry: parsed.tree.entry,
              warnings: parsed.warnings,
            }
          : { ok: false, fileCount: 0, warnings: ['无法解析为产物文件树'] },
      }),
    })
  })
})

export default generate

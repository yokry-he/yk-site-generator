import { Hono } from 'hono'
import { errorBody } from '../types'

/**
 * 生成代理路由(占位)。
 * TODO(SF-1-3):实现 POST / —— 按厂商适配 OpenAI 兼容 / Anthropic / Gemini
 * 三类协议,转发大模型流式输出(SSE)给前端。
 */
const generate = new Hono()

generate.post('/', (c) =>
  c.json(errorBody('NOT_IMPLEMENTED', '生成接口将在 SF-1-3 实现'), 501),
)

export default generate

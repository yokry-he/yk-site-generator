/**
 * 端到端验证(SF-1-5,需本地 server 已启动且配置 EVAL_* key):
 * 用前端同一份 SSE 消费逻辑(src/lib/generate.ts 的 generateSite)
 * 打真实 /api/generate,完整跑「生成 → 累计 → parseModelOutput → artifactToSingleHtml」。
 * 用法:先 pnpm --filter server dev,再 set -a; source .env; set +a; pnpm --filter web e2e
 */
import { parseModelOutput, artifactToSingleHtml } from 'shared'
import { generateSite, extractPartialHtml } from '../src/lib/generate'

const apiKey = process.env.EVAL_API_KEY
if (!apiKey) {
  console.log('⏭️  未配置 EVAL_API_KEY,跳过 E2E(CI 环境属预期)。')
  process.exit(0)
}
const endpoint = process.env.E2E_ENDPOINT ?? 'http://localhost:8787/api/generate'

let text = ''
let tokens = 0
let parseSummary: unknown = null
let errorEvent: unknown = null

for await (const ev of generateSite(
  {
    provider: 'deepseek',
    model: process.env.EVAL_MODEL ?? 'deepseek-chat',
    apiKey,
    baseUrl: process.env.EVAL_BASE_URL,
    siteType: 'personal',
    requirement: '深色极简的个人主页,只有一个首屏介绍和联系方式',
    maxTokens: 4000,
  },
  { endpoint },
)) {
  if (ev.type === 'token') {
    tokens += 1
    text += ev.delta
  } else if (ev.type === 'done') {
    parseSummary = ev.parse
  } else if (ev.type === 'error') {
    errorEvent = ev
  }
}

console.log(`token 事件数:${tokens},累计 ${text.length} 字符`)
if (errorEvent) {
  console.error('❌ error 事件:', JSON.stringify(errorEvent))
  process.exit(1)
}
console.log('服务端 done.parse:', JSON.stringify(parseSummary))

// 前端二次解析(shared 同一份逻辑)
const parsed = parseModelOutput(text)
if (!parsed) {
  console.error('❌ 前端 parseModelOutput 解析失败')
  process.exit(1)
}
const html = artifactToSingleHtml(parsed.tree, {
  id: 'e2e',
  siteType: 'personal',
  title: 'E2E 验证',
  requirement: '深色极简的个人主页',
  createdAt: new Date().toISOString(),
  iteration: 1,
})
const partial = extractPartialHtml(text)
console.log(`✅ E2E 通过:${parsed.tree.files.length} 个文件,单 HTML ${(html.length / 1024).toFixed(1)} KB,增量预览起点${partial ? '可提取' : '不可提取!'}`)
if (!partial) process.exit(1)

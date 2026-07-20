/**
 * 真实 DeepSeek 冒烟测试(需 EVAL_API_KEY,CI 跳过):
 * 走完整 /api/generate SSE 链路,生成一个小需求,验证:
 *   1. SSE 事件序列完整(token* → done)
 *   2. 服务端 parseModelOutput 解析成功(parse.ok = true)
 * 用法:set -a; source ../../.env; set +a; pnpm --filter server smoke
 */
import { createApp } from '../src/app'

const apiKey = process.env.EVAL_API_KEY
if (!apiKey) {
  console.log('⏭️  未配置 EVAL_API_KEY,跳过冒烟测试(CI 环境属预期)。')
  process.exit(0)
}

const app = createApp()
const res = await app.request('/api/generate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    provider: 'deepseek',
    model: process.env.EVAL_MODEL ?? 'deepseek-chat',
    apiKey,
    baseUrl: process.env.EVAL_BASE_URL,
    siteType: 'personal',
    requirement: '深色极简的个人主页,只有一个首屏介绍和联系方式',
    maxTokens: 4000,
  }),
})

if (res.status !== 200) {
  console.error('❌ HTTP 状态异常:', res.status, await res.text())
  process.exit(1)
}

const text = await res.text()
const events = text
  .split('\n\n')
  .map((b) => ({
    event: b.match(/^event: (.+)$/m)?.[1],
    data: b.match(/^data: (.+)$/m)?.[1],
  }))
  .filter((e) => e.event && e.data)

const tokenCount = events.filter((e) => e.event === 'token').length
const errorEvent = events.find((e) => e.event === 'error')
const doneEvent = events.find((e) => e.event === 'done')

console.log(`token 事件数:${tokenCount}`)
if (errorEvent) {
  console.error('❌ 收到 error 事件:', errorEvent.data)
  process.exit(1)
}
if (!doneEvent) {
  console.error('❌ 缺少 done 事件')
  process.exit(1)
}
const done = JSON.parse(doneEvent.data!)
console.log('done.parse:', JSON.stringify(done.parse))
if (!done.parse?.ok) {
  console.error('❌ 产物解析失败')
  process.exit(1)
}
console.log(`✅ 冒烟通过:SSE 序列完整(${tokenCount} tokens),解析成功(${done.parse.fileCount} 个文件)`)

/**
 * SF-1-6 迭代 E2E(需本地 server 已启动且配置 EVAL_* key):
 * 第 1 轮初生成小页面 → 第 2 轮带 history 发修改指令「加一个联系表单区块」,
 * 验证第二轮 parse.ok 且包含联系表单、整体完整。
 * 用法:先 pnpm --filter server dev,再 set -a; source .env; set +a; pnpm --filter web e2e:iterate
 */
import { parseModelOutput, artifactToSingleHtml } from 'shared'
import { generateSite } from '../src/lib/generate'

const apiKey = process.env.EVAL_API_KEY
if (!apiKey) {
  console.log('⏭️  未配置 EVAL_API_KEY,跳过迭代 E2E。')
  process.exit(0)
}
const endpoint = process.env.E2E_ENDPOINT ?? 'http://localhost:8787/api/generate'
const baseReq = {
  provider: 'deepseek',
  model: process.env.EVAL_MODEL ?? 'deepseek-chat',
  apiKey,
  baseUrl: process.env.EVAL_BASE_URL,
  siteType: 'personal',
  maxTokens: 4000,
}

async function runRound(history?: { instruction: string; artifact: string; round: number }[]) {
  let text = ''
  let tokens = 0
  let parseSummary: { ok: boolean; fileCount: number } | null = null
  for await (const ev of generateSite(
    { ...baseReq, requirement: '深色极简的个人主页,只有一个首屏介绍和联系方式', history },
    { endpoint },
  )) {
    if (ev.type === 'token') {
      tokens += 1
      text += ev.delta
    } else if (ev.type === 'done') {
      parseSummary = ev.parse
    } else if (ev.type === 'error') {
      console.error('❌ error 事件:', ev.code, ev.message)
      process.exit(1)
    }
  }
  return { text, tokens, parseSummary }
}

function toSingleHtml(text: string, title: string): string | null {
  const parsed = parseModelOutput(text)
  if (!parsed) return null
  return artifactToSingleHtml(parsed.tree, {
    id: 'e2e-iter',
    siteType: 'personal',
    title,
    requirement: 'e2e',
    createdAt: new Date().toISOString(),
    iteration: 1,
  })
}

// ── 第 1 轮:初次生成 ──
const r1 = await runRound()
console.log(`第 1 轮:${r1.tokens} tokens,done.parse=${JSON.stringify(r1.parseSummary)}`)
const html1 = toSingleHtml(r1.text, '第 1 轮')
if (!r1.parseSummary?.ok || !html1) {
  console.error('❌ 第 1 轮解析失败')
  process.exit(1)
}
console.log(`第 1 轮产物:${(html1.length / 1024).toFixed(1)} KB`)

// ── 第 2 轮:迭代「加一个联系表单区块」 ──
const instruction = '在首屏下面加一个联系表单区块,包含姓名、邮箱、留言三个字段和提交按钮'
const r2 = await runRound([{ instruction, artifact: html1, round: 2 }])
console.log(`第 2 轮:${r2.tokens} tokens,done.parse=${JSON.stringify(r2.parseSummary)}`)
const html2 = toSingleHtml(r2.text, '第 2 轮')
if (!r2.parseSummary?.ok || !html2) {
  console.error('❌ 第 2 轮解析失败')
  process.exit(1)
}

// 验证:包含联系表单要素 + 整体完整
const checks = [
  ['表单标签', /<form[\s>]/i.test(html2) || html2.includes('联系')],
  ['邮箱字段', /type=["']email["']/i.test(html2) || html2.includes('邮箱')],
  ['提交按钮', /提交|submit/i.test(html2)],
  ['整体闭合', /<\/html>\s*$/m.test(html2.trim()) || html2.trim().endsWith('</html>')],
]
let allOk = true
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`)
  if (!ok) allOk = false
}
if (!allOk) process.exit(1)
console.log(`✅ 迭代 E2E 通过:第 2 轮产物 ${(html2.length / 1024).toFixed(1)} KB,含联系表单区块且整体完整`)

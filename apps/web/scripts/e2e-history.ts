/**
 * SF-1-7 历史持久化 E2E(浏览器 IndexedDB 用 fake-indexeddb 模拟):
 * 模拟「生成两轮 → 自动保存 → 重新打开恢复完整会话」全链路。
 * 用法:pnpm --filter web e2e:history
 */
import { IDBFactory } from 'fake-indexeddb'

globalThis.indexedDB = new IDBFactory()

const { addRound, createSession } = await import('../src/lib/iterationSession')
const {
  getSession,
  listSessions,
  newSessionId,
  recordToSession,
  resetHistoryDbForTest,
  sessionToRecord,
  titleFromRequirement,
  upsertSession,
} = await import('../src/lib/historyStore')

resetHistoryDbForTest()

// ── 模拟生成页:两轮迭代落进会话状态 ──
let session = createSession()
session = addRound(session, {
  instruction: '深色极简的个人主页',
  html: '<!DOCTYPE html><html><body><h1>v1</h1></body></html>',
  time: new Date().toISOString(),
  model: 'deepseek-chat',
})
session = addRound(session, {
  instruction: '加一个联系表单区块',
  html: '<!DOCTYPE html><html><body><h1>v2</h1><form></form></body></html>',
  time: new Date().toISOString(),
  model: 'deepseek-chat',
})

// ── 模拟自动保存(与 GeneratorDemo.persistSession 同逻辑) ──
const id = newSessionId()
await upsertSession(
  sessionToRecord(
    {
      id,
      title: titleFromRequirement(session.rounds[0].instruction),
      siteType: 'personal',
      requirement: '深色极简的个人主页',
      provider: 'deepseek',
      model: 'deepseek-chat',
      createdAt: new Date().toISOString(),
    },
    session,
  ),
)
console.log(`已保存会话 ${id}(2 轮)`)

// ── 模拟刷新后重新打开 ──
const list = await listSessions()
if (list.length !== 1) {
  console.error(`❌ 列表条数异常:${list.length}`)
  process.exit(1)
}
console.log(`历史列表:${list.length} 条,标题「${list[0].title}」,updatedAt 索引可用`)

const rec = await getSession(id)
if (!rec) {
  console.error('❌ 按 id 取回会话失败')
  process.exit(1)
}
const restored = recordToSession(rec)
const ok =
  restored.rounds.length === 2 &&
  restored.rounds[1].html.includes('<form>') &&
  restored.current === 1 &&
  restored.viewing === 1 &&
  rec.title === '深色极简的个人主页'
if (!ok) {
  console.error('❌ 恢复会话内容不一致', JSON.stringify({ rounds: restored.rounds.length, current: restored.current }))
  process.exit(1)
}
console.log(`✅ 历史 E2E 通过:保存 → 列表 → 打开恢复,2 轮完整(含 HTML),基底轮=第 ${restored.current + 1} 轮`)

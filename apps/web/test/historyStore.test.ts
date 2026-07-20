import { beforeEach, describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import {
  clearSessions,
  deleteSession,
  exportSessionJson,
  getSession,
  listSessions,
  newSessionId,
  parseSessionJson,
  recordToSession,
  renameSession,
  resetHistoryDbForTest,
  sessionHtmlBytes,
  sessionToRecord,
  titleFromRequirement,
  toMeta,
  upsertSession,
  type StoredSession,
} from '../src/lib/historyStore'
import { addRound, createSession } from '../src/lib/iterationSession'

function makeSession(id: string, updatedAt: string, title = '测试会话'): StoredSession {
  return {
    id,
    title,
    siteType: 'personal',
    requirement: '深色极简的个人主页',
    provider: 'deepseek',
    model: 'deepseek-chat',
    createdAt: updatedAt,
    updatedAt,
    rounds: [
      {
        round: 1,
        instruction: '深色极简的个人主页',
        html: '<!DOCTYPE html><html><body>v1</body></html>',
        time: updatedAt,
        model: 'deepseek-chat',
      },
    ],
    currentRound: 0,
  }
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  resetHistoryDbForTest()
})

describe('historyStore:纯逻辑', () => {
  it('标题取需求前 20 字', () => {
    expect(titleFromRequirement('一个深色极简的摄影师作品集')).toBe('一个深色极简的摄影师作品集')
    expect(titleFromRequirement('一'.repeat(30))).toBe(`${'一'.repeat(20)}…`)
    expect(titleFromRequirement('   ')).toBe('未命名会话')
  })

  it('toMeta:轮次数与 HTML 字节统计', () => {
    const m = toMeta(makeSession('a', '2026-01-01'))
    expect(m.roundCount).toBe(1)
    expect(m.htmlBytes).toBe(sessionHtmlBytes(makeSession('a', '2026-01-01').rounds))
    expect(m.htmlBytes).toBeGreaterThan(0)
  })

  it('recordToSession 容错:currentRound 越界收敛', () => {
    const rec = makeSession('a', '2026-01-01')
    rec.currentRound = 99
    const s = recordToSession(rec)
    expect(s.current).toBe(0)
    expect(s.viewing).toBe(0)
  })

  it('iterationSession 互转 round-trip', () => {
    let s = createSession()
    s = addRound(s, {
      instruction: '初始需求',
      html: '<html>v1</html>',
      time: '2026-01-01T00:00:00Z',
      model: 'm',
    })
    s = addRound(s, {
      instruction: '加 FAQ',
      html: '<html>v2</html>',
      time: '2026-01-01T00:01:00Z',
      model: 'm',
    })
    const rec = sessionToRecord(
      {
        id: newSessionId(),
        title: '标题',
        siteType: 'blog',
        requirement: '初始需求',
        createdAt: '2026-01-01T00:00:00Z',
      },
      s,
    )
    const restored = recordToSession(rec)
    expect(restored.rounds).toHaveLength(2)
    expect(restored.rounds[1].html).toBe('<html>v2</html>')
    expect(restored.current).toBe(1)
    expect(restored.viewing).toBe(1)
  })
})

describe('historyStore:IndexedDB 读写', () => {
  it('upsert → get → list(按 updatedAt 倒序)', async () => {
    await upsertSession(makeSession('a', '2026-01-01T00:00:00Z'))
    await upsertSession(makeSession('b', '2026-01-03T00:00:00Z'))
    await upsertSession(makeSession('c', '2026-01-02T00:00:00Z'))
    expect((await getSession('a'))?.title).toBe('测试会话')
    const list = await listSessions()
    expect(list.map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })

  it('upsert 同 id 覆盖更新', async () => {
    await upsertSession(makeSession('a', '2026-01-01T00:00:00Z'))
    const updated = makeSession('a', '2026-01-02T00:00:00Z', '改后')
    updated.rounds.push({ ...updated.rounds[0], round: 2, html: '<html>v2</html>' })
    updated.currentRound = 1
    await upsertSession(updated)
    const got = await getSession('a')
    expect(got?.title).toBe('改后')
    expect(got?.rounds).toHaveLength(2)
    expect((await listSessions()).map((s) => s.id)).toEqual(['a'])
  })

  it('rename / delete / clear', async () => {
    await upsertSession(makeSession('a', '2026-01-01'))
    await upsertSession(makeSession('b', '2026-01-02'))
    await renameSession('a', '  新标题  ')
    expect((await getSession('a'))?.title).toBe('新标题')
    await renameSession('a', '   ') // 空标题不改
    expect((await getSession('a'))?.title).toBe('新标题')
    await deleteSession('a')
    expect(await getSession('a')).toBeUndefined()
    expect((await listSessions()).map((s) => s.id)).toEqual(['b'])
    await clearSessions()
    expect(await listSessions()).toEqual([])
  })
})

describe('historyStore:导出/导入', () => {
  it('导出 JSON → 导入恢复(新 id,内容一致)', async () => {
    const src = makeSession('a', '2026-01-01T00:00:00Z')
    const json = exportSessionJson(src)
    const restored = parseSessionJson(json)
    expect(restored.id).not.toBe('a') // 新 id 避免覆盖
    expect(restored.title).toBe(src.title)
    expect(restored.rounds[0].html).toBe(src.rounds[0].html)
    // 导入后可落库
    await upsertSession(restored)
    expect((await listSessions())).toHaveLength(1)
  })

  it('导入非法输入抛中文错误', () => {
    expect(() => parseSessionJson('不是json')).toThrow('不是合法的 JSON 文件')
    expect(() => parseSessionJson('{"format":"other"}')).toThrow('format 不匹配')
    expect(() =>
      parseSessionJson(JSON.stringify({ format: 'siteforge-session@1', session: { title: 1 } })),
    ).toThrow('结构不完整')
  })
})

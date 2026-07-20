import { describe, expect, it } from 'vitest'
import {
  addRound,
  backToRound,
  canViewNext,
  canViewPrev,
  createSession,
  currentRound,
  isLargeArtifact,
  isViewingCurrent,
  nextRoundNumber,
  viewNext,
  viewPrev,
  viewingRound,
} from '../src/lib/iterationSession'

const r = (html: string, instruction = '改一下') => ({
  instruction,
  html,
  time: '2026-02-14T00:00:00Z',
  model: 'deepseek-chat',
})

describe('iterationSession', () => {
  it('空会话:无查看/基底轮,下一轮为 1', () => {
    const s = createSession()
    expect(viewingRound(s)).toBeNull()
    expect(currentRound(s)).toBeNull()
    expect(nextRoundNumber(s)).toBe(1)
  })

  it('addRound:轮次自增,查看与基底切到最新轮', () => {
    let s = createSession()
    s = addRound(s, r('<html>v1</html>', '初始需求'))
    s = addRound(s, r('<html>v2</html>', '加 FAQ'))
    expect(s.rounds.map((x) => x.round)).toEqual([1, 2])
    expect(viewingRound(s)?.html).toBe('<html>v2</html>')
    expect(currentRound(s)?.html).toBe('<html>v2</html>')
    expect(nextRoundNumber(s)).toBe(3)
  })

  it('轮次间切换查看:边界不越界', () => {
    let s = createSession()
    s = addRound(s, r('v1'))
    s = addRound(s, r('v2'))
    s = addRound(s, r('v3'))
    expect(canViewNext(s)).toBe(false)
    expect(canViewPrev(s)).toBe(true)
    s = viewPrev(s)
    expect(viewingRound(s)?.html).toBe('v2')
    s = viewPrev(s)
    s = viewPrev(s) // 越界:应保持
    expect(viewingRound(s)?.html).toBe('v1')
    expect(canViewPrev(s)).toBe(false)
    s = viewNext(s)
    expect(viewingRound(s)?.html).toBe('v2')
  })

  it('回到此轮:基底切到查看轮,之后 addRound 覆盖基底', () => {
    let s = createSession()
    s = addRound(s, r('v1'))
    s = addRound(s, r('v2'))
    s = addRound(s, r('v3'))
    s = viewPrev(s)
    s = viewPrev(s) // 查看 v1
    expect(isViewingCurrent(s)).toBe(false)
    s = backToRound(s)
    expect(isViewingCurrent(s)).toBe(true)
    expect(currentRound(s)?.html).toBe('v1')
    s = addRound(s, r('v4-from-v1'))
    expect(currentRound(s)?.html).toBe('v4-from-v1')
    expect(s.rounds).toHaveLength(4)
  })

  it('大产物阈值判断', () => {
    expect(isLargeArtifact('x'.repeat(6001))).toBe(true)
    expect(isLargeArtifact('x'.repeat(6000))).toBe(false)
  })
})

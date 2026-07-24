import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStreamTextBuffer } from '../src/lib/stream-text-buffer'

afterEach(() => vi.useRealTimers())

describe('createStreamTextBuffer', () => {
  it('combines many token fragments into one scheduled UI commit', () => {
    vi.useFakeTimers()
    const commits: Array<[string, number]> = []
    const buffer = createStreamTextBuffer((text, count) => commits.push([text, count]), 40)
    buffer.push('a')
    buffer.push('b')
    buffer.push('c')
    expect(commits).toEqual([])
    vi.advanceTimersByTime(40)
    expect(commits).toEqual([['abc', 3]])
  })

  it('flushes immediately before done and clear discards stale fragments', () => {
    vi.useFakeTimers()
    const commits: Array<[string, number]> = []
    const buffer = createStreamTextBuffer((text, count) => commits.push([text, count]))
    buffer.push('first')
    buffer.flush()
    buffer.push('stale')
    buffer.clear()
    vi.runAllTimers()
    expect(commits).toEqual([['first', 1]])
  })
})

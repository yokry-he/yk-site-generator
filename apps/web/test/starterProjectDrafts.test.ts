import { describe, expect, it } from 'vitest'
import {
  listStarterProjectDrafts,
  loadStarterProjectDraft,
  removeStarterProjectDraft,
  saveStarterProjectDraft,
} from '../src/lib/starterProjectDrafts'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('starter project drafts', () => {
  it('saves and restores a project without authentication', () => {
    const storage = new MemoryStorage()
    const draft = saveStarterProjectDraft('aurora', '<!doctype html><html></html>', storage)
    expect(loadStarterProjectDraft('aurora', storage)).toEqual(draft)
  })

  it('replaces an existing draft and removes it on reset', () => {
    const storage = new MemoryStorage()
    saveStarterProjectDraft('aurora', '<html>one</html>', storage)
    saveStarterProjectDraft('aurora', '<html>two</html>', storage)
    expect(listStarterProjectDrafts(storage)).toHaveLength(1)
    expect(loadStarterProjectDraft('aurora', storage)?.html).toContain('two')
    removeStarterProjectDraft('aurora', storage)
    expect(loadStarterProjectDraft('aurora', storage)).toBeNull()
  })

  it('keeps only the eight most recent projects', () => {
    const storage = new MemoryStorage()
    for (let index = 0; index < 10; index += 1) {
      saveStarterProjectDraft(`project-${index}`, `<html>${index}</html>`, storage)
    }
    expect(listStarterProjectDrafts(storage)).toHaveLength(8)
  })

  it('rejects oversized local HTML before writing', () => {
    const storage = new MemoryStorage()
    expect(() => saveStarterProjectDraft('huge', 'x'.repeat(1_500_001), storage)).toThrow(/1.5MB/)
    expect(listStarterProjectDrafts(storage)).toHaveLength(0)
  })
})

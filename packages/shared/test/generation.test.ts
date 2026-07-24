import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODES,
  getGenerationModeProfile,
} from '../src/generation'

describe('generation modes', () => {
  it('provides ordered fast, balanced and quality strategies', () => {
    expect(GENERATION_MODES.map((item) => item.id)).toEqual(['fast', 'balanced', 'quality'])
    expect(new Set(GENERATION_MODES.map((item) => item.maxTokens)).size).toBe(3)
    expect(GENERATION_MODES.every((item) => item.promptDirectives.length >= 3)).toBe(true)
  })

  it('falls back to balanced for missing or unknown values', () => {
    expect(DEFAULT_GENERATION_MODE).toBe('balanced')
    expect(getGenerationModeProfile(undefined).id).toBe('balanced')
    expect(getGenerationModeProfile('unknown').id).toBe('balanced')
  })

  it('allocates the largest budget to quality mode', () => {
    expect(getGenerationModeProfile('quality').maxTokens)
      .toBeGreaterThan(getGenerationModeProfile('balanced').maxTokens)
  })
})

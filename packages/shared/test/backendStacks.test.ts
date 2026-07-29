import { describe, expect, it } from 'vitest'
import {
  BACKEND_STACK_IDS,
  BACKEND_STACK_PROFILES,
  DEFAULT_BACKEND_STACK_ID,
  backendStackSupportsDatabase,
  getBackendStackProfile,
} from '../src/backendStacks'

describe('backend stack profiles', () => {
  it('publishes one complete profile for every supported stack id', () => {
    expect(BACKEND_STACK_PROFILES.map((profile) => profile.id)).toEqual(BACKEND_STACK_IDS)
    for (const profile of BACKEND_STACK_PROFILES) {
      expect(profile.name).toBeTruthy()
      expect(profile.framework).toBeTruthy()
      expect(profile.orm).toBeTruthy()
      expect(profile.migrationTool).toBeTruthy()
      expect(profile.databases.length).toBeGreaterThan(0)
      expect(profile.databases).toContain(profile.recommendedDatabase)
      expect(profile.commands.dev).toBeTruthy()
      expect(profile.commands.test).toBeTruthy()
      expect(profile.commands.migrate).toBeTruthy()
    }
  })

  it('keeps Hono as the default recommended stack', () => {
    const profile = getBackendStackProfile(DEFAULT_BACKEND_STACK_ID)
    expect(profile).toMatchObject({ id: 'hono-drizzle', recommended: true, language: 'TypeScript' })
  })

  it('enforces database compatibility instead of exposing invalid combinations', () => {
    expect(backendStackSupportsDatabase('spring-boot-jpa', 'postgresql')).toBe(true)
    expect(backendStackSupportsDatabase('spring-boot-jpa', 'sqlite')).toBe(false)
    expect(backendStackSupportsDatabase('fastapi-sqlalchemy', 'sqlite')).toBe(true)
    expect(backendStackSupportsDatabase('gin-gorm', 'postgresql')).toBe(true)
  })
})

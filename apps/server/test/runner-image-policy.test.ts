import { describe,expect,it } from 'vitest'
import { validRunnerImageReference } from '../src/lib/runner-images'
describe('runner image policy',()=>{it('accepts only digest-pinned references',()=>{expect(validRunnerImageReference('ghcr.io/siteforge/runner@sha256:'+'a'.repeat(64))).toBe(true);expect(validRunnerImageReference('siteforge/runner:latest')).toBe(false)})})

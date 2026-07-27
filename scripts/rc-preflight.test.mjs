import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMajorVersion, parsePnpmLockfileVersion, validateManifestScripts } from './lib/rc-preflight.mjs'

test('parseMajorVersion accepts common tool version strings', () => {
  assert.equal(parseMajorVersion('v24.3.0'), 24)
  assert.equal(parseMajorVersion('11.1.2'), 11)
  assert.equal(parseMajorVersion('pnpm 11.0.0'), 11)
  assert.equal(parseMajorVersion('unknown'), undefined)
})

test('parsePnpmLockfileVersion reads quoted and unquoted values', () => {
  assert.equal(parsePnpmLockfileVersion("lockfileVersion: '9.0'\n"), '9.0')
  assert.equal(parsePnpmLockfileVersion('lockfileVersion: 9.0\n'), '9.0')
})

test('validateManifestScripts reports only missing scripts', () => {
  const issues = validateManifestScripts('package.json', { scripts: { build: 'echo build' } }, ['build', 'test'])
  assert.equal(issues.length, 1)
  assert.equal(issues[0].code, 'MISSING_PACKAGE_SCRIPT')
  assert.match(issues[0].message, /test/)
})

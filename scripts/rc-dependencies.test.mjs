import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEPENDENCY_FAILURE_CATEGORIES,
  classifyDependencyFailure,
  dependencyCommand,
  dependencyFailureIsRetryable,
  redactDependencyOutput,
  retryDelayMs,
} from './lib/rc-dependencies.mjs'

test('classifies registry and lockfile failures', () => {
  assert.equal(classifyDependencyFailure('ERR_PNPM_META_FETCH_FAIL HTTP 503'), DEPENDENCY_FAILURE_CATEGORIES.registry)
  assert.equal(classifyDependencyFailure('ERR_PNPM_OUTDATED_LOCKFILE'), DEPENDENCY_FAILURE_CATEGORIES.lockfile)
  assert.equal(dependencyFailureIsRetryable(DEPENDENCY_FAILURE_CATEGORIES.registry), true)
  assert.equal(dependencyFailureIsRetryable(DEPENDENCY_FAILURE_CATEGORIES.lockfile), false)
})

test('classifies integrity and offline-store failures', () => {
  assert.equal(classifyDependencyFailure('ERR_PNPM_TARBALL_INTEGRITY'), DEPENDENCY_FAILURE_CATEGORIES.integrity)
  assert.equal(classifyDependencyFailure('ERR_PNPM_NO_OFFLINE_TARBALL'), DEPENDENCY_FAILURE_CATEGORIES.store)
})

test('uses fetch followed by frozen offline install', () => {
  assert.deepEqual(dependencyCommand('fetch').args, ['fetch', '--reporter=ndjson'])
  assert.deepEqual(dependencyCommand('install').args, ['install', '--offline', '--frozen-lockfile', '--reporter=ndjson'])
})

test('redacts credentials and computes capped exponential delay', () => {
  const value = redactDependencyOutput('redis://user:password@localhost token=abcd1234abcd', ['abcd1234abcd'])
  assert.doesNotMatch(value, /password|abcd1234abcd/)
  assert.equal(retryDelayMs(1, 5_000), 5_000)
  assert.equal(retryDelayMs(4, 5_000), 30_000)
})

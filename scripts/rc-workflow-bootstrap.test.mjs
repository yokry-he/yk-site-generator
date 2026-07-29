import test from 'node:test'
import assert from 'node:assert/strict'
import { auditWorkflowText, workflowUsesNodeOrPnpm } from './lib/rc-workflow-bootstrap.mjs'

const valid = `
steps:
  - uses: ./.github/actions/rc-node-bootstrap
    with:
      preflight-profile: core
      dependency-mode: all
      artifact-name: rc-bootstrap-test
  - run: pnpm test
`

test('recognizes workflows that need the shared bootstrap', () => {
  assert.equal(workflowUsesNodeOrPnpm('steps:\n  - run: pnpm test\n'), true)
  assert.equal(workflowUsesNodeOrPnpm('steps:\n  - uses: docker/build-push-action@v6\n'), false)
})

test('accepts the shared bootstrap with a diagnostic artifact name', () => {
  assert.deepEqual(auditWorkflowText('.github/workflows/test.yml', valid), [])
})

test('rejects direct setup and direct frozen installs', () => {
  const issues = auditWorkflowText('.github/workflows/test.yml', `
steps:
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v4
  - run: pnpm install --frozen-lockfile
`)
  assert.deepEqual(new Set(issues.map((item) => item.code)), new Set([
    'RC_BOOTSTRAP_MISSING',
    'DIRECT_PNPM_SETUP',
    'DIRECT_NODE_SETUP',
    'DIRECT_PNPM_INSTALL',
  ]))
})

test('requires an artifact name for every bootstrap use', () => {
  const issues = auditWorkflowText('.github/workflows/test.yml', `
steps:
  - uses: ./.github/actions/rc-node-bootstrap
  - run: pnpm test
`)
  assert.equal(issues.some((item) => item.code === 'RC_BOOTSTRAP_ARTIFACT_NAME_MISSING'), true)
})

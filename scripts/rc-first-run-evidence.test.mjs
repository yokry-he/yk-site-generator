import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { sealFirstRunEvidence, verifyFirstRunEvidence } from './lib/rc-first-run-evidence.mjs'

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'siteforge-evidence-'))
  for (const path of ['release', 'infra/rc-workstation', 'artifacts/rc-first-run/run/logs', 'artifacts/rc-triage/first-run-run']) await mkdir(resolve(root, path), { recursive: true })
  for (const path of ['release/rc-first-run-plan.json', 'release/rc-manifest.json', 'infra/rc-workstation/Dockerfile', 'infra/rc-workstation/compose.yml', 'infra/rc-workstation/images.lock.json']) await writeFile(resolve(root, path), `${path}\n`)
  await writeFile(resolve(root, 'artifacts/rc-first-run/run/workstation-image.json'), '{}\n')
  await writeFile(resolve(root, 'artifacts/rc-first-run/run/workstation-inputs.sha256'), 'abc  input\n')
  await writeFile(resolve(root, 'artifacts/rc-first-run/run/logs/contract.attempt-1.log'), 'passed\n')
  await writeFile(resolve(root, 'artifacts/rc-triage/first-run-run/latest.json'), '{"status":"clear"}\n')
  const state = {
    schemaVersion: 1,
    runId: 'run',
    candidateVersion: '0.1.0-rc.1',
    profile: 'core',
    commit: 'a'.repeat(40),
    status: 'passed',
    stages: [{ id: 'contract', status: 'passed', attempts: [{ logPath: 'artifacts/rc-first-run/run/logs/contract.attempt-1.log' }] }],
  }
  return { root, state, runDirectory: resolve(root, 'artifacts/rc-first-run/run') }
}

test('first-run evidence seals and verifies deterministic file hashes', async () => {
  const { root, state, runDirectory } = await fixture()
  const sealed = await sealFirstRunEvidence({ root, runDirectory, state })
  assert.equal(sealed.manifest.commit, 'a'.repeat(40))
  assert.ok(sealed.manifest.files.some((item) => item.path.endsWith('/sealed-state.json')))
  assert.equal((await verifyFirstRunEvidence({ root, runId: 'run' })).ok, true)
  const sums = await readFile(resolve(runDirectory, 'SHA256SUMS'), 'utf8')
  assert.match(sums, /evidence-manifest\.json/)
  assert.match(sums, /contract\.attempt-1\.log/)
})

test('verification detects modified evidence', async () => {
  const { root, state, runDirectory } = await fixture()
  await sealFirstRunEvidence({ root, runDirectory, state })
  await writeFile(resolve(runDirectory, 'logs/contract.attempt-1.log'), 'tampered\n')
  const result = await verifyFirstRunEvidence({ root, runId: 'run' })
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_EVIDENCE_DIGEST_MISMATCH'))
})

test('verification detects a modified checksum list', async () => {
  const { root, state, runDirectory } = await fixture()
  await sealFirstRunEvidence({ root, runDirectory, state })
  await writeFile(resolve(runDirectory, 'SHA256SUMS'), 'tampered\n')
  const result = await verifyFirstRunEvidence({ root, runId: 'run' })
  assert.equal(result.ok, false)
  assert.ok(result.issues.some((item) => item.code === 'FIRST_RUN_EVIDENCE_CHECKSUMS_MISMATCH'))
})

test('sealing rejects missing stage logs', async () => {
  const { root, state, runDirectory } = await fixture()
  state.stages[0].attempts[0].logPath = 'artifacts/rc-first-run/run/logs/missing.log'
  await assert.rejects(sealFirstRunEvidence({ root, runDirectory, state }), /FIRST_RUN_EVIDENCE_LOG_MISSING/)
})

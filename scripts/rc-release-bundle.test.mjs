import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { verifyRcReleaseBundle, writeRcReleaseBundleChecksums } from './lib/rc-release-bundle.mjs'

const now = Date.parse('2026-07-29T06:00:00.000Z')
const commit = 'a'.repeat(40)
const version = '0.1.0-rc.1'

function receiptDigest(gates) {
  const digest = createHash('sha256')
  for (const gate of gates) digest.update(gate.gate).update('\0').update(gate.signatureSha256).update('\0')
  return digest.digest('hex')
}

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'siteforge-rc-bundle-'))
  await mkdir(root, { recursive: true })
  const gates = [
    {
      schemaVersion: 1,
      candidateVersion: version,
      gate: 'build',
      status: 'passed',
      trusted: true,
      source: 'github-actions',
      commit,
      runId: '777',
      workflowRunAttempt: 3,
      repository: 'yokry-he/yk-site-generator',
      workflowPath: '.github/workflows/rc-release.yml',
      observedAt: '2026-07-29T05:55:00.000Z',
      signatureSha256: 'b'.repeat(64),
    },
    {
      schemaVersion: 1,
      candidateVersion: version,
      gate: 'unit',
      status: 'passed',
      trusted: true,
      source: 'github-actions',
      commit,
      runId: '777',
      workflowRunAttempt: 3,
      repository: 'yokry-he/yk-site-generator',
      workflowPath: '.github/workflows/rc-release.yml',
      observedAt: '2026-07-29T05:56:00.000Z',
      signatureSha256: 'c'.repeat(64),
    },
  ]
  const evidenceDigest = 'd'.repeat(64)
  const manifest = {
    schemaVersion: 2,
    candidateVersion: version,
    commit,
    status: 'ready-for-human-approval',
    maximumEvidenceAgeHours: 24,
    assembledAt: '2026-07-29T05:59:00.000Z',
    firstRunAdmission: {
      runId: 'aaaaaaaaaaaa-20260729T040000Z',
      manifestSha256: 'e'.repeat(64),
      evidenceSealedAt: '2026-07-29T04:40:00.000Z',
      workflowRunId: '111',
      workflowRunAttempt: 2,
      workflowCreatedAt: '2026-07-29T04:00:00.000Z',
      repository: 'yokry-he/yk-site-generator',
      workflowName: 'RC First Real Run',
      workflowPath: '.github/workflows/rc-first-real-run.yml',
      artifactName: `rc-first-real-run-release-${commit}-attempt-2`,
      artifactId: 222,
      artifactDigest: `sha256:${'f'.repeat(64)}`,
      artifactSizeBytes: 4096,
      artifactCreatedAt: '2026-07-29T04:45:00.000Z',
      artifactExpiresAt: '2026-08-28T04:45:00.000Z',
      maximumAgeHours: 24,
      triageStatus: 'clear',
      triageCounts: { P0: 0, P1: 0, P2: 0, P3: 0 },
      integrityAlgorithm: 'sha256',
      authentication: 'github-actions-run-attempt-and-artifact-identity',
    },
    signedGateEvidence: {
      signatureAlgorithm: 'hmac-sha256',
      evidenceDigest,
      receiptDigest: receiptDigest(gates),
      gateCount: gates.length,
      source: 'github-actions',
      repository: 'yokry-he/yk-site-generator',
      workflowPath: '.github/workflows/rc-release.yml',
      workflowRunId: '777',
      workflowRunAttempt: 3,
    },
    evidenceDigest,
    gates,
  }
  const notes = `# SiteForge ${version}\n\nCandidate commit: \`${commit}\`\n\nThe commit-bound release first run was admitted from GitHub Actions workflow run \`111\`, attempt \`2\`.\n\nAll required RC gates were independently verified with HMAC-SHA-256 and bound to release workflow run \`777\`, attempt \`3\`.\n\nThis bundle is ready for human approval.\n`
  await writeFile(resolve(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(resolve(root, 'RELEASE_NOTES.md'), notes)
  await writeRcReleaseBundleChecksums({ bundleDirectory: root })
  return { root, manifest }
}

function options(root, overrides = {}) {
  return {
    bundleDirectory: root,
    expectedVersion: version,
    expectedCommit: commit,
    expectedReleaseWorkflowRunId: '777',
    expectedReleaseWorkflowRunAttempt: 3,
    expectedRepository: 'yokry-he/yk-site-generator',
    expectedWorkflowPath: '.github/workflows/rc-release.yml',
    now,
    ...overrides,
  }
}

test('verifies a complete RC bundle receipt offline', async () => {
  const { root } = await fixture()
  const result = await verifyRcReleaseBundle(options(root))
  assert.equal(result.ok, true, JSON.stringify(result.issues, null, 2))
  assert.equal(result.checksums.length, 2)
})

test('detects release-note and manifest tampering', async () => {
  const notesFixture = await fixture()
  await writeFile(resolve(notesFixture.root, 'RELEASE_NOTES.md'), 'tampered\n')
  const notesResult = await verifyRcReleaseBundle(options(notesFixture.root))
  assert.ok(notesResult.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_CHECKSUMS_MISMATCH'))

  const manifestFixture = await fixture()
  const manifest = JSON.parse(await readFile(resolve(manifestFixture.root, 'manifest.json'), 'utf8'))
  manifest.commit = 'b'.repeat(40)
  await writeFile(resolve(manifestFixture.root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const manifestResult = await verifyRcReleaseBundle(options(manifestFixture.root))
  assert.ok(manifestResult.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_CHECKSUMS_MISMATCH'))
  assert.ok(manifestResult.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_COMMIT_MISMATCH'))
})

test('rejects unexpected files and symbolic links', async () => {
  const unexpectedFixture = await fixture()
  await writeFile(resolve(unexpectedFixture.root, 'extra.txt'), 'unexpected\n')
  const unexpected = await verifyRcReleaseBundle(options(unexpectedFixture.root))
  assert.ok(unexpected.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_FILE_UNEXPECTED'))

  const symlinkFixture = await fixture()
  await writeFile(resolve(symlinkFixture.root, 'notes-target.md'), 'target\n')
  await writeFile(resolve(symlinkFixture.root, 'RELEASE_NOTES.md'), 'removed\n')
  await symlink(resolve(symlinkFixture.root, 'notes-target.md'), resolve(symlinkFixture.root, 'link.md'))
  const symlinkResult = await verifyRcReleaseBundle(options(symlinkFixture.root))
  assert.ok(symlinkResult.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_FILE_UNSAFE'))
})

test('rejects receipt, source, gate order, and expected identity drift', async () => {
  const { root } = await fixture()
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
  manifest.signedGateEvidence.receiptDigest = '0'.repeat(64)
  manifest.gates.reverse()
  manifest.gates[0].workflowRunAttempt = 4
  await writeFile(resolve(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeRcReleaseBundleChecksums({ bundleDirectory: root })
  const result = await verifyRcReleaseBundle(options(root, { expectedReleaseWorkflowRunAttempt: 9 }))
  assert.ok(result.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_GATE_RECEIPT_DIGEST_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_GATES_UNSORTED'))
  assert.ok(result.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_GATE_SOURCE_MISMATCH'))
  assert.ok(result.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_EXPECTED_ATTEMPT_MISMATCH'))
})

test('rejects an artifact that was expired when the bundle was assembled', async () => {
  const { root } = await fixture()
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
  manifest.firstRunAdmission.artifactExpiresAt = '2026-07-29T05:00:00.000Z'
  await writeFile(resolve(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeRcReleaseBundleChecksums({ bundleDirectory: root })
  const result = await verifyRcReleaseBundle(options(root))
  assert.ok(result.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_FIRST_RUN_ARTIFACT_EXPIRED_AT_ASSEMBLY'))
})

test('CLI verifies a downloaded bundle without pnpm', async () => {
  const { root } = await fixture()
  const result = spawnSync(process.execPath, [resolve(import.meta.dirname, 'rc-release-bundle.mjs'), '--bundle', root], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /RC bundle verified/)
})

test('prepare and package commands self-verify before handoff', async () => {
  const prepare = await readFile(resolve(import.meta.dirname, 'prepare-rc-release.ts'), 'utf8')
  assert.match(prepare, /await rm\(output, \{ recursive: true, force: true \}\)/)
  assert.match(prepare, /writeRcReleaseBundleChecksums/)
  assert.match(prepare, /verifyRcReleaseBundle/)
  assert.match(prepare, /RC_RELEASE_BUNDLE_SELF_VERIFICATION_FAILED/)
  const packageJson = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'))
  assert.match(packageJson.scripts['rc:bundle:verify'], /rc-release-bundle\.test\.mjs/)
  assert.match(packageJson.scripts['rc:bundle:verify'], /rc-release-bundle\.mjs/)
  assert.match(packageJson.scripts['rc:prepare'], /rc-release-bundle\.test\.mjs/)
})

test('rejects evidence that was stale at bundle assembly', async () => {
  const { root } = await fixture()
  const manifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))
  manifest.gates[0].observedAt = '2026-07-27T00:00:00.000Z'
  await writeFile(resolve(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await writeRcReleaseBundleChecksums({ bundleDirectory: root })
  const result = await verifyRcReleaseBundle(options(root))
  assert.ok(result.issues.some((item) => item.code === 'RC_RELEASE_BUNDLE_GATE_STALE_AT_ASSEMBLY'))
})

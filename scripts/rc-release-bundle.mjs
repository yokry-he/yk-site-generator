import { resolve } from 'node:path'
import { verifyRcReleaseBundle } from './lib/rc-release-bundle.mjs'

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const inline = args.find((item) => item.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] ?? fallback : fallback
}

const bundleDirectory = resolve(valueOf('bundle', 'artifacts/rc-release'))
const result = await verifyRcReleaseBundle({
  bundleDirectory,
  expectedVersion: valueOf('version'),
  expectedCommit: valueOf('commit'),
  expectedReleaseWorkflowRunId: valueOf('release-workflow-run-id'),
  expectedReleaseWorkflowRunAttempt: valueOf('release-workflow-run-attempt'),
  expectedRepository: valueOf('repository'),
  expectedWorkflowPath: valueOf('workflow-path'),
})

if (!result.ok) {
  console.error(`RC bundle verification failed with ${result.issues.length} issue(s):`)
  for (const finding of result.issues) console.error(`- ${finding.code}: ${finding.message}${finding.path ? ` (${finding.path})` : ''}`)
  process.exitCode = 1
} else {
  console.log(`RC bundle verified: ${bundleDirectory}`)
  console.log(`- candidate: ${result.manifest.candidateVersion}`)
  console.log(`- commit: ${result.manifest.commit}`)
  console.log(`- release run: ${result.manifest.signedGateEvidence.workflowRunId} attempt ${result.manifest.signedGateEvidence.workflowRunAttempt}`)
}

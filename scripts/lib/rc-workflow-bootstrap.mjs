import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const RC_BOOTSTRAP_ACTION = './.github/actions/rc-node-bootstrap'

const directSetupPatterns = [
  ['DIRECT_PNPM_SETUP', /uses:\s*pnpm\/action-setup@/],
  ['DIRECT_NODE_SETUP', /uses:\s*actions\/setup-node@/],
  ['DIRECT_PNPM_INSTALL', /(?:^|\s)pnpm\s+install(?:\s|$)/m],
  ['DIRECT_DEPENDENCY_BOOTSTRAP', /node\s+scripts\/install-rc-dependencies\.mjs/],
]

export function workflowUsesNodeOrPnpm(content) {
  return /\bpnpm\b|actions\/setup-node@|pnpm\/action-setup@|node\s+scripts\/(?:rc-|install-rc-)/.test(String(content))
}

function occurrences(content, pattern) {
  return [...String(content).matchAll(pattern)].length
}

export function auditWorkflowText(path, content) {
  const value = String(content)
  const issues = []
  const requiresBootstrap = workflowUsesNodeOrPnpm(value)
  const bootstrapCount = occurrences(value, /uses:\s*\.\/\.github\/actions\/rc-node-bootstrap\b/g)
  const artifactCount = occurrences(value, /^\s*artifact-name:\s*\S+/gm)

  if (requiresBootstrap && bootstrapCount === 0) {
    issues.push({
      code: 'RC_BOOTSTRAP_MISSING',
      path,
      message: `${path} runs Node or pnpm commands without ${RC_BOOTSTRAP_ACTION}`,
    })
  }

  for (const [code, pattern] of directSetupPatterns) {
    if (pattern.test(value)) {
      issues.push({ code, path, message: `${path} bypasses the shared RC Node bootstrap action` })
    }
  }

  if (bootstrapCount > artifactCount) {
    issues.push({
      code: 'RC_BOOTSTRAP_ARTIFACT_NAME_MISSING',
      path,
      message: `${path} has ${bootstrapCount} bootstrap use(s) but only ${artifactCount} artifact-name input(s)`,
    })
  }

  return issues
}

export function auditWorkflowBootstrap(root = process.cwd()) {
  const workflowRoot = resolve(root, '.github/workflows')
  const workflowFiles = readdirSync(workflowRoot)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
  const issues = []
  const workflows = []

  for (const name of workflowFiles) {
    const path = `.github/workflows/${name}`
    const content = readFileSync(resolve(workflowRoot, name), 'utf8')
    const workflowIssues = auditWorkflowText(path, content)
    workflows.push({ path, requiresBootstrap: workflowUsesNodeOrPnpm(content), issues: workflowIssues.length })
    issues.push(...workflowIssues)
  }

  return {
    schemaVersion: 1,
    ok: issues.length === 0,
    action: RC_BOOTSTRAP_ACTION,
    workflows,
    issues,
  }
}

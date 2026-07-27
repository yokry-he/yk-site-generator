import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const WORKSPACE_REQUIREMENTS = Object.freeze({
  'package.json': ['lint', 'docs:check', 'rc:preflight', 'rc:deps', 'rc:audit', 'rc:security', 'rc:golden', 'runner:images:validate', 'typecheck', 'build', 'test'],
  'apps/web/package.json': ['build', 'typecheck', 'test', 'e2e:history', 'e2e:browser', 'e2e:visual', 'check:bundle-budget'],
  'apps/server/package.json': ['build', 'typecheck', 'test', 'db:mysql:ci'],
  'packages/shared/package.json': ['build', 'typecheck', 'test'],
  'packages/prompts/package.json': ['build', 'typecheck', 'test', 'eval:quality'],
})

export const REQUIRED_FILES = Object.freeze([
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  '.github/workflows/ci.yml',
  '.github/workflows/rc-release.yml',
  'scripts/lib/rc-gates.ts',
  'scripts/lib/rc-dependencies.mjs',
  'scripts/install-rc-dependencies.mjs',
  'release/rc-manifest.json',
  'fixtures/golden-projects/manifest.json',
])

const RELEASE_TOOLS = Object.freeze(['docker', 'python3', 'go', 'java', 'mvn', 'psql', 'redis-cli'])

export function parseMajorVersion(value) {
  const match = String(value ?? '').match(/(?:^|\s|v)(\d+)(?:\.|\b)/)
  return match ? Number(match[1]) : undefined
}

export function parsePnpmLockfileVersion(value) {
  const match = String(value ?? '').match(/^lockfileVersion:\s*['"]?([^'"\s]+)['"]?/m)
  return match?.[1]
}

export function validateManifestScripts(path, manifest, requiredScripts) {
  const issues = []
  if (!manifest || typeof manifest !== 'object') {
    issues.push({ severity: 'error', code: 'INVALID_PACKAGE_JSON', path, message: `${path} is not a JSON object` })
    return issues
  }
  const scripts = manifest.scripts && typeof manifest.scripts === 'object' ? manifest.scripts : {}
  for (const script of requiredScripts) {
    if (typeof scripts[script] !== 'string' || !scripts[script].trim()) {
      issues.push({ severity: 'error', code: 'MISSING_PACKAGE_SCRIPT', path, message: `${path} is missing script ${script}` })
    }
  }
  return issues
}

export function commandVersion(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 10_000, windowsHide: true })
  if (result.error || result.status !== 0) return { available: false, detail: result.error?.code || result.stderr?.trim() || `exit ${result.status}` }
  return { available: true, detail: (result.stdout || result.stderr || '').trim().split(/\r?\n/)[0] || 'available' }
}

function readJson(root, relativePath, issues) {
  const target = resolve(root, relativePath)
  try {
    return JSON.parse(readFileSync(target, 'utf8'))
  } catch (error) {
    issues.push({ severity: 'error', code: 'INVALID_JSON_FILE', path: relativePath, message: error instanceof Error ? error.message : String(error) })
    return undefined
  }
}

function add(issues, severity, code, message, path) {
  issues.push({ severity, code, message, ...(path ? { path } : {}) })
}

export function runPreflight({ root, profile = 'core', strictWarnings = false, environment = process.env } = {}) {
  const repositoryRoot = resolve(root || process.cwd())
  const issues = []
  const tools = {}

  if (!['core', 'full', 'release'].includes(profile)) {
    add(issues, 'error', 'UNKNOWN_PREFLIGHT_PROFILE', `Unsupported profile: ${profile}`)
    return { schemaVersion: 1, profile, root: repositoryRoot, ok: false, issues, tools }
  }

  for (const path of REQUIRED_FILES) {
    if (!existsSync(resolve(repositoryRoot, path))) add(issues, 'error', 'MISSING_REQUIRED_FILE', `Missing required repository file: ${path}`, path)
  }
  for (const path of Object.keys(WORKSPACE_REQUIREMENTS)) {
    if (!existsSync(resolve(repositoryRoot, path))) add(issues, 'error', 'MISSING_WORKSPACE_MANIFEST', `Missing workspace manifest: ${path}`, path)
  }

  const rootManifest = readJson(repositoryRoot, 'package.json', issues)
  if (rootManifest) {
    const manager = String(rootManifest.packageManager || '')
    if (!/^pnpm@11(?:\.|$)/.test(manager)) add(issues, 'error', 'PACKAGE_MANAGER_NOT_PINNED', 'package.json must pin packageManager to pnpm 11.x', 'package.json')
    const nodeEngine = String(rootManifest.engines?.node || '')
    if (!nodeEngine.includes('20') && !nodeEngine.includes('22') && !nodeEngine.includes('24')) add(issues, 'warning', 'NODE_ENGINE_UNCLEAR', `Unexpected Node engine range: ${nodeEngine || '(missing)'}`, 'package.json')
  }

  for (const [path, scripts] of Object.entries(WORKSPACE_REQUIREMENTS)) {
    if (!existsSync(resolve(repositoryRoot, path))) continue
    const manifest = path === 'package.json' ? rootManifest : readJson(repositoryRoot, path, issues)
    issues.push(...validateManifestScripts(path, manifest, scripts))
  }

  if (existsSync(resolve(repositoryRoot, 'pnpm-lock.yaml'))) {
    const lockfileVersion = parsePnpmLockfileVersion(readFileSync(resolve(repositoryRoot, 'pnpm-lock.yaml'), 'utf8'))
    if (lockfileVersion !== '9.0') add(issues, 'error', 'LOCKFILE_VERSION_MISMATCH', `Expected pnpm lockfileVersion 9.0, found ${lockfileVersion || '(missing)'}`, 'pnpm-lock.yaml')
  }

  if (existsSync(resolve(repositoryRoot, 'pnpm-workspace.yaml'))) {
    const workspace = readFileSync(resolve(repositoryRoot, 'pnpm-workspace.yaml'), 'utf8')
    for (const pattern of ['apps/*', 'packages/*']) {
      if (!workspace.includes(pattern)) add(issues, 'error', 'WORKSPACE_PATTERN_MISSING', `pnpm-workspace.yaml does not include ${pattern}`, 'pnpm-workspace.yaml')
    }
  }

  const nodeVersion = process.version
  const nodeMajor = parseMajorVersion(nodeVersion)
  tools.node = { available: true, detail: nodeVersion }
  if (!nodeMajor || nodeMajor < 20) add(issues, 'error', 'NODE_TOO_OLD', `Node.js 20 or newer is required; found ${nodeVersion}`)
  else if (nodeMajor < 24) add(issues, 'warning', 'NODE_BELOW_RC_BASELINE', `RC CI uses Node.js 24; found ${nodeVersion}`)

  const pnpm = commandVersion('pnpm')
  tools.pnpm = pnpm
  if (!pnpm.available) add(issues, 'error', 'PNPM_UNAVAILABLE', `pnpm is required: ${pnpm.detail}`)
  else if (parseMajorVersion(pnpm.detail) !== 11) add(issues, 'error', 'PNPM_VERSION_MISMATCH', `pnpm 11.x is required; found ${pnpm.detail}`)

  const requiredTools = profile === 'release' ? RELEASE_TOOLS : []
  for (const command of requiredTools) {
    const result = commandVersion(command)
    tools[command] = result
    if (!result.available) add(issues, 'warning', 'RELEASE_TOOL_UNAVAILABLE', `${command} is unavailable on this host: ${result.detail}`)
  }

  if (profile !== 'core') {
    const playwrightCache = environment.PLAYWRIGHT_BROWSERS_PATH || resolve(repositoryRoot, 'node_modules/.cache/ms-playwright')
    if (!existsSync(playwrightCache)) add(issues, 'warning', 'PLAYWRIGHT_BROWSER_NOT_INSTALLED', `Playwright browser cache was not found at ${playwrightCache}`)
  }

  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  return {
    schemaVersion: 1,
    profile,
    root: repositoryRoot,
    ok: errors.length === 0 && (!strictWarnings || warnings.length === 0),
    strictWarnings,
    issues,
    counts: { errors: errors.length, warnings: warnings.length },
    tools,
  }
}

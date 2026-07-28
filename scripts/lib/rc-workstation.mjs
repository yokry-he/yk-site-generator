import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const WORKSTATION_PATHS = Object.freeze({
  dockerfile: 'infra/rc-workstation/Dockerfile',
  compose: 'infra/rc-workstation/compose.yml',
  lock: 'infra/rc-workstation/images.lock.json',
})

const REQUIRED_SERVICES = Object.freeze(['workstation', 'mysql', 'postgres', 'redis'])
const REQUIRED_VOLUMES = Object.freeze(['pnpm-store', 'maven-cache', 'go-cache', 'uv-cache', 'mysql-data', 'postgres-data', 'redis-data'])
const FORBIDDEN_COMPOSE = Object.freeze([
  ['WORKSTATION_PRIVILEGED', /privileged:\s*true/i],
  ['WORKSTATION_HOST_NETWORK', /network_mode:\s*host/i],
  ['WORKSTATION_HOST_PID', /pid:\s*host/i],
  ['WORKSTATION_DOCKER_SOCKET', /\/var\/run\/docker\.sock/i],
  ['WORKSTATION_PUBLISHED_PORT', /^\s*ports:\s*$/im],
])

function finding(code, path, message) {
  return { severity: 'error', code, path, message }
}

function count(value, pattern) {
  return [...String(value).matchAll(pattern)].length
}

export function validateWorkstationText({ dockerfile, compose, lock }) {
  const issues = []
  let parsedLock
  try {
    parsedLock = JSON.parse(lock)
  } catch (error) {
    issues.push(finding('WORKSTATION_LOCK_INVALID', WORKSTATION_PATHS.lock, error instanceof Error ? error.message : String(error)))
    return issues
  }

  for (const [name, image] of Object.entries(parsedLock.images ?? {})) {
    if (!String(dockerfile).includes(String(image))) {
      issues.push(finding('WORKSTATION_IMAGE_LOCK_DRIFT', WORKSTATION_PATHS.dockerfile, `Dockerfile does not reference locked ${name} image ${image}`))
    }
  }

  for (const token of ['USER siteforge:siteforge', 'ARG USER_UID=10001', 'pnpm@${PNPM_VERSION}', 'uv python install', 'postgresql-client', 'default-mysql-client', 'redis-tools']) {
    if (!String(dockerfile).includes(token)) issues.push(finding('WORKSTATION_DOCKERFILE_POLICY', WORKSTATION_PATHS.dockerfile, `Dockerfile is missing ${token}`))
  }
  if (/curl\s+[^\n|]+\|\s*(?:sh|bash)/i.test(String(dockerfile))) {
    issues.push(finding('WORKSTATION_CURL_PIPE_SHELL', WORKSTATION_PATHS.dockerfile, 'Dockerfile must not execute remote curl output through a shell'))
  }

  for (const service of REQUIRED_SERVICES) {
    if (!new RegExp(`^  ${service}:\\s*$`, 'm').test(String(compose))) {
      issues.push(finding('WORKSTATION_SERVICE_MISSING', WORKSTATION_PATHS.compose, `Compose service ${service} is missing`))
    }
  }
  for (const [code, pattern] of FORBIDDEN_COMPOSE) {
    if (pattern.test(String(compose))) issues.push(finding(code, WORKSTATION_PATHS.compose, `Compose violates ${code}`))
  }
  if (!/^  rc-internal:\s*\n    internal:\s*true\s*$/m.test(String(compose))) {
    issues.push(finding('WORKSTATION_INTERNAL_NETWORK_MISSING', WORKSTATION_PATHS.compose, 'rc-internal must be an internal network'))
  }
  if (count(compose, /cap_drop:\s*\[ALL\]/g) < 4) issues.push(finding('WORKSTATION_CAP_DROP_MISSING', WORKSTATION_PATHS.compose, 'Every service must drop all Linux capabilities'))
  if (count(compose, /no-new-privileges:true/g) < 4) issues.push(finding('WORKSTATION_NO_NEW_PRIVILEGES_MISSING', WORKSTATION_PATHS.compose, 'Every service must enable no-new-privileges'))
  if (count(compose, /^    healthcheck:\s*$/gm) < 4) issues.push(finding('WORKSTATION_HEALTHCHECK_MISSING', WORKSTATION_PATHS.compose, 'Every service must define a healthcheck'))
  if (count(compose, /^    pids_limit:\s*\d+/gm) < 4) issues.push(finding('WORKSTATION_PID_LIMIT_MISSING', WORKSTATION_PATHS.compose, 'Every service must define pids_limit'))
  for (const volume of REQUIRED_VOLUMES) {
    if (!new RegExp(`^  ${volume}:`, 'm').test(String(compose))) issues.push(finding('WORKSTATION_VOLUME_MISSING', WORKSTATION_PATHS.compose, `Named volume ${volume} is missing`))
  }
  for (const token of [
    '../..:/workspace',
    'rc-internal',
    'rc-egress',
    'condition: service_healthy',
    'PLAYWRIGHT_BROWSERS_PATH: /ms-playwright',
    'RC_POSTGRES_HOST: postgres',
    'RC_POSTGRES_PORT: "5432"',
    'RC_POSTGRES_USER: siteforge',
    'RC_POSTGRES_PASSWORD: siteforge-local',
    'RC_POSTGRES_ADMIN_DATABASE: postgres',
  ]) {
    if (!String(compose).includes(token)) issues.push(finding('WORKSTATION_COMPOSE_POLICY', WORKSTATION_PATHS.compose, `Compose is missing ${token}`))
  }
  return issues
}

export function validateWorkstation(root = process.cwd()) {
  const files = {}
  const issues = []
  for (const [key, path] of Object.entries(WORKSTATION_PATHS)) {
    const target = resolve(root, path)
    if (!existsSync(target)) {
      issues.push(finding('WORKSTATION_FILE_MISSING', path, `Required workstation file ${path} is missing`))
      continue
    }
    files[key] = readFileSync(target, 'utf8')
  }
  if (issues.length) return { schemaVersion: 1, ok: false, issues }
  issues.push(...validateWorkstationText(files))
  return { schemaVersion: 1, ok: issues.length === 0, issues }
}

export function workstationCommand(command) {
  const compose = ['compose', '-f', WORKSTATION_PATHS.compose]
  const shell = (profile) => [
    ...compose,
    'run', '--rm', 'workstation', 'bash', '-lc',
    `pnpm rc:deps && pnpm rc:gates:${profile}; status=$?; pnpm rc:triage --scope=workstation-${profile} --allow-missing --fail-on=never; exit $status`,
  ]
  const commands = {
    build: [...compose, 'build', 'workstation'],
    up: [...compose, 'up', '-d', '--wait', 'mysql', 'postgres', 'redis'],
    down: [...compose, 'down', '--remove-orphans'],
    core: shell('core'),
    full: shell('full'),
    shell: [...compose, 'run', '--rm', 'workstation', 'bash'],
  }
  if (!commands[command]) throw new Error(`UNKNOWN_WORKSTATION_COMMAND:${command}`)
  return { executable: 'docker', args: commands[command] }
}

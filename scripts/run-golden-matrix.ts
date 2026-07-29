import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BACKEND_STACK_PROFILES } from '../packages/shared/src/backendStacks'
import { GOLDEN_PROJECTS } from './lib/rc-golden-fixture'

const args = process.argv.slice(2)
const execute = args.includes('--execute')
const projectIndex = args.indexOf('--project')
const requested = projectIndex === -1 ? '' : args[projectIndex + 1] ?? ''
const selected = requested ? GOLDEN_PROJECTS.filter((item) => item.id === requested) : GOLDEN_PROJECTS
if (!selected.length) throw new Error(`Unknown Golden Project: ${requested}`)

const logs = path.resolve('artifacts/rc-matrix')
await mkdir(logs, { recursive: true })

const postgresConfig = {
  host: process.env.RC_POSTGRES_HOST || process.env.PGHOST || '127.0.0.1',
  port: Number.parseInt(process.env.RC_POSTGRES_PORT || process.env.PGPORT || '5432', 10),
  user: process.env.RC_POSTGRES_USER || process.env.PGUSER || 'siteforge',
  password: process.env.RC_POSTGRES_PASSWORD || process.env.PGPASSWORD || 'siteforge',
  adminDatabase: process.env.RC_POSTGRES_ADMIN_DATABASE || 'postgres',
  databasePrefix: process.env.RC_POSTGRES_DATABASE_PREFIX || 'sf_',
}
if (!Number.isInteger(postgresConfig.port) || postgresConfig.port < 1 || postgresConfig.port > 65535) {
  throw new Error(`Invalid RC_POSTGRES_PORT: ${postgresConfig.port}`)
}
if (!/^[a-zA-Z0-9_.-]+$/.test(postgresConfig.host)) throw new Error(`Invalid RC_POSTGRES_HOST: ${postgresConfig.host}`)
if (!/^[a-zA-Z0-9_]+$/.test(postgresConfig.user)) throw new Error(`Invalid RC_POSTGRES_USER: ${postgresConfig.user}`)
if (!/^[a-zA-Z0-9_]+$/.test(postgresConfig.adminDatabase)) throw new Error(`Invalid RC_POSTGRES_ADMIN_DATABASE: ${postgresConfig.adminDatabase}`)
if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(postgresConfig.databasePrefix)) throw new Error(`Invalid RC_POSTGRES_DATABASE_PREFIX: ${postgresConfig.databasePrefix}`)

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function command(value: string, cwd: string, env: NodeJS.ProcessEnv, logName = path.basename(cwd)): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const output: string[] = []
    const child = spawn(value, { cwd, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      output.push(String(chunk))
    })
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      output.push(String(chunk))
    })
    child.on('error', reject)
    child.on('exit', async (code) => {
      await writeFile(path.join(logs, `${logName}.log`), output.join(''), 'utf8')
      code === 0 ? resolvePromise() : reject(new Error(`${value} exited with ${code}`))
    })
  })
}

function databaseUrl(name: string): string {
  const host = postgresConfig.host.includes(':') ? `[${postgresConfig.host}]` : postgresConfig.host
  return `postgresql://${encodeURIComponent(postgresConfig.user)}:${encodeURIComponent(postgresConfig.password)}@${host}:${postgresConfig.port}/${name}`
}

async function postgresDatabase(id: string): Promise<string> {
  const suffix = id.replace(/[^a-z0-9]/g, '_')
  const name = `${postgresConfig.databasePrefix}${suffix}`
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) throw new Error(`Invalid generated PostgreSQL database name: ${name}`)
  const base = [
    'psql',
    '-h', shellQuote(postgresConfig.host),
    '-p', String(postgresConfig.port),
    '-U', shellQuote(postgresConfig.user),
    '-d', shellQuote(postgresConfig.adminDatabase),
    '-v', 'ON_ERROR_STOP=1',
  ].join(' ')
  const env = { ...process.env, PGPASSWORD: postgresConfig.password }
  await command(`${base} -c ${shellQuote(`DROP DATABASE IF EXISTS ${name}`)}`, process.cwd(), env, `${id}-database-drop`)
  await command(`${base} -c ${shellQuote(`CREATE DATABASE ${name}`)}`, process.cwd(), env, `${id}-database-create`)
  return databaseUrl(name)
}

async function waitForHealth(url: string, child: ReturnType<typeof spawn>): Promise<void> {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`service exited before health check: ${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000))
  }
  throw new Error(`health check timeout: ${url}`)
}

async function smoke(base: string): Promise<void> {
  const password = 'Golden-Project-Password-2026!'
  const body = { email: 'admin@example.com', password }
  let token = ''
  for (const endpoint of ['bootstrap', 'login']) {
    const response = await fetch(`${base}/api/auth/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (response.ok) {
      const data = await response.json() as { token?: string }
      token = data.token ?? token
    }
  }
  if (token) {
    const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${token}` } })
    if (!me.ok) throw new Error(`authenticated smoke failed: ${me.status}`)
  }
}

for (const spec of selected) {
  const profile = BACKEND_STACK_PROFILES.find((item) => item.id === spec.stack)
  if (!profile) throw new Error(`Missing profile ${spec.stack}`)
  const cwd = path.resolve('artifacts/golden-projects', spec.id)
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    API_PORT: '8787',
    AUTH_ENABLED: 'true',
    AUTH_BOOTSTRAP_EMAIL: 'admin@example.com',
    AUTH_BOOTSTRAP_PASSWORD: 'Golden-Project-Password-2026!',
    AUTH_AUDIT_HASH_KEY: 'golden-project-audit-hash-key-2026-change-me',
    AUTH_LOGIN_LIMIT_DRIVER: 'database',
  }
  if (spec.database === 'postgresql') env.DATABASE_URL = await postgresDatabase(spec.id)
  const steps = [profile.commands.install, profile.commands.migrate, profile.commands.build, profile.commands.test]
  console.log(`matrix · ${spec.id} · ${steps.join(' → ')}`)
  if (!execute) continue
  for (const step of steps) await command(step, cwd, env, spec.id)
  const service = spawn(profile.commands.dev, { cwd, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  service.stdout.pipe(process.stdout)
  service.stderr.pipe(process.stderr)
  try {
    await waitForHealth('http://127.0.0.1:8787/api/health', service)
    await smoke('http://127.0.0.1:8787')
  } finally {
    service.kill('SIGTERM')
    setTimeout(() => service.kill('SIGKILL'), 5_000).unref()
  }
}
console.log(`RC runtime matrix ${execute ? 'completed' : 'plan completed'} for ${selected.length} project(s).`)

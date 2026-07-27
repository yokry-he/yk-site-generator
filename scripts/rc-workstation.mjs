import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateWorkstation, workstationCommand } from './lib/rc-workstation.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const value = (name, fallback = '') => args.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const command = value('command', 'plan')
const planOnly = command === 'plan' || args.includes('--plan')
const selected = value('run', 'core')
const validation = validateWorkstation(root)
if (!validation.ok) {
  for (const issue of validation.issues) console.error(`${issue.code}: ${issue.message}`)
  process.exitCode = 1
} else if (planOnly) {
  for (const name of ['build', 'up', 'core', 'full', 'shell', 'down']) {
    const item = workstationCommand(name)
    console.log(`${name}: ${item.executable} ${item.args.map((part) => JSON.stringify(part)).join(' ')}`)
  }
} else {
  const item = workstationCommand(selected || command)
  const result = spawnSync(item.executable, item.args, { cwd: root, stdio: 'inherit', env: process.env, windowsHide: true })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateWorkstationText, workstationCommand } from './lib/rc-workstation.mjs'

const root = resolve(import.meta.dirname, '..')
const fixture = {
  dockerfile: readFileSync(resolve(root, 'infra/rc-workstation/Dockerfile'), 'utf8'),
  compose: readFileSync(resolve(root, 'infra/rc-workstation/compose.yml'), 'utf8'),
  lock: readFileSync(resolve(root, 'infra/rc-workstation/images.lock.json'), 'utf8'),
}

test('workstation policy accepts the repository specification', () => {
  assert.deepEqual(validateWorkstationText(fixture), [])
})

test('workstation policy rejects host exposure and privileged mode', () => {
  const issues = validateWorkstationText({ ...fixture, compose: `${fixture.compose}\nprivileged: true\nports:\n` })
  assert.ok(issues.some((issue) => issue.code === 'WORKSTATION_PRIVILEGED'))
  assert.ok(issues.some((issue) => issue.code === 'WORKSTATION_PUBLISHED_PORT'))
})

test('workstation policy rejects dangerous or incomplete capability additions', () => {
  const dangerous = validateWorkstationText({ ...fixture, compose: `${fixture.compose}\n    cap_add: [SYS_ADMIN]\n` })
  assert.ok(dangerous.some((issue) => issue.code === 'WORKSTATION_DANGEROUS_CAPABILITY'))
  const incomplete = validateWorkstationText({ ...fixture, compose: fixture.compose.replace('cap_add: [CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID]', 'cap_add: [CHOWN]') })
  assert.ok(incomplete.some((issue) => issue.code === 'WORKSTATION_DATABASE_CAPABILITIES_INVALID'))
})

test('workstation policy rejects image-lock drift', () => {
  const lock = JSON.stringify({ schemaVersion: 1, images: { runtime: 'example.invalid/runtime:1' } })
  assert.ok(validateWorkstationText({ ...fixture, lock }).some((issue) => issue.code === 'WORKSTATION_IMAGE_LOCK_DRIFT'))
})

test('workstation commands use the canonical compose file', () => {
  const command = workstationCommand('core')
  assert.equal(command.executable, 'docker')
  assert.deepEqual(command.args.slice(0, 3), ['compose', '-f', 'infra/rc-workstation/compose.yml'])
  assert.match(command.args.at(-1), /rc:gates:core/)
  assert.throws(() => workstationCommand('unknown'), /UNKNOWN_WORKSTATION_COMMAND/)
})

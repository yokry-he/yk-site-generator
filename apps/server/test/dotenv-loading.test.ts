import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadEnvironmentFile } from '../src/lib/load-environment'

const FILE_VALUE = 'SITEFORGE_DOTENV_FILE_VALUE'
const EXISTING_VALUE = 'SITEFORGE_DOTENV_EXISTING_VALUE'
const temporaryDirectories: string[] = []

afterEach(async () => {
  delete process.env[FILE_VALUE]
  delete process.env[EXISTING_VALUE]
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function temporaryEnvFile(content: string): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'siteforge-dotenv-'))
  temporaryDirectories.push(directory)
  const file = path.join(directory, '.env')
  await writeFile(file, content, 'utf8')
  return file
}

describe('dotenv environment loading', () => {
  it('loads values from the requested file without overriding process variables', async () => {
    process.env[EXISTING_VALUE] = 'from-process'
    const file = await temporaryEnvFile([
      `${FILE_VALUE}=from-file`,
      `${EXISTING_VALUE}=from-file`,
      '',
    ].join('\n'))

    loadEnvironmentFile(file)

    expect(process.env[FILE_VALUE]).toBe('from-file')
    expect(process.env[EXISTING_VALUE]).toBe('from-process')
  })

  it('allows the local env file to be absent in CI and managed deployments', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'siteforge-dotenv-missing-'))
    temporaryDirectories.push(directory)
    expect(() => loadEnvironmentFile(path.join(directory, '.env'))).not.toThrow()
  })
})

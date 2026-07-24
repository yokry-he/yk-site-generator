import json
from pathlib import Path

package_path = Path('apps/server/package.json')
package = json.loads(package_path.read_text())
package.setdefault('dependencies', {})['dotenv'] = '^17.4.2'
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n')

Path('apps/server/src/lib/load-environment.ts').write_text("""import { config } from 'dotenv'

/** Load a dotenv file without overriding values injected by the OS or deployment platform. */
export function loadEnvironmentFile(path: string): void {
  const result = config({ path, override: false, quiet: true })
  if (!result.error) return

  const code = (result.error as NodeJS.ErrnoException).code
  if (code === 'ENOENT') return

  throw new Error(`ENV_FILE_LOAD_FAILED ${path}: ${result.error.message}`)
}
""")

env_path = Path('apps/server/src/env.ts')
env_source = env_path.read_text()
marker = "import { z } from 'zod'\n"
replacement = "import { fileURLToPath } from 'node:url'\nimport { z } from 'zod'\nimport { loadEnvironmentFile } from './lib/load-environment'\n\nloadEnvironmentFile(fileURLToPath(new URL('../.env', import.meta.url)))\n"
if "loadEnvironmentFile(fileURLToPath" not in env_source:
    if marker not in env_source:
        raise SystemExit('env.ts import marker not found')
    env_path.write_text(env_source.replace(marker, replacement, 1))

Path('apps/server/test/dotenv-loading.test.ts').write_text("""import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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
""")

readme_path = Path('README.md')
readme = readme_path.read_text()
before = """pnpm install
cp apps/server/.env.example apps/server/.env
pnpm dev
```

默认地址："""
after = """pnpm install
cp apps/server/.env.example apps/server/.env
pnpm dev
```

服务端通过 `dotenv` 自动加载 `apps/server/.env`，无需在终端执行 `source`。操作系统、Docker、CI 或部署平台已经注入的环境变量优先，不会被本地文件覆盖；修改 `.env` 后需重启服务端进程。

默认地址："""
if before not in readme:
    raise SystemExit('README local development marker not found')
readme_path.write_text(readme.replace(before, after, 1))

import { config } from 'dotenv'

/** Load a dotenv file without overriding values injected by the OS or deployment platform. */
export function loadEnvironmentFile(path: string): void {
  const result = config({ path, override: false, quiet: true })
  if (!result.error) return

  const code = (result.error as NodeJS.ErrnoException).code
  if (code === 'ENOENT') return

  throw new Error(`ENV_FILE_LOAD_FAILED ${path}: ${result.error.message}`)
}

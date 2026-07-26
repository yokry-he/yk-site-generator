import {
  normalizeManualAccess,
  type ArtifactFile,
  type BackendDatabaseId,
  type BackendStackId,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
} from 'shared'
import {
  applySessionRuntimeFrontend,
  applySessionRuntimeOpenApi,
  sessionRuntimeGuideFile,
  sessionRuntimePolicyFile,
} from './manualSessionRuntimeCommon'
import { ginSessionRuntime } from './manualSessionRuntimeGo'
import { springSessionRuntime } from './manualSessionRuntimeJava'
import { honoSessionRuntime, nestSessionRuntime } from './manualSessionRuntimeNode'
import { fastApiSessionRuntime } from './manualSessionRuntimePython'

export function applyManualSessionRuntime(
  inputFiles: ArtifactFile[],
  stack: BackendStackId,
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
  input?: ManualAccessDefinition,
): ArtifactFile[] {
  const access = normalizeManualAccess(input, entities)
  const files = inputFiles.map((file) => ({ ...file }))
  if (!access.enabled || !access.persistentSessions) return files

  applySessionRuntimeFrontend(files)
  applySessionRuntimeOpenApi(files)
  const stackFiles = stack === 'hono-drizzle'
    ? honoSessionRuntime(files, database, access, entities)
    : stack === 'nestjs-prisma'
      ? nestSessionRuntime(files, access, entities)
      : stack === 'fastapi-sqlalchemy'
        ? fastApiSessionRuntime(files, access, entities)
        : stack === 'spring-boot-jpa'
          ? springSessionRuntime(access, entities)
          : ginSessionRuntime(files, access, entities)

  const byPath = new Map(files.map((file) => [file.path, file]))
  for (const file of stackFiles) byPath.set(file.path, file)
  byPath.set('siteforge.session.json', sessionRuntimePolicyFile(access))
  byPath.set('SESSION_SECURITY.md', sessionRuntimeGuideFile(access))
  return [...byPath.values()]
}

import type { ArtifactFile, BackendDatabaseId, BackendStackId, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { appendEnvironment, guideFile, updateOpenApi, updatePolicy } from './manualSessionProtectionCommon'
import { ginProtection } from './manualSessionProtectionGo'
import { honoProtection } from './manualSessionProtectionHono'
import { springProtection } from './manualSessionProtectionJava'
import { nestProtection } from './manualSessionProtectionNest'
import { fastApiProtection } from './manualSessionProtectionPython'

export function applyManualSessionProtection(
  inputFiles: ArtifactFile[],
  stack: BackendStackId,
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
  access: ManualAccessDefinition,
): ArtifactFile[] {
  const files = inputFiles.map((file) => ({ ...file }))
  if (!access.enabled || !access.persistentSessions) return files
  appendEnvironment(files)
  updatePolicy(files)
  updateOpenApi(files)
  const stackFiles = stack === 'hono-drizzle'
    ? honoProtection(files, access, entities)
    : stack === 'nestjs-prisma'
      ? nestProtection(files, access, entities)
      : stack === 'fastapi-sqlalchemy'
        ? fastApiProtection(files, access, entities)
        : stack === 'spring-boot-jpa'
          ? springProtection(files, access, entities)
          : ginProtection(files, access, entities, database)
  const byPath = new Map(files.map((file) => [file.path, file]))
  for (const file of stackFiles) byPath.set(file.path, file)
  byPath.set('AUTH_PROTECTION.md', guideFile())
  return [...byPath.values()]
}

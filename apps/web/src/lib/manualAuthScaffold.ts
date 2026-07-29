import {
  normalizeManualAccess,
  type ArtifactFile,
  type BackendDatabaseId,
  type BackendStackId,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
} from 'shared'
import {
  authEnvFile,
  authGuideFile,
  authPolicyFile,
  frontendAuthFiles,
  openApiAuth,
} from './manualAuthCommon'
import { ginAuth } from './manualAuthGo'
import { springAuth } from './manualAuthJava'
import { honoAuth, nestAuth } from './manualAuthNode'
import { fastApiAuth } from './manualAuthPython'

export function applyManualAuthorization(
  inputFiles: ArtifactFile[],
  stack: BackendStackId,
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
  input?: ManualAccessDefinition,
): ArtifactFile[] {
  const access = normalizeManualAccess(input, entities)
  const files = inputFiles.map((file) => ({ ...file }))
  if (!access.enabled) {
    return [
      ...files,
      authPolicyFile(access, entities),
      authEnvFile(database),
      authGuideFile(access),
    ]
  }

  const backendFiles = stack === 'hono-drizzle'
    ? honoAuth(files, access, entities)
    : stack === 'nestjs-prisma'
      ? nestAuth(files, access, entities)
      : stack === 'fastapi-sqlalchemy'
        ? fastApiAuth(files, access, entities)
        : stack === 'spring-boot-jpa'
          ? springAuth(access, entities)
          : ginAuth(files, access, entities)

  openApiAuth(files)
  const frontendFiles = frontendAuthFiles(files)
  return [
    ...files,
    ...frontendFiles,
    ...backendFiles,
    authPolicyFile(access, entities),
    authEnvFile(database),
    authGuideFile(access),
  ]
}

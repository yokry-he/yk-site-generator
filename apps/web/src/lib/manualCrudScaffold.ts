import {
  type ArtifactFile,
  type BackendDatabaseId,
  type BackendStackId,
  type ManualEntityDefinition,
} from 'shared'
import { ginCrudFiles } from './manualCrudGoBackend'
import { manualCrudFrontendFiles } from './manualCrudFrontend'
import { springCrudFiles } from './manualCrudJavaBackend'
import { honoCrudFiles, nestCrudFiles } from './manualCrudNodeBackends'
import { openApiFile } from './manualCrudOpenApi'
import { fastApiCrudFiles } from './manualCrudPythonBackend'

export function manualCrudFiles(
  projectName: string,
  stack: BackendStackId,
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const backend = stack === 'hono-drizzle'
    ? honoCrudFiles(database, entities)
    : stack === 'nestjs-prisma'
      ? nestCrudFiles(database, entities)
      : stack === 'fastapi-sqlalchemy'
        ? fastApiCrudFiles(entities)
        : stack === 'spring-boot-jpa'
          ? springCrudFiles(entities)
          : ginCrudFiles(database, entities)

  return [
    ...manualCrudFrontendFiles(projectName, entities),
    ...backend,
    openApiFile(projectName, entities),
  ]
}

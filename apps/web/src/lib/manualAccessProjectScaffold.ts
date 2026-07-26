import JSZip from 'jszip'
import {
  normalizeManualAccess,
  normalizeManualEntities,
  type ManualAccessDefinition,
} from 'shared'
import {
  createManualProjectScaffold,
  type ManualProjectInput,
  type ManualProjectScaffold,
} from './manualProjectScaffold'
import { manualCrudFiles } from './manualCrudScaffold'
import { applyManualSessionData } from './manualSessionDataScaffold'
import { applyManualSessionRuntime } from './manualSessionRuntimeScaffold'
import { applyManualSessionProtection } from './manualSessionProtectionScaffold'
import { applyManualFineAuthorization } from './manualFineAuthorizationScaffold'

export interface ManualAccessProjectInput extends ManualProjectInput {
  access?: ManualAccessDefinition
}

export interface ManualAccessProjectScaffold extends ManualProjectScaffold {
  access: ManualAccessDefinition
}

export function createManualAccessProjectScaffold(
  input: ManualAccessProjectInput,
): ManualAccessProjectScaffold {
  const entities = normalizeManualEntities(input.entities)
  const access = normalizeManualAccess(input.access, entities)
  const baseInput: ManualProjectInput = {
    name: input.name,
    description: input.description,
    backendStack: input.backendStack,
    database: input.database,
    includeDocker: input.includeDocker,
    includeGithubActions: input.includeGithubActions,
    entities,
  }
  const base = createManualProjectScaffold(baseInput)
  const filesByPath = new Map(base.files.map((file) => [file.path, file]))
  const defaultCrudFiles = manualCrudFiles(base.manifest.name, input.backendStack, input.database, entities)
  for (const file of defaultCrudFiles) filesByPath.delete(file.path)

  for (const file of manualCrudFiles(base.manifest.name, input.backendStack, input.database, entities, access)) {
    filesByPath.set(file.path, file)
  }

  const sessionDataFiles = applyManualSessionData([...filesByPath.values()], input.backendStack, input.database, entities, access)
  const sessionRuntimeFiles = applyManualSessionRuntime(sessionDataFiles, input.backendStack, input.database, entities, access)
  const protectedFiles = applyManualSessionProtection(sessionRuntimeFiles, input.backendStack, input.database, entities, access)
  const files = applyManualFineAuthorization(protectedFiles, input.backendStack, entities, access)

  return { ...base, files, access }
}

export async function buildManualAccessProjectZip(input: ManualAccessProjectInput): Promise<Blob> {
  const scaffold = createManualAccessProjectScaffold(input)
  const zip = new JSZip()
  for (const file of scaffold.files) zip.file(file.path, file.content)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

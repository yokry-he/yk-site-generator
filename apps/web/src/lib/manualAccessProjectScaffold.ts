import JSZip from 'jszip'
import { normalizeManualAccess, normalizeManualEntities, type ManualAccessDefinition } from 'shared'
import { createManualProjectScaffold, type ManualProjectInput, type ManualProjectScaffold } from './manualProjectScaffold'
import { manualCrudFiles } from './manualCrudScaffold'
import { applyManualSessionData } from './manualSessionDataScaffold'
import { applyManualSessionRuntime } from './manualSessionRuntimeScaffold'
import { applyManualSessionProtection } from './manualSessionProtectionScaffold'
import { applyManualFineAuthorization } from './manualFineAuthorizationScaffold'
import { applyManualDistributedLogin } from './manualDistributedLoginScaffold'

export interface ManualAccessProjectInput extends ManualProjectInput { access?: ManualAccessDefinition }
export interface ManualAccessProjectScaffold extends ManualProjectScaffold { access: ManualAccessDefinition }

export function createManualAccessProjectScaffold(input: ManualAccessProjectInput): ManualAccessProjectScaffold {
  const entities = normalizeManualEntities(input.entities)
  const access = normalizeManualAccess(input.access, entities)
  const base = createManualProjectScaffold({ name: input.name, description: input.description, backendStack: input.backendStack, database: input.database, includeDocker: input.includeDocker, includeGithubActions: input.includeGithubActions, entities })
  const filesByPath = new Map(base.files.map((file) => [file.path, file]))
  for (const file of manualCrudFiles(base.manifest.name, input.backendStack, input.database, entities)) filesByPath.delete(file.path)
  for (const file of manualCrudFiles(base.manifest.name, input.backendStack, input.database, entities, access)) filesByPath.set(file.path, file)
  const sessionData = applyManualSessionData([...filesByPath.values()], input.backendStack, input.database, entities, access)
  const sessionRuntime = applyManualSessionRuntime(sessionData, input.backendStack, input.database, entities, access)
  const sessionProtection = applyManualSessionProtection(sessionRuntime, input.backendStack, input.database, entities, access)
  const fineAuthorization = applyManualFineAuthorization(sessionProtection, input.backendStack, entities, access)
  const files = applyManualDistributedLogin(fineAuthorization, input.backendStack, access)
  return { ...base, files, access }
}

export async function buildManualAccessProjectZip(input: ManualAccessProjectInput): Promise<Blob> {
  const scaffold = createManualAccessProjectScaffold(input); const zip = new JSZip(); for (const file of scaffold.files) zip.file(file.path, file.content)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

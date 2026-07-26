import JSZip from 'jszip'
import { normalizeManualAccess, normalizeManualEntities, type ManualAccessDefinition } from 'shared'
import { createManualProjectScaffold, type ManualProjectInput, type ManualProjectScaffold } from './manualProjectScaffold'
import { manualCrudFiles } from './manualCrudScaffold'
import { applyManualSessionData } from './manualSessionDataScaffold'
import { applyManualSessionRuntime } from './manualSessionRuntimeScaffold'
import { applyManualSessionProtection } from './manualSessionProtectionScaffold'
import { applyManualFineAuthorization } from './manualFineAuthorizationScaffold'
import { applyManualDistributedLogin } from './manualDistributedLoginScaffold'
import { applyManualSessionDevices } from './manualSessionDevicesScaffold'
import { applyManualPasswordLifecycle } from './manualPasswordLifecycleScaffold'
import { applyManualAdvancedRelations, type AdvancedRelationDefinition } from './manualAdvancedRelationsScaffold'
export interface ManualAccessProjectInput extends ManualProjectInput { access?:ManualAccessDefinition;advancedRelations?:readonly AdvancedRelationDefinition[] }
export interface ManualAccessProjectScaffold extends ManualProjectScaffold { access:ManualAccessDefinition }
export function createManualAccessProjectScaffold(input:ManualAccessProjectInput):ManualAccessProjectScaffold{const entities=normalizeManualEntities(input.entities);const access=normalizeManualAccess(input.access,entities);const base=createManualProjectScaffold({name:input.name,description:input.description,backendStack:input.backendStack,database:input.database,includeDocker:input.includeDocker,includeGithubActions:input.includeGithubActions,entities});const map=new Map(base.files.map((file)=>[file.path,file]));for(const file of manualCrudFiles(base.manifest.name,input.backendStack,input.database,entities))map.delete(file.path);for(const file of manualCrudFiles(base.manifest.name,input.backendStack,input.database,entities,access))map.set(file.path,file);const data=applyManualSessionData([...map.values()],input.backendStack,input.database,entities,access);const runtime=applyManualSessionRuntime(data,input.backendStack,input.database,entities,access);const protection=applyManualSessionProtection(runtime,input.backendStack,input.database,entities,access);const fine=applyManualFineAuthorization(protection,input.backendStack,entities,access);const distributed=applyManualDistributedLogin(fine,input.backendStack,access);const devices=applyManualSessionDevices(distributed,input.backendStack,access);const lifecycle=applyManualPasswordLifecycle(devices,input.backendStack,access);const files=applyManualAdvancedRelations(lifecycle,input.backendStack,entities,input.advancedRelations);return{...base,files,access}}
export async function buildManualAccessProjectZip(input:ManualAccessProjectInput):Promise<Blob>{const scaffold=createManualAccessProjectScaffold(input);const zip=new JSZip();for(const file of scaffold.files)zip.file(file.path,file.content);return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}})}

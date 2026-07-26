import JSZip from 'jszip'
import { normalizeManualAccess,normalizeManualEntities,type ManualAccessDefinition } from 'shared'
import { createManualProjectScaffold,type ManualProjectInput,type ManualProjectScaffold } from './manualProjectScaffold'
import { manualCrudFiles } from './manualCrudScaffold'
import { applyManualSessionData } from './manualSessionDataScaffold'
import { applyManualSessionRuntime } from './manualSessionRuntimeScaffold'
import { applyManualSessionProtection } from './manualSessionProtectionScaffold'
import { applyManualFineAuthorization } from './manualFineAuthorizationScaffold'
import { applyManualDistributedLogin } from './manualDistributedLoginScaffold'
import { applyManualSessionDevices } from './manualSessionDevicesScaffold'
import { applyManualPasswordLifecycle } from './manualPasswordLifecycleScaffold'
import { applyManualAdvancedRelations,type AdvancedRelationDefinition } from './manualAdvancedRelationsScaffold'
import { applyManualEngineeringSchema,type EngineeringSchemaInput } from './manualEngineeringSchemaScaffold'
export interface ManualAccessProjectInput extends ManualProjectInput{access?:ManualAccessDefinition;advancedRelations?:readonly AdvancedRelationDefinition[];engineeringSchema?:EngineeringSchemaInput}
export interface ManualAccessProjectScaffold extends ManualProjectScaffold{access:ManualAccessDefinition}
export function createManualAccessProjectScaffold(input:ManualAccessProjectInput):ManualAccessProjectScaffold{const entities=normalizeManualEntities(input.entities);const access=normalizeManualAccess(input.access,entities);const base=createManualProjectScaffold({name:input.name,description:input.description,backendStack:input.backendStack,database:input.database,includeDocker:input.includeDocker,includeGithubActions:input.includeGithubActions,entities});const map=new Map(base.files.map((file)=>[file.path,file]));for(const file of manualCrudFiles(base.manifest.name,input.backendStack,input.database,entities))map.delete(file.path);for(const file of manualCrudFiles(base.manifest.name,input.backendStack,input.database,entities,access))map.set(file.path,file);let files=applyManualSessionData([...map.values()],input.backendStack,input.database,entities,access);files=applyManualSessionRuntime(files,input.backendStack,input.database,entities,access);files=applyManualSessionProtection(files,input.backendStack,input.database,entities,access);files=applyManualFineAuthorization(files,input.backendStack,entities,access);files=applyManualDistributedLogin(files,input.backendStack,access);files=applyManualSessionDevices(files,input.backendStack,access);files=applyManualPasswordLifecycle(files,input.backendStack,access);files=applyManualAdvancedRelations(files,input.backendStack,entities,input.advancedRelations);files=applyManualEngineeringSchema(files,input.backendStack,input.database,entities,input.engineeringSchema);return{...base,files,access}}
export async function buildManualAccessProjectZip(input:ManualAccessProjectInput):Promise<Blob>{const scaffold=createManualAccessProjectScaffold(input);const zip=new JSZip();for(const file of scaffold.files)zip.file(file.path,file.content);return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}})}

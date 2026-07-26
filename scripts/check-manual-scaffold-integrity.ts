import { createHash } from 'node:crypto'
import { BACKEND_STACK_PROFILES } from '../packages/shared/src/backendStacks'
import { createDefaultManualAccess } from '../packages/shared/src/manualAccess'
import type { ArtifactFile } from '../packages/shared/src/artifact'
import type { BackendDatabaseId, BackendStackId } from '../packages/shared/src/backendStacks'
import type { ManualEntityDefinition } from '../packages/shared/src/manualProject'
import { createManualAccessProjectScaffold, type ManualAccessProjectInput } from '../apps/web/src/lib/manualAccessProjectScaffold'
import type { AdvancedRelationDefinition } from '../apps/web/src/lib/manualAdvancedRelationsScaffold'
import type { EngineeringSchemaInput } from '../apps/web/src/lib/manualEngineeringSchemaScaffold'

type Issue = { combination: string; code: string; message: string; path?: string }
type Summary = { combination: string; files: number; migrations: number; operations: number; fingerprint: string }

const REQUIRED = ['siteforge.json','siteforge.auth.json','siteforge.authorization.json','siteforge.session.json','siteforge.login-limit.json','siteforge.session-devices.json','siteforge.identity-lifecycle.json','siteforge.relations.json','siteforge.engineering-schema.json','openapi.yaml']
const BILINGUAL = new Set(['README.md','AUTHORIZATION.md','SESSION_SECURITY.md','FINE_GRAINED_AUTHORIZATION.md'])

function entities(): ManualEntityDefinition[] { return [
  { name:'Team',label:'团队',pluralLabel:'团队管理',route:'/teams',fields:[
    {name:'name',label:'名称',type:'text',required:true,unique:true,searchable:true,sortable:true,showInList:true,showInForm:true},
    {name:'internalCode',label:'内部编码',type:'text',required:false,searchable:true,sortable:true,showInList:false,showInForm:true},
  ],relations:[],list:{pageSize:20,defaultSortField:'name',defaultSortDirection:'asc'} },
  { name:'User',label:'成员',pluralLabel:'成员管理',route:'/users',fields:[
    {name:'displayName',label:'姓名',type:'text',required:true,searchable:true,sortable:true,showInList:true,showInForm:true},
    {name:'email',label:'邮箱',type:'text',required:true,unique:true,searchable:true,sortable:true,showInList:true,showInForm:true},
    {name:'privateNotes',label:'私密备注',type:'long-text',required:false,searchable:false,sortable:false,showInList:false,showInForm:true},
  ],relations:[{name:'team',label:'团队',targetEntity:'Team',required:true,onDelete:'restrict',sortable:true,showInList:true,showInForm:true}],list:{pageSize:20,defaultSortField:'displayName',defaultSortDirection:'asc'} },
  { name:'Task',label:'任务',pluralLabel:'任务管理',route:'/tasks',fields:[
    {name:'title',label:'标题',type:'text',required:true,searchable:true,sortable:true,showInList:true,showInForm:true},
    {name:'status',label:'状态',type:'enum',required:true,enumValues:['todo','doing','done'],defaultValue:'todo',searchable:true,sortable:true,showInList:true,showInForm:true},
    {name:'cost',label:'成本',type:'decimal',required:false,searchable:false,sortable:true,showInList:false,showInForm:true},
    {name:'dueAt',label:'截止时间',type:'datetime',required:false,searchable:false,sortable:true,showInList:true,showInForm:true},
  ],relations:[
    {name:'owner',label:'负责人',targetEntity:'User',required:true,onDelete:'restrict',sortable:true,showInList:true,showInForm:true},
    {name:'team',label:'团队',targetEntity:'Team',required:true,onDelete:'restrict',sortable:true,showInList:true,showInForm:true},
  ],list:{pageSize:25,defaultSortField:'dueAt',defaultSortDirection:'desc'} },
] }

const advancedRelations: AdvancedRelationDefinition[] = [
  {key:'team-lead',kind:'one-to-one',sourceEntity:'Team',targetEntity:'User',label:'团队负责人'},
  {key:'task-watchers',kind:'many-to-many',sourceEntity:'Task',targetEntity:'User',label:'任务关注者',onDelete:'cascade'},
  {key:'task-dependencies',kind:'self',sourceEntity:'Task',targetEntity:'Task',label:'任务依赖'},
]
const engineeringSchema: EngineeringSchemaInput = { fields:[
  {entity:'Task',name:'attachment',label:'附件',type:'file'}, {entity:'Task',name:'coverImage',label:'封面',type:'image'},
  {entity:'Task',name:'bodyRich',label:'富文本正文',type:'rich-text'}, {entity:'Task',name:'metadata',label:'元数据',type:'json'},
  {entity:'Task',name:'tags',label:'标签',type:'tags'},
], indexes:[{entity:'Task',name:'idx_task_status_owner',fields:['status','ownerId']},{entity:'Task',name:'uq_task_team_title',fields:['teamId','title'],unique:true}] }

function input(stack: BackendStackId, database: BackendDatabaseId): ManualAccessProjectInput {
  const model=entities(); const access=createDefaultManualAccess(model); access.persistentSessions=true; access.session={ttlSeconds:43200,maxActiveSessions:5}
  return {name:`SiteForge RC ${stack} ${database}`,description:'Release-candidate integrity fixture.',backendStack:stack,database,includeDocker:true,includeGithubActions:true,entities:model,access,advancedRelations,engineeringSchema}
}
function fingerprint(files: readonly ArtifactFile[]){const hash=createHash('sha256');for(const file of [...files].sort((a,b)=>a.path.localeCompare(b.path)))hash.update(file.path).update('\0').update(file.content).update('\0');return hash.digest('hex')}
function migrationVersion(path:string){return (path.match(/(?:drizzle\/|migrations\/versions\/)(\d+)_/)??path.match(/db\/migration\/V(\d+)__/)??path.match(/migrations\/(\d+)_/))?.[1]}
function add(issues:Issue[],combination:string,code:string,message:string,path?:string){issues.push({combination,code,message,path})}

function audit(files:ArtifactFile[],combination:string,issues:Issue[]):{migrations:number;operations:number}{
  const paths=new Set<string>(); for(const file of files){if(paths.has(file.path))add(issues,combination,'DUPLICATE_FILE_PATH',`重复路径 ${file.path}`,file.path);paths.add(file.path)}
  for(const path of REQUIRED)if(!paths.has(path))add(issues,combination,'MISSING_PROTOCOL_FILE',`缺少 ${path}`,path)
  for(const file of files.filter((item)=>item.path.endsWith('.json')))try{JSON.parse(file.content)}catch(error){add(issues,combination,'INVALID_JSON',String(error),file.path)}
  const versions=new Map<string,string>();let migrations=0
  for(const file of files){const version=migrationVersion(file.path);if(!version)continue;migrations++;const key=String(Number(version));const previous=versions.get(key);if(previous)add(issues,combination,'DUPLICATE_MIGRATION_VERSION',`${key}: ${previous} / ${file.path}`,file.path);else versions.set(key,file.path)}
  for(const file of files.filter((item)=>/\.(?:ts|tsx|js|mjs|py|java|go)$/.test(item.path))){const seen=new Set<string>();for(const raw of file.content.split(/\r?\n/)){const line=raw.trim();if(!(/^import\b/.test(line)||/^from\s+\S+\s+import\b/.test(line)||/^use\s+\S+/.test(line)))continue;if(seen.has(line))add(issues,combination,'DUPLICATE_IMPORT',line,file.path);seen.add(line)}}
  const openapi=files.find((item)=>item.path==='openapi.yaml');let operations=0
  if(openapi){const openPaths=new Set<string>();const openOperations=new Set<string>();let current='';for(const line of openapi.content.split(/\r?\n/)){const p=line.match(/^  (\/[^:]+):\s*$/);if(p){current=p[1];if(openPaths.has(current))add(issues,combination,'DUPLICATE_OPENAPI_PATH',current,openapi.path);openPaths.add(current);continue}const op=line.match(/^    (get|post|put|patch|delete):\s*$/);if(current&&op){operations++;const key=`${op[1]} ${current}`;if(openOperations.has(key))add(issues,combination,'DUPLICATE_OPENAPI_OPERATION',key,openapi.path);openOperations.add(key)}}for(const marker of ['openapi:','paths:','components:'])if(!openapi.content.includes(marker))add(issues,combination,'OPENAPI_SECTION_MISSING',marker,openapi.path)}
  for(const file of files.filter((item)=>BILINGUAL.has(item.path)))for(const marker of ['[中文]','[English]','## 中文','## English'])if(!file.content.includes(marker))add(issues,combination,'GENERATED_DOC_NOT_BILINGUAL',`${file.path}: ${marker}`,file.path)
  return {migrations,operations}
}

export function runManualScaffoldIntegrityAudit(){const issues:Issue[]=[];const summaries:Summary[]=[];for(const profile of BACKEND_STACK_PROFILES)for(const database of profile.databases){const combination=`${profile.id}/${database}`;try{const fixture=input(profile.id,database);const first=createManualAccessProjectScaffold(fixture);const second=createManualAccessProjectScaffold(fixture);const left=fingerprint(first.files);const right=fingerprint(second.files);if(left!==right)add(issues,combination,'NON_DETERMINISTIC_OUTPUT','相同输入生成摘要不同');const result=audit(first.files,combination,issues);summaries.push({combination,files:first.files.length,migrations:result.migrations,operations:result.operations,fingerprint:left})}catch(error){add(issues,combination,'GENERATION_FAILED',error instanceof Error?error.message:String(error))}}return{issues,summaries}}

const report=runManualScaffoldIntegrityAudit()
for(const item of report.summaries)console.log(`ok · ${item.combination} · ${item.files} files · ${item.migrations} migrations · ${item.operations} operations · ${item.fingerprint.slice(0,12)}`)
if(report.issues.length){console.error(`\nRC scaffold integrity audit failed with ${report.issues.length} issue(s):`);for(const item of report.issues)console.error(`- [${item.combination}] ${item.code}${item.path?` (${item.path})`:''}: ${item.message}`);process.exitCode=1}else console.log(`\nRC scaffold integrity audit passed for ${report.summaries.length} combinations.`)

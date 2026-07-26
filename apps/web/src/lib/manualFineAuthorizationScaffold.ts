import type { ArtifactFile, BackendStackId, ManualAccessDefinition, ManualEntityDefinition } from 'shared'
import { relationIdField } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'

const sensitive = /(password|secret|token|credential|private|internal|salary|cost|ssn)/i
const ownerNames = ['ownerId', 'userId', 'createdById', 'authorId', 'assigneeId']
const teamNames = ['teamId', 'organizationId', 'workspaceId', 'tenantId']

export function compileFineAuthorization(access: ManualAccessDefinition, entities: readonly ManualEntityDefinition[]) {
  return access.roles.map((role) => ({
    role: role.key,
    resources: entities.map((entity) => {
      const fields = [...entity.fields.map((field) => field.name), ...(entity.relations ?? []).map(relationIdField)]
      const permission = role.permissions.find((item) => item.entity === entity.name)
      const canWrite = Boolean(permission?.actions.some((action) => action === 'create' || action === 'update'))
      const scopeField = role.key === 'admin' ? undefined : ownerNames.find((name) => fields.includes(name)) ?? teamNames.find((name) => fields.includes(name))
      return {
        entity: entity.name,
        readableFields: role.key === 'admin' ? fields : fields.filter((field) => !sensitive.test(field)),
        writableFields: canWrite ? (role.key === 'admin' ? fields : fields.filter((field) => !sensitive.test(field))) : [],
        recordScope: !scopeField ? 'all' : ownerNames.includes(scopeField) ? 'owner' : 'team',
        scopeField,
      }
    }),
  }))
}

function adapter(stack: BackendStackId, policy: unknown): ArtifactFile {
  const encoded = JSON.stringify(policy)
  if (stack === 'fastapi-sqlalchemy') return text('apps/api/app/fine_authorization.py', `import json, os\nCOMPILED=json.loads(${JSON.stringify(encoded)})\ndef policies():\n    try: return json.loads(os.getenv('AUTH_FINE_POLICY_JSON','')) or COMPILED\n    except ValueError: return COMPILED\ndef resource(role,entity):\n    item=next((x for x in policies() if x.get('role')==role),None)\n    return next((x for x in item.get('resources',[]) if x.get('entity')==entity),None) if item else None\ndef readable(identity,entity,record):\n    item=resource(identity.get('role',''),entity) or {}; allowed={'id','createdAt','updatedAt',*item.get('readableFields',[])}; return {k:v for k,v in record.items() if k in allowed}\ndef assert_writable(identity,entity,value):\n    allowed=set((resource(identity.get('role',''),entity) or {}).get('writableFields',[])); rejected=[k for k in value if k not in allowed]\n    if rejected: raise PermissionError('FORBIDDEN_FIELDS:'+','.join(rejected))\ndef record_allowed(identity,entity,record):\n    item=resource(identity.get('role',''),entity) or {}; scope=item.get('recordScope','all')\n    if scope=='all': return True\n    expected=identity.get('userId') if scope=='owner' else identity.get('teamId'); return expected is not None and str(record.get(item.get('scopeField'),''))==str(expected)\n`)
  if (stack === 'spring-boot-jpa') return text('apps/api/src/main/java/dev/siteforge/api/FineAuthorization.java', `package dev.siteforge.api;\npublic final class FineAuthorization { public static final String POLICY = ${JSON.stringify(encoded)}; private FineAuthorization() {} }\n`)
  if (stack === 'gin-gorm') return text('apps/api/internal/auth/fine_authorization.go', `package auth\nconst FineAuthorizationPolicy = ${JSON.stringify(encoded)}\n`)
  return text('apps/api/src/fine-authorization.ts', `type Identity={userId:string;role:string;teamId?:string}; const compiled=${encoded} as any[];\nconst policies=()=>{try{return JSON.parse(process.env.AUTH_FINE_POLICY_JSON||'')||compiled}catch{return compiled}};\nconst resource=(role:string,entity:string)=>policies().find((x:any)=>x.role===role)?.resources.find((x:any)=>x.entity===entity);\nexport const readable=(identity:Identity,entity:string,record:Record<string,unknown>)=>{const allowed=new Set(['id','createdAt','updatedAt',...(resource(identity.role,entity)?.readableFields||[])]);return Object.fromEntries(Object.entries(record).filter(([key])=>allowed.has(key)))};\nexport function assertWritable(identity:Identity,entity:string,value:Record<string,unknown>){const allowed=new Set(resource(identity.role,entity)?.writableFields||[]);const rejected=Object.keys(value).filter((key)=>!allowed.has(key));if(rejected.length)throw Object.assign(new Error('FORBIDDEN_FIELDS'),{status:403,fields:rejected})}\nexport function recordAllowed(identity:Identity,entity:string,record:Record<string,unknown>){const item=resource(identity.role,entity);if(!item||item.recordScope==='all')return true;const expected=item.recordScope==='owner'?identity.userId:identity.teamId;return expected!==undefined&&String(record[item.scopeField]??'')===String(expected)}\n`)
}

export function applyManualFineAuthorization(filesInput: ArtifactFile[], stack: BackendStackId, entities: readonly ManualEntityDefinition[], access: ManualAccessDefinition): ArtifactFile[] {
  const files = filesInput.map((file) => ({ ...file }))
  if (!access.enabled) return files
  const policy = compileFineAuthorization(access, entities)
  replaceFile(files, '.env.example', (value) => value.includes('AUTH_FINE_POLICY_JSON=') ? value : `${value.trimEnd()}\nAUTH_FINE_POLICY_JSON=\n`)
  replaceFile(files, 'openapi.yaml', (value) => value.includes('x-siteforge-fine-authorization:') ? value : `${value.trimEnd()}\nx-siteforge-fine-authorization:\n  manifest: siteforge.authorization.json\n`)
  return [
    ...files,
    adapter(stack, policy),
    text('siteforge.authorization.json', JSON.stringify({ schemaVersion: 1, strategy: 'field-and-record', identityClaims: { owner: 'userId', team: 'teamId' }, roles: policy }, null, 2)),
    text('FINE_GRAINED_AUTHORIZATION.md', '# Fine-grained Authorization / 字段与记录级授权\n\n[中文](#中文) · [English](#english)\n\n## 中文\n\n生成工程包含字段白名单、敏感字段保护和 owner/team 记录范围适配器。运行时可用 `AUTH_FINE_POLICY_JSON` 覆盖编译策略。后端必须在请求写入、响应读取以及详情、修改、删除查询谓词中执行策略，不能只依赖前端隐藏。\n\n## English\n\nGenerated projects include field allowlists, sensitive-field protection, and owner/team record-scope adapters. `AUTH_FINE_POLICY_JSON` can override the compiled policy. Backends must enforce the policy on request writes, response reads, and detail/update/delete repository predicates rather than frontend visibility alone.\n'),
  ]
}

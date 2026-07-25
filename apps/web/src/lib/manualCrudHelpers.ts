import {
  lowerFirst,
  relationIdField,
  toSnakeCase,
  type ArtifactFile,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
  type ManualRelationDefinition,
  type ManualRelationOnDelete,
} from 'shared'

export function text(path: string, content: string): ArtifactFile {
  return { path, content: content.replace(/^\n/, '').trimEnd() + '\n' }
}

export function quote(value: string): string {
  return JSON.stringify(value)
}

export function upperFirst(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

export function routeName(entity: ManualEntityDefinition): string {
  return entity.route.replace(/^\//, '')
}

export function tableName(entity: ManualEntityDefinition): string {
  return toSnakeCase(routeName(entity).replace(/\//g, '_'))
}

export function entityByName(
  entities: readonly ManualEntityDefinition[],
  name: string,
): ManualEntityDefinition {
  const entity = entities.find((item) => item.name === name)
  if (!entity) throw new Error(`未知关系目标实体：${name}`)
  return entity
}

export function relationFieldName(relation: ManualRelationDefinition): string {
  return relationIdField(relation)
}

export function relationDisplayField(entity: ManualEntityDefinition): string {
  return entity.fields.find((field) => field.showInList !== false)?.name ?? entity.fields[0]?.name ?? 'id'
}

export function searchableFields(entity: ManualEntityDefinition): ManualFieldDefinition[] {
  return entity.fields.filter((field) => field.searchable === true)
}

export function sortableNames(entity: ManualEntityDefinition): string[] {
  return [
    'id',
    'createdAt',
    'updatedAt',
    ...entity.fields.filter((field) => field.sortable !== false).map((field) => field.name),
    ...(entity.relations ?? []).filter((relation) => relation.sortable !== false).map(relationFieldName),
  ]
}

export function defaultForField(field: ManualFieldDefinition): unknown {
  if (field.defaultValue !== undefined) {
    if (field.type === 'boolean') return field.defaultValue === 'true'
    if (field.type === 'integer' || field.type === 'decimal') return Number(field.defaultValue)
    return field.defaultValue
  }
  if (field.type === 'boolean') return false
  if (field.type === 'integer' || field.type === 'decimal') return null
  return ''
}

export function sqlOnDelete(action: ManualRelationOnDelete): string {
  if (action === 'cascade') return 'CASCADE'
  if (action === 'set-null') return 'SET NULL'
  return 'RESTRICT'
}

export function drizzleOnDelete(action: ManualRelationOnDelete): string {
  return action === 'set-null' ? 'set null' : action
}

export function prismaOnDelete(action: ManualRelationOnDelete): string {
  if (action === 'cascade') return 'Cascade'
  if (action === 'set-null') return 'SetNull'
  return 'Restrict'
}

export function gormOnDelete(action: ManualRelationOnDelete): string {
  return sqlOnDelete(action)
}

export function relationName(source: ManualEntityDefinition, relation: ManualRelationDefinition): string {
  return `${source.name}_${relation.name}`
}

export function incomingRelations(
  target: ManualEntityDefinition,
  entities: readonly ManualEntityDefinition[],
): Array<{ source: ManualEntityDefinition; relation: ManualRelationDefinition }> {
  return entities.flatMap((source) => (source.relations ?? [])
    .filter((relation) => relation.targetEntity === target.name)
    .map((relation) => ({ source, relation })))
}

export function incomingFieldName(source: ManualEntityDefinition, relation: ManualRelationDefinition): string {
  return `${lowerFirst(source.name)}${upperFirst(relation.name)}Items`
}

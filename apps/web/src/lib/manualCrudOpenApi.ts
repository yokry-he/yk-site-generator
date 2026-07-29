import {
  relationIdField,
  type ArtifactFile,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
} from 'shared'
import { text } from './manualCrudHelpers'

function yamlScalar(field: ManualFieldDefinition, indent: string): string {
  if (field.type === 'integer') return `${indent}type: integer`
  if (field.type === 'decimal') return `${indent}type: number`
  if (field.type === 'boolean') return `${indent}type: boolean`
  if (field.type === 'date') return `${indent}type: string\n${indent}format: date`
  if (field.type === 'datetime') return `${indent}type: string\n${indent}format: date-time`
  if (field.type === 'enum') return `${indent}type: string\n${indent}enum: [${(field.enumValues ?? []).map((value) => JSON.stringify(value)).join(', ')}]`
  return `${indent}type: string`
}

function inputSchema(entity: ManualEntityDefinition): string {
  const required = [
    ...entity.fields.filter((field) => field.required).map((field) => field.name),
    ...(entity.relations ?? []).filter((relation) => relation.required).map(relationIdField),
  ]
  const properties = [
    ...entity.fields.map((field) => `        ${field.name}:\n${yamlScalar(field, '          ')}`),
    ...(entity.relations ?? []).map((relation) => `        ${relationIdField(relation)}:\n          type: integer\n          nullable: ${relation.required ? 'false' : 'true'}\n          description: ${JSON.stringify(`${relation.label} -> ${relation.targetEntity}, onDelete=${relation.onDelete}`)}`),
  ]
  return `    ${entity.name}Input:\n      type: object\n${required.length ? `      required: [${required.join(', ')}]\n` : ''}      properties:\n${properties.join('\n')}`
}

function entitySchema(entity: ManualEntityDefinition): string {
  return `    ${entity.name}:\n      allOf:\n        - $ref: '#/components/schemas/${entity.name}Input'\n        - type: object\n          required: [id, createdAt, updatedAt]\n          properties:\n            id: { type: integer }\n            createdAt: { type: string, format: date-time }\n            updatedAt: { type: string, format: date-time }`
}

function pageSchema(entity: ManualEntityDefinition): string {
  return `    ${entity.name}Page:\n      type: object\n      required: [items, total, page, pageSize]\n      properties:\n        items:\n          type: array\n          items: { $ref: '#/components/schemas/${entity.name}' }\n        total: { type: integer }\n        page: { type: integer }\n        pageSize: { type: integer }`
}

function listParameters(entity: ManualEntityDefinition): string {
  const defaults = entity.list!
  const sortFields = [
    'id',
    'createdAt',
    'updatedAt',
    ...entity.fields.filter((field) => field.sortable !== false).map((field) => field.name),
    ...(entity.relations ?? []).filter((relation) => relation.sortable !== false).map(relationIdField),
  ]
  return `      parameters:\n        - { name: page, in: query, schema: { type: integer, minimum: 1, default: 1 } }\n        - { name: pageSize, in: query, schema: { type: integer, minimum: 1, maximum: 100, default: ${defaults.pageSize} } }\n        - { name: search, in: query, schema: { type: string } }\n        - name: sort\n          in: query\n          schema: { type: string, enum: [${sortFields.join(', ')}], default: ${defaults.defaultSortField} }\n        - { name: order, in: query, schema: { type: string, enum: [asc, desc], default: ${defaults.defaultSortDirection} } }`
}

const validationResponse = `        '400':\n          description: Invalid request input\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/ErrorResponse' }`
const conflictResponse = `        '409':\n          description: Unique or foreign-key constraint conflict\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/ErrorResponse' }`
const notFoundResponse = `        '404':\n          description: Not found\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/ErrorResponse' }`

export function openApiFile(
  projectName: string,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile {
  const paths = entities.map((entity) => `  /api${entity.route}:\n    get:\n      summary: List ${entity.pluralLabel}\n${listParameters(entity)}\n      responses:\n        '200':\n          description: Paginated result\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/${entity.name}Page' }\n    post:\n      summary: Create ${entity.label}\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema: { $ref: '#/components/schemas/${entity.name}Input' }\n      responses:\n        '201':\n          description: Created\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/${entity.name}' }\n${validationResponse}\n${conflictResponse}\n  /api${entity.route}/{id}:\n    get:\n      summary: Get ${entity.label}\n      parameters:\n        - { name: id, in: path, required: true, schema: { type: integer } }\n      responses:\n        '200':\n          description: OK\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/${entity.name}' }\n${notFoundResponse}\n    patch:\n      summary: Update ${entity.label}\n      parameters:\n        - { name: id, in: path, required: true, schema: { type: integer } }\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema: { $ref: '#/components/schemas/${entity.name}Input' }\n      responses:\n        '200':\n          description: OK\n          content:\n            application/json:\n              schema: { $ref: '#/components/schemas/${entity.name}' }\n${validationResponse}\n${notFoundResponse}\n${conflictResponse}\n    delete:\n      summary: Delete ${entity.label}\n      parameters:\n        - { name: id, in: path, required: true, schema: { type: integer } }\n      responses:\n        '204': { description: Deleted }\n${notFoundResponse}\n${conflictResponse}`).join('\n')
  const schemas = entities.flatMap((entity) => [inputSchema(entity), entitySchema(entity), pageSchema(entity)]).join('\n')
  return text('openapi.yaml', `openapi: 3.1.0\ninfo:\n  title: ${JSON.stringify(projectName)}\n  version: 0.3.0\npaths:\n${paths}\ncomponents:\n  schemas:\n    ErrorResponse:\n      type: object\n      required: [error]\n      properties:\n        error:\n          type: string\n          enum: [VALIDATION_ERROR, NOT_FOUND, CONSTRAINT_CONFLICT, UNAUTHORIZED, FORBIDDEN, AUTH_NOT_CONFIGURED, HTTP_ERROR, INTERNAL_ERROR]\n${schemas}\n`)
}

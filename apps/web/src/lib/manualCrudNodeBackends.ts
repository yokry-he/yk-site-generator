import {
  lowerFirst,
  relationIdField,
  toSnakeCase,
  type ArtifactFile,
  type BackendDatabaseId,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
  type ManualRelationDefinition,
} from 'shared'
import {
  drizzleOnDelete,
  incomingFieldName,
  incomingRelations,
  prismaOnDelete,
  quote,
  relationName,
  routeName,
  searchableFields,
  sortableNames,
  tableName,
  text,
} from './manualCrudHelpers'

function zodExpression(field: ManualFieldDefinition): string {
  let expression = field.type === 'integer'
    ? 'z.number().int()'
    : field.type === 'decimal'
      ? 'z.number()'
      : field.type === 'boolean'
        ? 'z.boolean()'
        : field.type === 'enum'
          ? `z.enum([${(field.enumValues ?? []).map(quote).join(', ')}])`
          : 'z.string()'
  if (!field.required) expression += '.optional()'
  return expression
}

function relationZodExpression(relation: ManualRelationDefinition): string {
  return `z.number().int().positive()${relation.required ? '' : '.nullable().optional()'}`
}

function drizzleColumn(field: ManualFieldDefinition, database: BackendDatabaseId): string {
  const column = toSnakeCase(field.name)
  let expression: string
  if (database === 'sqlite') {
    expression = field.type === 'boolean'
      ? `integer('${column}', { mode: 'boolean' })`
      : field.type === 'integer'
        ? `integer('${column}')`
        : field.type === 'decimal'
          ? `real('${column}')`
          : `text('${column}')`
  } else {
    expression = field.type === 'boolean'
      ? `boolean('${column}')`
      : field.type === 'integer'
        ? `integer('${column}')`
        : field.type === 'decimal'
          ? `numeric('${column}')`
          : field.type === 'date'
            ? `date('${column}')`
            : field.type === 'datetime'
              ? `timestamp('${column}', { withTimezone: true })`
              : `text('${column}')`
  }
  if (field.required) expression += '.notNull()'
  if (field.unique) expression += '.unique()'
  return `${field.name}: ${expression}`
}

function drizzleRelationColumn(relation: ManualRelationDefinition): string {
  let expression = `integer('${toSnakeCase(relationIdField(relation))}').references(() => ${lowerFirst(relation.targetEntity)}Table.id, { onDelete: '${drizzleOnDelete(relation.onDelete)}' })`
  if (relation.required) expression += '.notNull()'
  return `${relationIdField(relation)}: ${expression}`
}

function honoInputValue(
  field: ManualFieldDefinition,
  source: string,
  database: BackendDatabaseId,
): string {
  if (database === 'postgresql' && field.type === 'datetime') {
    return `${source} === undefined || ${source} === null || ${source} === '' ? ${source} : new Date(${source})`
  }
  return source
}

export function honoCrudFiles(
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  const imports = sqlite
    ? "import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'"
    : "import { boolean, date, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'"
  const tables = entities.map((entity) => {
    const columns = [
      ...entity.fields.map((field) => `  ${drizzleColumn(field, database)},`),
      ...(entity.relations ?? []).map((relation) => `  ${drizzleRelationColumn(relation)},`),
    ].join('\n')
    const system = sqlite
      ? "  id: integer('id').primaryKey({ autoIncrement: true }),\n  createdAt: text('created_at').notNull(),\n  updatedAt: text('updated_at').notNull(),"
      : "  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),\n  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),\n  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),"
    return `export const ${lowerFirst(entity.name)}Table = ${sqlite ? 'sqliteTable' : 'pgTable'}('${tableName(entity)}', {\n${system}\n${columns}\n})`
  }).join('\n\n')

  const dbFile = sqlite
    ? `import Database from 'better-sqlite3'\nimport { drizzle } from 'drizzle-orm/better-sqlite3'\nimport { mkdirSync } from 'node:fs'\nimport { dirname } from 'node:path'\nconst filename = (process.env.DATABASE_URL || 'file:./data/app.db').replace(/^file:/, '')\nmkdirSync(dirname(filename), { recursive: true })\nexport const db = drizzle(new Database(filename))`
    : `import { drizzle } from 'drizzle-orm/postgres-js'\nimport postgres from 'postgres'\nconst client = postgres(process.env.DATABASE_URL || 'postgresql://siteforge:siteforge@localhost:5432/siteforge_app')\nexport const db = drizzle(client)`

  const importTables = entities.map((entity) => `${lowerFirst(entity.name)}Table`).join(', ')
  const routes = entities.map((entity) => {
    const table = `${lowerFirst(entity.name)}Table`
    const schemaFields = [
      ...entity.fields.map((field) => `  ${field.name}: ${zodExpression(field)},`),
      ...(entity.relations ?? []).map((relation) => `  ${relationIdField(relation)}: ${relationZodExpression(relation)},`),
    ].join('\n')
    const createValues = [
      ...entity.fields.map((field) => `${field.name}: ${honoInputValue(field, `input.${field.name}`, database)}`),
      ...(entity.relations ?? []).map((relation) => `${relationIdField(relation)}: input.${relationIdField(relation)}`),
    ].join(', ')
    const updateValues = [
      ...entity.fields.map((field) => `${field.name}: ${honoInputValue(field, `input.${field.name}`, database)}`),
      ...(entity.relations ?? []).map((relation) => `${relationIdField(relation)}: input.${relationIdField(relation)}`),
      `updatedAt: ${sqlite ? "new Date().toISOString()" : 'new Date()'}`,
    ].join(', ')
    const search = searchableFields(entity)
    const whereExpression = search.length
      ? `search ? or(${search.map((field) => `${sqlite ? 'like' : 'ilike'}(${table}.${field.name}, pattern)`).join(', ')}) : undefined`
      : 'undefined'
    const sortMap = sortableNames(entity).map((name) => `${quote(name)}: ${table}.${name}`).join(', ')
    const defaults = entity.list!
    return `const ${lowerFirst(entity.name)}Input = z.object({\n${schemaFields}\n})\n\napp.get('/api${entity.route}', async (c) => {\n  const page = Math.max(1, Number(c.req.query('page') || 1))\n  const requestedPageSize = Number(c.req.query('pageSize') || ${defaults.pageSize})\n  const pageSize = Math.min(100, Math.max(1, Number.isFinite(requestedPageSize) ? requestedPageSize : ${defaults.pageSize}))\n  const search = (c.req.query('search') || '').trim()\n  const pattern = '%' + search + '%'\n  const sort = c.req.query('sort') || ${quote(defaults.defaultSortField)}\n  const order = c.req.query('order') === 'asc' ? 'asc' : c.req.query('order') === 'desc' ? 'desc' : ${quote(defaults.defaultSortDirection)}\n  const sortColumns = { ${sortMap} } as const\n  const sortColumn = sortColumns[sort as keyof typeof sortColumns] ?? sortColumns[${quote(defaults.defaultSortField)}]\n  const where = ${whereExpression}\n  const [countRow] = await db.select({ total: count() }).from(${table}).where(where)\n  const items = await db.select().from(${table}).where(where).orderBy(order === 'asc' ? asc(sortColumn) : desc(sortColumn)).limit(pageSize).offset((page - 1) * pageSize)\n  return c.json({ items, total: Number(countRow?.total || 0), page, pageSize })\n})\napp.get('/api${entity.route}/:id', async (c) => {\n  const [record] = await db.select().from(${table}).where(eq(${table}.id, Number(c.req.param('id')))).limit(1)\n  return record ? c.json(record) : c.json({ error: 'NOT_FOUND' }, 404)\n})\napp.post('/api${entity.route}', async (c) => {\n  const input = ${lowerFirst(entity.name)}Input.parse(await c.req.json())\n  const now = new Date().toISOString()\n  const [record] = await db.insert(${table}).values({ ${createValues}${sqlite ? ', createdAt: now, updatedAt: now' : ', updatedAt: new Date()'} }).returning()\n  return c.json(record, 201)\n})\napp.patch('/api${entity.route}/:id', async (c) => {\n  const input = ${lowerFirst(entity.name)}Input.partial().parse(await c.req.json())\n  const [record] = await db.update(${table}).set({ ${updateValues} }).where(eq(${table}.id, Number(c.req.param('id')))).returning()\n  return record ? c.json(record) : c.json({ error: 'NOT_FOUND' }, 404)\n})\napp.delete('/api${entity.route}/:id', async (c) => {\n  const [record] = await db.delete(${table}).where(eq(${table}.id, Number(c.req.param('id')))).returning()\n  return record ? c.body(null, 204) : c.json({ error: 'NOT_FOUND' }, 404)\n})`
  }).join('\n\n')

  return [
    text('apps/api/src/schema.ts', `${imports}\n\n${tables}`),
    text('apps/api/src/db.ts', dbFile),
    text('apps/api/src/index.ts', `import { serve } from '@hono/node-server'\nimport { asc, count, desc, eq, ${sqlite ? 'like' : 'ilike'}, or } from 'drizzle-orm'\nimport { Hono } from 'hono'\nimport { cors } from 'hono/cors'\nimport { z } from 'zod'\nimport { db } from './db'\nimport { ${importTables} } from './schema'\n\nconst app = new Hono()\napp.use('*', cors())\napp.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Hono + Drizzle', database: '${database}' }))\n\n${routes}\n\nconst port = Number(process.env.API_PORT || 8787)\nserve({ fetch: app.fetch, port }, () => console.log('API listening on http://localhost:' + port))\nexport default app`),
  ]
}

function prismaScalar(field: ManualFieldDefinition): string {
  const type = field.type === 'integer'
    ? 'Int'
    : field.type === 'decimal'
      ? 'Decimal'
      : field.type === 'boolean'
        ? 'Boolean'
        : field.type === 'date' || field.type === 'datetime'
          ? 'DateTime'
          : 'String'
  return `${type}${field.required ? '' : '?'}`
}

function prismaRelationFields(
  entity: ManualEntityDefinition,
): string[] {
  return (entity.relations ?? []).flatMap((relation) => {
    const field = relationIdField(relation)
    const optional = relation.required ? '' : '?'
    const relationOptional = relation.required ? '' : '?'
    return [
      `  ${field} Int${optional}`,
      `  ${relation.name} ${relation.targetEntity}${relationOptional} @relation(${quote(relationName(entity, relation))}, fields: [${field}], references: [id], onDelete: ${prismaOnDelete(relation.onDelete)})`,
    ]
  })
}

export function nestCrudFiles(
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
  const models = entities.map((entity) => {
    const fields = entity.fields.map((field) => `  ${field.name} ${prismaScalar(field)}${field.unique ? ' @unique' : ''}`)
    const relations = prismaRelationFields(entity)
    const incoming = incomingRelations(entity, entities).map(({ source, relation }) => `  ${incomingFieldName(source, relation)} ${source.name}[] @relation(${quote(relationName(source, relation))})`)
    return `model ${entity.name} {\n  id        Int      @id @default(autoincrement())\n${[...fields, ...relations, ...incoming].join('\n')}\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}`
  }).join('\n\n')

  const controllers = entities.map((entity) => {
    const variable = lowerFirst(entity.name)
    const searchable = searchableFields(entity)
    const whereExpression = searchable.length
      ? `search ? ({ OR: [${searchable.map((field) => `{ ${field.name}: { contains: search } }`).join(', ')}] } as Prisma.${entity.name}WhereInput) : undefined`
      : 'undefined'
    const sortNames = sortableNames(entity).map(quote).join(', ')
    const defaults = entity.list!
    return text(`apps/api/src/${routeName(entity)}.controller.ts`, `import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common'\nimport type { Prisma } from '@prisma/client'\nimport { PrismaService } from './prisma.service'\n\n@Controller('api${entity.route}')\nexport class ${entity.name}Controller {\n  constructor(private readonly prisma: PrismaService) {}\n  @Get()\n  async list(@Query('page') pageInput = '1', @Query('pageSize') pageSizeInput = '${defaults.pageSize}', @Query('search') search = '', @Query('sort') sortInput = ${quote(defaults.defaultSortField)}, @Query('order') orderInput = ${quote(defaults.defaultSortDirection)}) {\n    const page = Math.max(1, Number(pageInput) || 1)\n    const pageSize = Math.min(100, Math.max(1, Number(pageSizeInput) || ${defaults.pageSize}))\n    const allowedSort = new Set([${sortNames}])\n    const sort = allowedSort.has(sortInput) ? sortInput : ${quote(defaults.defaultSortField)}\n    const order = orderInput === 'asc' ? 'asc' : orderInput === 'desc' ? 'desc' : ${quote(defaults.defaultSortDirection)}\n    const where = ${whereExpression}\n    const orderBy = { [sort]: order } as Prisma.${entity.name}OrderByWithRelationInput\n    const [items, total] = await this.prisma.$transaction([\n      this.prisma.${variable}.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),\n      this.prisma.${variable}.count({ where }),\n    ])\n    return { items, total, page, pageSize }\n  }\n  @Get(':id') async get(@Param('id', ParseIntPipe) id: number) { const record = await this.prisma.${variable}.findUnique({ where: { id } }); if (!record) throw new NotFoundException(); return record }\n  @Post() create(@Body() body: Prisma.${entity.name}UncheckedCreateInput) { return this.prisma.${variable}.create({ data: body }) }\n  @Patch(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() body: Prisma.${entity.name}UncheckedUpdateInput) { await this.get(id); return this.prisma.${variable}.update({ where: { id }, data: body }) }\n  @Delete(':id') async remove(@Param('id', ParseIntPipe) id: number) { await this.get(id); await this.prisma.${variable}.delete({ where: { id } }) }\n}`)
  })
  const controllerNames = entities.map((entity) => `${entity.name}Controller`)
  const imports = entities.map((entity) => `import { ${entity.name}Controller } from './${routeName(entity)}.controller'`).join('\n')
  return [
    text('apps/api/prisma/schema.prisma', `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${database === 'sqlite' ? 'sqlite' : 'postgresql'}"\n  url      = env("DATABASE_URL")\n}\n\n${models}`),
    text('apps/api/src/prisma.service.ts', `import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'\nimport { PrismaClient } from '@prisma/client'\n@Injectable()\nexport class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {\n  async onModuleInit() { await this.$connect() }\n  async onModuleDestroy() { await this.$disconnect() }\n}`),
    text('apps/api/src/app.module.ts', `import { Module } from '@nestjs/common'\nimport { HealthController } from './health.controller'\nimport { PrismaService } from './prisma.service'\n${imports}\n@Module({ controllers: [HealthController, ${controllerNames.join(', ')}], providers: [PrismaService] })\nexport class AppModule {}`),
    ...controllers,
  ]
}

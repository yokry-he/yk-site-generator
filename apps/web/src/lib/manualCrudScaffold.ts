import {
  lowerFirst,
  toSnakeCase,
  type ArtifactFile,
  type BackendDatabaseId,
  type BackendStackId,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
} from 'shared'

function text(path: string, content: string): ArtifactFile {
  return { path, content: content.replace(/^\n/, '').trimEnd() + '\n' }
}

function quote(value: string): string {
  return JSON.stringify(value)
}

function routeName(entity: ManualEntityDefinition): string {
  return entity.route.replace(/^\//, '')
}

function tableName(entity: ManualEntityDefinition): string {
  return toSnakeCase(routeName(entity).replace(/\//g, '_'))
}

function defaultForField(field: ManualFieldDefinition): unknown {
  if (field.defaultValue !== undefined) {
    if (field.type === 'boolean') return field.defaultValue === 'true'
    if (field.type === 'integer' || field.type === 'decimal') return Number(field.defaultValue)
    return field.defaultValue
  }
  if (field.type === 'boolean') return false
  if (field.type === 'integer' || field.type === 'decimal') return null
  return ''
}

function frontendFiles(projectName: string, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const resources = entities.map((entity) => ({
    key: lowerFirst(entity.name),
    name: entity.name,
    label: entity.label,
    pluralLabel: entity.pluralLabel,
    route: entity.route,
    fields: entity.fields.map((field) => ({
      ...field,
      defaultValue: defaultForField(field),
    })),
  }))

  return [
    text('apps/web/src/resources.ts', `export type ResourceFieldType = 'text' | 'long-text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum'\n\nexport interface ResourceField {\n  name: string\n  label: string\n  type: ResourceFieldType\n  required: boolean\n  unique?: boolean\n  showInList?: boolean\n  showInForm?: boolean\n  enumValues?: string[]\n  defaultValue?: unknown\n}\n\nexport interface ResourceDefinition {\n  key: string\n  name: string\n  label: string\n  pluralLabel: string\n  route: string\n  fields: ResourceField[]\n}\n\nexport const resources: ResourceDefinition[] = ${JSON.stringify(resources, null, 2)}\n`),
    text('apps/web/src/App.vue', `<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { resources, type ResourceField } from './resources'

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
const activeKey = ref(resources[0]?.key || '')
const records = ref<Record<string, unknown>[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const editingId = ref<number | string | null>(null)
const form = reactive<Record<string, unknown>>({})

const active = computed(() => resources.find((item) => item.key === activeKey.value) || resources[0])
const listFields = computed(() => active.value?.fields.filter((field) => field.showInList !== false) || [])
const formFields = computed(() => active.value?.fields.filter((field) => field.showInForm !== false) || [])

function initialValue(field: ResourceField): unknown {
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue
  if (field.type === 'boolean') return false
  if (field.type === 'integer' || field.type === 'decimal') return null
  return ''
}

function resetForm(record?: Record<string, unknown>) {
  editingId.value = record?.id as number | string | null ?? null
  for (const field of formFields.value) form[field.name] = record?.[field.name] ?? initialValue(field)
}

async function loadRecords() {
  if (!active.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(apiBase + '/api' + active.value.route)
    if (!response.ok) throw new Error('HTTP ' + response.status)
    records.value = await response.json() as Record<string, unknown>[]
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function saveRecord() {
  if (!active.value) return
  saving.value = true
  error.value = ''
  try {
    const payload = Object.fromEntries(formFields.value.map((field) => [field.name, form[field.name]]))
    const path = apiBase + '/api' + active.value.route + (editingId.value === null ? '' : '/' + editingId.value)
    const response = await fetch(path, {
      method: editingId.value === null ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error((await response.text()) || 'HTTP ' + response.status)
    resetForm()
    await loadRecords()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function deleteRecord(id: unknown) {
  if (!active.value || !window.confirm('确认删除这条记录？')) return
  const response = await fetch(apiBase + '/api' + active.value.route + '/' + String(id), { method: 'DELETE' })
  if (!response.ok) error.value = (await response.text()) || '删除失败'
  else await loadRecords()
}

function displayValue(field: ResourceField, value: unknown): string {
  if (field.type === 'boolean') return value ? '是' : '否'
  return value === null || value === undefined || value === '' ? '—' : String(value)
}

watch(activeKey, async () => { resetForm(); await loadRecords() })
onMounted(async () => { resetForm(); await loadRecords() })
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <p class="eyebrow">SiteForge Manual CRUD</p>
      <h1>${projectName}</h1>
      <nav aria-label="数据资源">
        <button v-for="resource in resources" :key="resource.key" :class="{ active: resource.key === activeKey }" @click="activeKey = resource.key">
          <strong>{{ resource.pluralLabel }}</strong><span>{{ resource.route }}</span>
        </button>
      </nav>
      <a class="health" :href="apiBase + '/api/health'" target="_blank" rel="noreferrer">API 健康检查</a>
    </aside>

    <main v-if="active" class="workspace">
      <header class="workspace-header">
        <div><p class="eyebrow">{{ active.route }}</p><h2>{{ active.pluralLabel }}</h2><p>由 SiteForge 数据模型确定性生成的列表、表单和 CRUD API。</p></div>
        <button class="secondary" @click="resetForm()">新建{{ active.label }}</button>
      </header>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <section class="content-grid">
        <article class="panel table-panel">
          <div class="panel-title"><h3>数据列表</h3><button class="ghost" :disabled="loading" @click="loadRecords">{{ loading ? '刷新中…' : '刷新' }}</button></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th v-for="field in listFields" :key="field.name">{{ field.label }}</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="String(record.id)">
                  <td>{{ record.id }}</td>
                  <td v-for="field in listFields" :key="field.name">{{ displayValue(field, record[field.name]) }}</td>
                  <td class="actions"><button class="ghost" @click="resetForm(record)">编辑</button><button class="danger" @click="deleteRecord(record.id)">删除</button></td>
                </tr>
                <tr v-if="!loading && records.length === 0"><td :colspan="listFields.length + 2" class="empty">暂无数据，使用右侧表单创建第一条记录。</td></tr>
              </tbody>
            </table>
          </div>
        </article>

        <article class="panel form-panel">
          <div class="panel-title"><h3>{{ editingId === null ? '新建' : '编辑' }}{{ active.label }}</h3><span v-if="editingId !== null">#{{ editingId }}</span></div>
          <form @submit.prevent="saveRecord">
            <label v-for="field in formFields" :key="field.name">
              <span>{{ field.label }}<b v-if="field.required"> *</b></span>
              <textarea v-if="field.type === 'long-text'" v-model="form[field.name]" rows="4" :required="field.required" />
              <select v-else-if="field.type === 'enum'" v-model="form[field.name]" :required="field.required"><option value="">请选择</option><option v-for="option in field.enumValues" :key="option" :value="option">{{ option }}</option></select>
              <input v-else-if="field.type === 'boolean'" v-model="form[field.name]" type="checkbox" class="checkbox" />
              <input v-else-if="field.type === 'integer' || field.type === 'decimal'" v-model.number="form[field.name]" type="number" :step="field.type === 'integer' ? 1 : 'any'" :required="field.required" />
              <input v-else v-model="form[field.name]" :type="field.type === 'datetime' ? 'datetime-local' : field.type" :required="field.required" />
            </label>
            <button class="primary" :disabled="saving">{{ saving ? '保存中…' : '保存记录' }}</button>
          </form>
        </article>
      </section>
    </main>
  </div>
</template>`),
    text('apps/web/src/style.css', `:root{font-family:Inter,ui-sans-serif,system-ui;color:#e5e7eb;background:#070a11}*{box-sizing:border-box}body{margin:0;min-width:320px}.app-shell{min-height:100vh;display:grid;grid-template-columns:260px minmax(0,1fr)}.sidebar{padding:32px 22px;border-right:1px solid #ffffff14;background:#0b0f19;display:flex;flex-direction:column;gap:24px}.sidebar h1{margin:0;font-size:25px}.eyebrow{margin:0 0 8px;color:#a78bfa;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.sidebar nav{display:grid;gap:8px}.sidebar nav button{border:1px solid transparent;border-radius:14px;background:transparent;color:#cbd5e1;text-align:left;padding:13px;cursor:pointer}.sidebar nav button span{display:block;margin-top:4px;color:#64748b;font:11px ui-monospace}.sidebar nav button.active{border-color:#8b5cf655;background:#8b5cf61a;color:white}.health{margin-top:auto;color:#67e8f9;text-decoration:none;font-size:13px}.workspace{min-width:0;padding:clamp(22px,4vw,56px)}.workspace-header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:28px}.workspace-header h2{font-size:clamp(30px,5vw,52px);margin:0}.workspace-header p{color:#94a3b8}.content-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr);gap:22px}.panel{min-width:0;border:1px solid #ffffff14;border-radius:22px;background:#0f1420;padding:20px;box-shadow:0 24px 70px #0005}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}.panel-title h3{margin:0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:12px;border-bottom:1px solid #ffffff10;text-align:left;white-space:nowrap}th{color:#94a3b8;font-size:11px;text-transform:uppercase}.actions{display:flex;gap:6px}.empty{text-align:center;color:#64748b;padding:42px}form{display:grid;gap:15px}label>span{display:block;margin-bottom:7px;color:#cbd5e1;font-size:12px;font-weight:700}label b{color:#fda4af}input:not(.checkbox),textarea,select{width:100%;border:1px solid #ffffff1a;border-radius:12px;background:#070a11;color:#f8fafc;padding:11px 12px;outline:none}input:focus,textarea:focus,select:focus{border-color:#8b5cf6}.checkbox{width:20px;height:20px;accent-color:#8b5cf6}.primary,.secondary,.ghost,.danger{border:0;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer}.primary,.secondary{background:linear-gradient(120deg,#7c3aed,#0891b2);color:white}.primary{width:100%;margin-top:4px}.ghost{background:#ffffff0c;color:#cbd5e1}.danger{background:#ef44441a;color:#fca5a5}.error{border:1px solid #ef444455;background:#ef444414;color:#fecaca;padding:12px 16px;border-radius:13px}@media(max-width:960px){.app-shell{grid-template-columns:1fr}.sidebar{border-right:0;border-bottom:1px solid #ffffff14}.sidebar nav{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.health{margin-top:0}.content-grid{grid-template-columns:1fr}}@media(max-width:600px){.workspace-header{align-items:stretch;flex-direction:column}.workspace{padding:20px}.panel{padding:14px}.sidebar{padding:22px 18px}}`),
  ]
}

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

function honoCrudFiles(database: BackendDatabaseId, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  const imports = sqlite
    ? "import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'"
    : "import { boolean, date, integer, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core'"
  const tables = entities.map((entity) => {
    const columns = entity.fields.map((field) => `  ${drizzleColumn(field, database)},`).join('\n')
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
    const schemaFields = entity.fields.map((field) => `  ${field.name}: ${zodExpression(field)},`).join('\n')
    const payload = entity.fields.map((field) => `${field.name}: input.${field.name}`).join(', ')
    const timestampPayload = sqlite ? ", createdAt: now, updatedAt: now" : ', updatedAt: new Date()'
    return `const ${lowerFirst(entity.name)}Input = z.object({\n${schemaFields}\n})\n\napp.get('/api${entity.route}', async (c) => c.json(await db.select().from(${table})))\napp.get('/api${entity.route}/:id', async (c) => {\n  const [record] = await db.select().from(${table}).where(eq(${table}.id, Number(c.req.param('id')))).limit(1)\n  return record ? c.json(record) : c.json({ error: 'NOT_FOUND' }, 404)\n})\napp.post('/api${entity.route}', async (c) => {\n  const input = ${lowerFirst(entity.name)}Input.parse(await c.req.json())\n  const now = new Date().toISOString()\n  const [record] = await db.insert(${table}).values({ ${payload}${timestampPayload} }).returning()\n  return c.json(record, 201)\n})\napp.patch('/api${entity.route}/:id', async (c) => {\n  const input = ${lowerFirst(entity.name)}Input.partial().parse(await c.req.json())\n  const [record] = await db.update(${table}).set({ ...input, updatedAt: ${sqlite ? 'new Date().toISOString()' : 'new Date()'} }).where(eq(${table}.id, Number(c.req.param('id')))).returning()\n  return record ? c.json(record) : c.json({ error: 'NOT_FOUND' }, 404)\n})\napp.delete('/api${entity.route}/:id', async (c) => {\n  const [record] = await db.delete(${table}).where(eq(${table}.id, Number(c.req.param('id')))).returning()\n  return record ? c.body(null, 204) : c.json({ error: 'NOT_FOUND' }, 404)\n})`
  }).join('\n\n')

  return [
    text('apps/api/src/schema.ts', `${imports}\n\n${tables}`),
    text('apps/api/src/db.ts', dbFile),
    text('apps/api/src/index.ts', `import { serve } from '@hono/node-server'\nimport { eq } from 'drizzle-orm'\nimport { Hono } from 'hono'\nimport { cors } from 'hono/cors'\nimport { z } from 'zod'\nimport { db } from './db'\nimport { ${importTables} } from './schema'\n\nconst app = new Hono()\napp.use('*', cors())\napp.get('/api/health', (c) => c.json({ status: 'ok', stack: 'Hono + Drizzle', database: '${database}' }))\n\n${routes}\n\nconst port = Number(process.env.API_PORT || 8787)\nserve({ fetch: app.fetch, port }, () => console.log('API listening on http://localhost:' + port))\nexport default app`),
  ]
}

function prismaScalar(field: ManualFieldDefinition): string {
  const type = field.type === 'integer' ? 'Int' : field.type === 'decimal' ? 'Decimal' : field.type === 'boolean' ? 'Boolean' : field.type === 'date' || field.type === 'datetime' ? 'DateTime' : 'String'
  return `${type}${field.required ? '' : '?'}`
}

function nestCrudFiles(database: BackendDatabaseId, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const models = entities.map((entity) => {
    const fields = entity.fields.map((field) => `  ${field.name} ${prismaScalar(field)}${field.unique ? ' @unique' : ''}`).join('\n')
    return `model ${entity.name} {\n  id        Int      @id @default(autoincrement())\n${fields}\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n}`
  }).join('\n\n')

  const controllers = entities.map((entity) => {
    const variable = lowerFirst(entity.name)
    return text(`apps/api/src/${routeName(entity)}.controller.ts`, `import { Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common'\nimport type { Prisma } from '@prisma/client'\nimport { PrismaService } from './prisma.service'\n\n@Controller('api${entity.route}')\nexport class ${entity.name}Controller {\n  constructor(private readonly prisma: PrismaService) {}\n  @Get() list() { return this.prisma.${variable}.findMany({ orderBy: { id: 'desc' } }) }\n  @Get(':id') async get(@Param('id', ParseIntPipe) id: number) { const record = await this.prisma.${variable}.findUnique({ where: { id } }); if (!record) throw new NotFoundException(); return record }\n  @Post() create(@Body() body: Prisma.${entity.name}CreateInput) { return this.prisma.${variable}.create({ data: body }) }\n  @Patch(':id') async update(@Param('id', ParseIntPipe) id: number, @Body() body: Prisma.${entity.name}UpdateInput) { await this.get(id); return this.prisma.${variable}.update({ where: { id }, data: body }) }\n  @Delete(':id') async remove(@Param('id', ParseIntPipe) id: number) { await this.get(id); await this.prisma.${variable}.delete({ where: { id } }) }\n}`)
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

function pythonType(field: ManualFieldDefinition): string {
  const type = field.type === 'integer' ? 'int' : field.type === 'decimal' ? 'float' : field.type === 'boolean' ? 'bool' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime' : 'str'
  return field.required ? type : `${type} | None`
}

function sqlalchemyColumn(field: ManualFieldDefinition): string {
  const type = field.type === 'integer' ? 'Integer' : field.type === 'decimal' ? 'Float' : field.type === 'boolean' ? 'Boolean' : field.type === 'date' ? 'Date' : field.type === 'datetime' ? 'DateTime(timezone=True)' : 'Text'
  return `    ${field.name}: Mapped[${pythonType(field)}] = mapped_column(${type}, nullable=${field.required ? 'False' : 'True'}${field.unique ? ', unique=True' : ''})`
}

function fastApiCrudFiles(entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const modelClasses = entities.map((entity) => `class ${entity.name}(Base):\n    __tablename__ = "${tableName(entity)}"\n    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)\n${entity.fields.map(sqlalchemyColumn).join('\n')}\n    createdAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))\n    updatedAt: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))`).join('\n\n')
  const schemaClasses = entities.map((entity) => {
    const create = entity.fields.map((field) => `    ${field.name}: ${pythonType(field)}${field.required ? '' : ' = None'}`).join('\n')
    const update = entity.fields.map((field) => `    ${field.name}: ${pythonType({ ...field, required: false })} = None`).join('\n')
    return `class ${entity.name}Create(BaseModel):\n${create}\n\nclass ${entity.name}Update(BaseModel):\n${update}\n\nclass ${entity.name}Read(${entity.name}Create):\n    id: int\n    createdAt: datetime\n    updatedAt: datetime\n    model_config = ConfigDict(from_attributes=True)`
  }).join('\n\n')
  const routeBlocks = entities.map((entity) => {
    const variable = lowerFirst(entity.name)
    return `@router.get("${entity.route}", response_model=list[schemas.${entity.name}Read])\ndef list_${variable}(db: Session = Depends(get_db)):\n    return db.scalars(select(models.${entity.name}).order_by(models.${entity.name}.id.desc())).all()\n\n@router.get("${entity.route}/{item_id}", response_model=schemas.${entity.name}Read)\ndef get_${variable}(item_id: int, db: Session = Depends(get_db)):\n    item = db.get(models.${entity.name}, item_id)\n    if item is None: raise HTTPException(status_code=404, detail="Not found")\n    return item\n\n@router.post("${entity.route}", response_model=schemas.${entity.name}Read, status_code=201)\ndef create_${variable}(payload: schemas.${entity.name}Create, db: Session = Depends(get_db)):\n    item = models.${entity.name}(**payload.model_dump())\n    db.add(item); db.commit(); db.refresh(item); return item\n\n@router.patch("${entity.route}/{item_id}", response_model=schemas.${entity.name}Read)\ndef update_${variable}(item_id: int, payload: schemas.${entity.name}Update, db: Session = Depends(get_db)):\n    item = db.get(models.${entity.name}, item_id)\n    if item is None: raise HTTPException(status_code=404, detail="Not found")\n    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)\n    db.commit(); db.refresh(item); return item\n\n@router.delete("${entity.route}/{item_id}", status_code=204)\ndef delete_${variable}(item_id: int, db: Session = Depends(get_db)):\n    item = db.get(models.${entity.name}, item_id)\n    if item is None: raise HTTPException(status_code=404, detail="Not found")\n    db.delete(item); db.commit()`
  }).join('\n\n')
  return [
    text('apps/api/app/models.py', `from datetime import datetime, timezone\nfrom sqlalchemy import Boolean, Date, DateTime, Float, Integer, Text\nfrom sqlalchemy.orm import Mapped, mapped_column\nfrom .database import Base\n\n${modelClasses}`),
    text('apps/api/app/schemas.py', `from datetime import date, datetime\nfrom pydantic import BaseModel, ConfigDict\n\n${schemaClasses}`),
    text('apps/api/app/routes.py', `from fastapi import APIRouter, Depends, HTTPException\nfrom sqlalchemy import select\nfrom sqlalchemy.orm import Session\nfrom . import models, schemas\nfrom .database import SessionLocal\n\nrouter = APIRouter(prefix="/api")\n\ndef get_db():\n    db = SessionLocal()\n    try: yield db\n    finally: db.close()\n\n${routeBlocks}`),
    text('apps/api/app/main.py', `from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\nfrom .database import Base, engine\nfrom .routes import router\n\nBase.metadata.create_all(bind=engine)\napp = FastAPI(title="SiteForge CRUD API")\napp.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])\napp.get("/api/health")(lambda: {"status": "ok", "stack": "FastAPI + SQLAlchemy"})\napp.include_router(router)`),
  ]
}

function javaType(field: ManualFieldDefinition, boxed = false): string {
  if (field.type === 'integer') return boxed ? 'Integer' : 'Integer'
  if (field.type === 'decimal') return 'BigDecimal'
  if (field.type === 'boolean') return 'Boolean'
  if (field.type === 'date') return 'LocalDate'
  if (field.type === 'datetime') return 'OffsetDateTime'
  return 'String'
}

function springCrudFiles(entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const files: ArtifactFile[] = []
  const sqlTables: string[] = []
  for (const entity of entities) {
    const fields = entity.fields.map((field) => `  @Column(name = "${toSnakeCase(field.name)}"${field.required ? ', nullable = false' : ''}${field.unique ? ', unique = true' : ''})\n  private ${javaType(field)} ${field.name};`).join('\n')
    const accessors = entity.fields.map((field) => `  public ${javaType(field)} get${field.name[0].toUpperCase() + field.name.slice(1)}() { return ${field.name}; }\n  public void set${field.name[0].toUpperCase() + field.name.slice(1)}(${javaType(field)} value) { this.${field.name} = value; }`).join('\n')
    const requestFields = entity.fields.map((field) => `${javaType(field, true)} ${field.name}`).join(', ')
    const setters = entity.fields.map((field) => `    if (request.${field.name}() != null) item.set${field.name[0].toUpperCase() + field.name.slice(1)}(request.${field.name}());`).join('\n')
    files.push(
      text(`apps/api/src/main/java/dev/siteforge/api/${entity.name}.java`, `package dev.siteforge.api;\n\nimport jakarta.persistence.*;\nimport java.math.BigDecimal;\nimport java.time.*;\n\n@Entity\n@Table(name = "${tableName(entity)}")\npublic class ${entity.name} {\n  @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;\n${fields}\n  @Column(nullable = false) private OffsetDateTime createdAt;\n  @Column(nullable = false) private OffsetDateTime updatedAt;\n  @PrePersist void createTimestamps() { createdAt = OffsetDateTime.now(); updatedAt = createdAt; }\n  @PreUpdate void updateTimestamp() { updatedAt = OffsetDateTime.now(); }\n  public Long getId() { return id; }\n${accessors}\n  public OffsetDateTime getCreatedAt() { return createdAt; }\n  public OffsetDateTime getUpdatedAt() { return updatedAt; }\n}`),
      text(`apps/api/src/main/java/dev/siteforge/api/${entity.name}Repository.java`, `package dev.siteforge.api;\nimport org.springframework.data.jpa.repository.JpaRepository;\npublic interface ${entity.name}Repository extends JpaRepository<${entity.name}, Long> {}`),
      text(`apps/api/src/main/java/dev/siteforge/api/${entity.name}Controller.java`, `package dev.siteforge.api;\n\nimport java.math.BigDecimal;\nimport java.time.*;\nimport java.util.List;\nimport org.springframework.http.HttpStatus;\nimport org.springframework.web.bind.annotation.*;\nimport org.springframework.web.server.ResponseStatusException;\n\n@RestController\n@RequestMapping("/api${entity.route}")\n@CrossOrigin(origins = "http://localhost:5173")\npublic class ${entity.name}Controller {\n  private final ${entity.name}Repository repository;\n  public ${entity.name}Controller(${entity.name}Repository repository) { this.repository = repository; }\n  public record Request(${requestFields}) {}\n  @GetMapping public List<${entity.name}> list() { return repository.findAll(); }\n  @GetMapping("/{id}") public ${entity.name} get(@PathVariable Long id) { return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }\n  @PostMapping @ResponseStatus(HttpStatus.CREATED) public ${entity.name} create(@RequestBody Request request) { return repository.save(apply(new ${entity.name}(), request)); }\n  @PatchMapping("/{id}") public ${entity.name} update(@PathVariable Long id, @RequestBody Request request) { return repository.save(apply(get(id), request)); }\n  @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable Long id) { repository.delete(get(id)); }\n  private ${entity.name} apply(${entity.name} item, Request request) {\n${setters}\n    return item;\n  }\n}`),
    )
    const sqlFields = entity.fields.map((field) => {
      const type = field.type === 'integer' ? 'INTEGER' : field.type === 'decimal' ? 'NUMERIC' : field.type === 'boolean' ? 'BOOLEAN' : field.type === 'date' ? 'DATE' : field.type === 'datetime' ? 'TIMESTAMPTZ' : 'TEXT'
      return `  ${toSnakeCase(field.name)} ${type}${field.required ? ' NOT NULL' : ''}${field.unique ? ' UNIQUE' : ''}`
    })
    sqlTables.push(`CREATE TABLE ${tableName(entity)} (\n  id BIGSERIAL PRIMARY KEY,\n${sqlFields.join(',\n')},\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);`)
  }
  files.push(text('apps/api/src/main/resources/db/migration/V1__create_tasks.sql', sqlTables.join('\n\n')))
  return files
}

function goType(field: ManualFieldDefinition, pointer = false): string {
  const type = field.type === 'integer' ? 'int' : field.type === 'decimal' ? 'float64' : field.type === 'boolean' ? 'bool' : field.type === 'date' || field.type === 'datetime' ? 'time.Time' : 'string'
  return pointer ? `*${type}` : type
}

function ginCrudFiles(database: BackendDatabaseId, entities: readonly ManualEntityDefinition[]): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  const structs = entities.map((entity) => `type ${entity.name} struct {\n  ID uint \`json:"id" gorm:"primaryKey"\`\n${entity.fields.map((field) => `  ${field.name[0].toUpperCase() + field.name.slice(1)} ${goType(field)} \`json:"${field.name}"${field.unique ? ' gorm:"uniqueIndex"' : ''}\``).join('\n')}\n  CreatedAt time.Time \`json:"createdAt"\`\n  UpdatedAt time.Time \`json:"updatedAt"\`\n}`).join('\n\n')
  const migrate = entities.map((entity) => `&${entity.name}{}`).join(', ')
  const migrationUp = entities.map((entity) => {
    const id = sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY'
    const fields = entity.fields.map((field) => {
      const sqlType = field.type === 'integer'
        ? 'INTEGER'
        : field.type === 'decimal'
          ? 'NUMERIC'
          : field.type === 'boolean'
            ? 'BOOLEAN'
            : field.type === 'date'
              ? 'DATE'
              : field.type === 'datetime'
                ? 'TIMESTAMP'
                : 'TEXT'
      return `  ${toSnakeCase(field.name)} ${sqlType}${field.required ? ' NOT NULL' : ''}${field.unique ? ' UNIQUE' : ''}`
    })
    return `CREATE TABLE ${tableName(entity)} (\n  id ${id},\n${fields.join(',\n')},\n  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP\n);`
  }).join('\n\n')
  const migrationDown = [...entities].reverse().map((entity) => `DROP TABLE IF EXISTS ${tableName(entity)};`).join('\n')
  const handlers = entities.map((entity) => {
    const plural = routeName(entity)
    const updateFields = entity.fields.map((field) => `  ${field.name[0].toUpperCase() + field.name.slice(1)} ${goType(field, true)} \`json:"${field.name}"\``).join('\n')
    return `type ${entity.name}Update struct {\n${updateFields}\n}\n\nfunc Register${entity.name}Routes(router *gin.Engine) {\n  group := router.Group("/api/${plural}")\n  group.GET("", func(c *gin.Context) { var items []database.${entity.name}; database.DB.Order("id desc").Find(&items); c.JSON(http.StatusOK, items) })\n  group.GET("/:id", func(c *gin.Context) { var item database.${entity.name}; if database.DB.First(&item, c.Param("id")).Error != nil { c.JSON(http.StatusNotFound, gin.H{"error":"NOT_FOUND"}); return }; c.JSON(http.StatusOK, item) })\n  group.POST("", func(c *gin.Context) { var item database.${entity.name}; if err := c.ShouldBindJSON(&item); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }; database.DB.Create(&item); c.JSON(http.StatusCreated, item) })\n  group.PATCH("/:id", func(c *gin.Context) { var item database.${entity.name}; if database.DB.First(&item, c.Param("id")).Error != nil { c.JSON(http.StatusNotFound, gin.H{"error":"NOT_FOUND"}); return }; var input ${entity.name}Update; if err := c.ShouldBindJSON(&input); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error":err.Error()}); return }; database.DB.Model(&item).Updates(input); c.JSON(http.StatusOK, item) })\n  group.DELETE("/:id", func(c *gin.Context) { var item database.${entity.name}; if database.DB.First(&item, c.Param("id")).Error != nil { c.JSON(http.StatusNotFound, gin.H{"error":"NOT_FOUND"}); return }; database.DB.Delete(&item); c.Status(http.StatusNoContent) })\n}`
  }).join('\n\n')
  const routeRegisters = entities.map((entity) => `handlers.Register${entity.name}Routes(router)`).join('\n  ')
  return [
    text('apps/api/internal/database/models.go', `package database\n\nimport "time"\n\n${structs}`),
    text('apps/api/internal/database/database.go', `package database\n\nimport (\n  "os"\n  "gorm.io/driver/${sqlite ? 'sqlite' : 'postgres'}"\n  "gorm.io/gorm"\n)\nvar DB *gorm.DB\nfunc Connect() {\n  url := os.Getenv("DATABASE_URL"); if url == "" { url = "${sqlite ? 'data/app.db' : 'postgresql://siteforge:siteforge@localhost:5432/siteforge_app'}" }\n  db, err := gorm.Open(${sqlite ? 'sqlite.Open(url)' : 'postgres.Open(url)'}, &gorm.Config{}); if err != nil { panic(err) }\n  if err := db.AutoMigrate(${migrate}); err != nil { panic(err) }; DB = db\n}`),
    text('apps/api/internal/handlers/resources.go', `package handlers\n\nimport (\n  "net/http"\n  "time"\n  "github.com/gin-gonic/gin"\n  "siteforge.dev/api/internal/database"\n)\n\n${handlers}`),
    text('apps/api/migrations/00001_create_tasks.sql', `-- +goose Up\n${migrationUp}\n\n-- +goose Down\n${migrationDown}`),
    text('apps/api/cmd/api/main.go', `package main\n\nimport (\n  "net/http"\n  "os"\n  "github.com/gin-gonic/gin"\n  "siteforge.dev/api/internal/database"\n  "siteforge.dev/api/internal/handlers"\n)\nfunc main() {\n  database.Connect()\n  router := gin.Default()\n  router.Use(func(c *gin.Context) { c.Header("Access-Control-Allow-Origin", "http://localhost:5173"); c.Header("Access-Control-Allow-Headers", "Content-Type"); c.Header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS"); if c.Request.Method == http.MethodOptions { c.AbortWithStatus(http.StatusNoContent); return }; c.Next() })\n  router.GET("/api/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status":"ok", "stack":"Gin + GORM"}) })\n  ${routeRegisters}\n  port := os.Getenv("API_PORT"); if port == "" { port = "8787" }; _ = router.Run(":" + port)\n}`),
  ]
}

function openApiFile(projectName: string, entities: readonly ManualEntityDefinition[]): ArtifactFile {
  const paths = entities.map((entity) => `  /api${entity.route}:\n    get:\n      summary: List ${entity.pluralLabel}\n      responses:\n        '200': { description: OK }\n    post:\n      summary: Create ${entity.label}\n      responses:\n        '201': { description: Created }\n  /api${entity.route}/{id}:\n    get:\n      summary: Get ${entity.label}\n      parameters:\n        - { name: id, in: path, required: true, schema: { type: integer } }\n      responses:\n        '200': { description: OK }\n        '404': { description: Not found }\n    patch:\n      summary: Update ${entity.label}\n      parameters:\n        - { name: id, in: path, required: true, schema: { type: integer } }\n      responses:\n        '200': { description: OK }\n    delete:\n      summary: Delete ${entity.label}\n      parameters:\n        - { name: id, in: path, required: true, schema: { type: integer } }\n      responses:\n        '204': { description: Deleted }`).join('\n')
  return text('openapi.yaml', `openapi: 3.1.0\ninfo:\n  title: ${JSON.stringify(projectName)}\n  version: 0.1.0\npaths:\n${paths}\n`)
}

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
  return [...frontendFiles(projectName, entities), ...backend, openApiFile(projectName, entities)]
}

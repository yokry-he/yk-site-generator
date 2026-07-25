import {
  lowerFirst,
  type ArtifactFile,
  type ManualEntityDefinition,
} from 'shared'
import {
  defaultForField,
  entityByName,
  relationDisplayField,
  relationFieldName,
  text,
} from './manualCrudHelpers'

export function manualCrudFrontendFiles(
  projectName: string,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile[] {
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
    relations: (entity.relations ?? []).map((relation) => {
      const target = entityByName(entities, relation.targetEntity)
      return {
        ...relation,
        fieldName: relationFieldName(relation),
        targetKey: lowerFirst(target.name),
        targetRoute: target.route,
        targetLabel: target.label,
        targetPluralLabel: target.pluralLabel,
        targetDisplayField: relationDisplayField(target),
      }
    }),
    list: entity.list,
  }))

  return [
    text('apps/web/src/resources.ts', `export type ResourceFieldType = 'text' | 'long-text' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum'
export type SortDirection = 'asc' | 'desc'

export interface ResourceField {
  name: string
  label: string
  type: ResourceFieldType
  required: boolean
  unique?: boolean
  searchable?: boolean
  sortable?: boolean
  showInList?: boolean
  showInForm?: boolean
  enumValues?: string[]
  defaultValue?: unknown
}

export interface ResourceRelation {
  name: string
  fieldName: string
  label: string
  targetEntity: string
  targetKey: string
  targetRoute: string
  targetLabel: string
  targetPluralLabel: string
  targetDisplayField: string
  required: boolean
  onDelete: 'restrict' | 'cascade' | 'set-null'
  sortable?: boolean
  showInList?: boolean
  showInForm?: boolean
}

export interface ResourceListDefinition {
  pageSize: number
  defaultSortField: string
  defaultSortDirection: SortDirection
}

export interface ResourceDefinition {
  key: string
  name: string
  label: string
  pluralLabel: string
  route: string
  fields: ResourceField[]
  relations: ResourceRelation[]
  list: ResourceListDefinition
}

export const resources: ResourceDefinition[] = ${JSON.stringify(resources, null, 2)}
`),
    text('apps/web/src/App.vue', `<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { resources, type ResourceField, type ResourceRelation, type SortDirection } from './resources'

interface ListResponse {
  items: Record<string, unknown>[]
  total: number
  page: number
  pageSize: number
}

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'
const activeKey = ref(resources[0]?.key || '')
const records = ref<Record<string, unknown>[]>([])
const total = ref(0)
const page = ref(1)
const search = ref('')
const sortField = ref('id')
const sortDirection = ref<SortDirection>('desc')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const editingId = ref<number | string | null>(null)
const form = reactive<Record<string, unknown>>({})
const relationOptions = reactive<Record<string, Record<string, unknown>[]>>({})

const active = computed(() => resources.find((item) => item.key === activeKey.value) || resources[0])
const listFields = computed(() => active.value?.fields.filter((field) => field.showInList !== false) || [])
const listRelations = computed(() => active.value?.relations.filter((relation) => relation.showInList !== false) || [])
const formFields = computed(() => active.value?.fields.filter((field) => field.showInForm !== false) || [])
const formRelations = computed(() => active.value?.relations.filter((relation) => relation.showInForm !== false) || [])
const sortOptions = computed(() => {
  if (!active.value) return []
  return [
    { value: 'id', label: 'ID' },
    { value: 'createdAt', label: '创建时间' },
    { value: 'updatedAt', label: '更新时间' },
    ...active.value.fields.filter((field) => field.sortable !== false).map((field) => ({ value: field.name, label: field.label })),
    ...active.value.relations.filter((relation) => relation.sortable !== false).map((relation) => ({ value: relation.fieldName, label: relation.label })),
  ]
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / (active.value?.list.pageSize || 20))))

function initialValue(field: ResourceField): unknown {
  if (field.defaultValue !== undefined && field.defaultValue !== null) return field.defaultValue
  if (field.type === 'boolean') return false
  if (field.type === 'integer' || field.type === 'decimal') return null
  return ''
}

function relationKey(relation: ResourceRelation): string {
  return activeKey.value + ':' + relation.name
}

function resetQuery() {
  page.value = 1
  search.value = ''
  sortField.value = active.value?.list.defaultSortField || 'id'
  sortDirection.value = active.value?.list.defaultSortDirection || 'desc'
}

function resetForm(record?: Record<string, unknown>) {
  editingId.value = record?.id as number | string | null ?? null
  for (const field of formFields.value) form[field.name] = record?.[field.name] ?? initialValue(field)
  for (const relation of formRelations.value) form[relation.fieldName] = record?.[relation.fieldName] ?? null
}

function normalizeListResponse(body: unknown): ListResponse {
  if (Array.isArray(body)) return { items: body as Record<string, unknown>[], total: body.length, page: 1, pageSize: body.length || 20 }
  const value = body as Partial<ListResponse>
  return {
    items: Array.isArray(value.items) ? value.items : [],
    total: Number(value.total || 0),
    page: Number(value.page || 1),
    pageSize: Number(value.pageSize || active.value?.list.pageSize || 20),
  }
}

async function loadRelationOptions() {
  await Promise.all(formRelations.value.map(async (relation) => {
    try {
      const query = new URLSearchParams({ page: '1', pageSize: '100', sort: 'id', order: 'asc' })
      const response = await fetch(apiBase + '/api' + relation.targetRoute + '?' + query.toString())
      if (!response.ok) throw new Error('HTTP ' + response.status)
      relationOptions[relationKey(relation)] = normalizeListResponse(await response.json()).items
    } catch {
      relationOptions[relationKey(relation)] = []
    }
  }))
}

async function loadRecords() {
  if (!active.value) return
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({
      page: String(page.value),
      pageSize: String(active.value.list.pageSize),
      sort: sortField.value,
      order: sortDirection.value,
    })
    if (search.value.trim()) query.set('search', search.value.trim())
    const response = await fetch(apiBase + '/api' + active.value.route + '?' + query.toString())
    if (!response.ok) throw new Error('HTTP ' + response.status)
    const body = normalizeListResponse(await response.json())
    records.value = body.items
    total.value = body.total
    page.value = body.page
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
    const fieldPairs = formFields.value.map((field) => [field.name, form[field.name]])
    const relationPairs = formRelations.value.map((relation) => [relation.fieldName, form[relation.fieldName]])
    const payload = Object.fromEntries([...fieldPairs, ...relationPairs])
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

function displayRelation(relation: ResourceRelation, value: unknown): string {
  const record = relationOptions[relationKey(relation)]?.find((item) => String(item.id) === String(value))
  if (!record) return value === null || value === undefined || value === '' ? '—' : '#' + String(value)
  return String(record[relation.targetDisplayField] ?? ('#' + String(record.id)))
}

async function submitSearch() {
  page.value = 1
  await loadRecords()
}

async function changeSort() {
  page.value = 1
  await loadRecords()
}

async function changePage(nextPage: number) {
  page.value = Math.min(totalPages.value, Math.max(1, nextPage))
  await loadRecords()
}

watch(activeKey, async () => {
  resetQuery()
  resetForm()
  await Promise.all([loadRelationOptions(), loadRecords()])
})

onMounted(async () => {
  resetQuery()
  resetForm()
  await Promise.all([loadRelationOptions(), loadRecords()])
})
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
        <div><p class="eyebrow">{{ active.route }}</p><h2>{{ active.pluralLabel }}</h2><p>包含外键、搜索、排序、分页和完整 CRUD 的确定性管理端。</p></div>
        <button class="secondary" @click="resetForm()">新建{{ active.label }}</button>
      </header>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <section class="content-grid">
        <article class="panel table-panel">
          <div class="panel-title"><div><h3>数据列表</h3><small>共 {{ total }} 条</small></div><button class="ghost" :disabled="loading" @click="loadRecords">{{ loading ? '刷新中…' : '刷新' }}</button></div>
          <div class="query-bar">
            <form class="search-form" @submit.prevent="submitSearch"><input v-model="search" type="search" placeholder="搜索可搜索字段" /><button class="ghost">搜索</button></form>
            <select v-model="sortField" aria-label="排序字段" @change="changeSort"><option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
            <select v-model="sortDirection" aria-label="排序方向" @change="changeSort"><option value="asc">升序</option><option value="desc">降序</option></select>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>ID</th><th v-for="field in listFields" :key="field.name">{{ field.label }}</th><th v-for="relation in listRelations" :key="relation.name">{{ relation.label }}</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="String(record.id)">
                  <td>{{ record.id }}</td>
                  <td v-for="field in listFields" :key="field.name">{{ displayValue(field, record[field.name]) }}</td>
                  <td v-for="relation in listRelations" :key="relation.name">{{ displayRelation(relation, record[relation.fieldName]) }}</td>
                  <td class="actions"><button class="ghost" @click="resetForm(record)">编辑</button><button class="danger" @click="deleteRecord(record.id)">删除</button></td>
                </tr>
                <tr v-if="!loading && records.length === 0"><td :colspan="listFields.length + listRelations.length + 2" class="empty">没有匹配数据，可修改搜索条件或创建第一条记录。</td></tr>
              </tbody>
            </table>
          </div>
          <div class="pagination"><button class="ghost" :disabled="page <= 1 || loading" @click="changePage(page - 1)">上一页</button><span>第 {{ page }} / {{ totalPages }} 页</span><button class="ghost" :disabled="page >= totalPages || loading" @click="changePage(page + 1)">下一页</button></div>
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
            <label v-for="relation in formRelations" :key="relation.name">
              <span>{{ relation.label }}<b v-if="relation.required"> *</b></span>
              <select v-model.number="form[relation.fieldName]" :required="relation.required"><option :value="null">请选择{{ relation.targetLabel }}</option><option v-for="option in relationOptions[relationKey(relation)] || []" :key="String(option.id)" :value="option.id">{{ String(option[relation.targetDisplayField] ?? ('#' + String(option.id))) }}</option></select>
              <small>{{ relation.targetPluralLabel }} · 删除策略 {{ relation.onDelete }}</small>
            </label>
            <button class="primary" :disabled="saving">{{ saving ? '保存中…' : '保存记录' }}</button>
          </form>
        </article>
      </section>
    </main>
  </div>
</template>`),
    text('apps/web/src/style.css', `:root{font-family:Inter,ui-sans-serif,system-ui;color:#e5e7eb;background:#070a11}*{box-sizing:border-box}body{margin:0;min-width:320px}.app-shell{min-height:100vh;display:grid;grid-template-columns:260px minmax(0,1fr)}.sidebar{padding:32px 22px;border-right:1px solid #ffffff14;background:#0b0f19;display:flex;flex-direction:column;gap:24px}.sidebar h1{margin:0;font-size:25px}.eyebrow{margin:0 0 8px;color:#a78bfa;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.sidebar nav{display:grid;gap:8px}.sidebar nav button{border:1px solid transparent;border-radius:14px;background:transparent;color:#cbd5e1;text-align:left;padding:13px;cursor:pointer}.sidebar nav button span{display:block;margin-top:4px;color:#64748b;font:11px ui-monospace}.sidebar nav button.active{border-color:#8b5cf655;background:#8b5cf61a;color:white}.health{margin-top:auto;color:#67e8f9;text-decoration:none;font-size:13px}.workspace{min-width:0;padding:clamp(22px,4vw,56px)}.workspace-header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:28px}.workspace-header h2{font-size:clamp(30px,5vw,52px);margin:0}.workspace-header p{color:#94a3b8}.content-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr);gap:22px}.panel{min-width:0;border:1px solid #ffffff14;border-radius:22px;background:#0f1420;padding:20px;box-shadow:0 24px 70px #0005}.panel-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}.panel-title h3{margin:0}.panel-title small{color:#64748b}.query-bar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(130px,180px) 110px;gap:9px;margin-bottom:14px}.search-form{display:flex;gap:8px}.search-form input{min-width:0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:12px;border-bottom:1px solid #ffffff10;text-align:left;white-space:nowrap}th{color:#94a3b8;font-size:11px;text-transform:uppercase}.actions{display:flex;gap:6px}.empty{text-align:center;color:#64748b;padding:42px}.pagination{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;color:#94a3b8;font-size:12px}form{display:grid;gap:15px}label>span{display:block;margin-bottom:7px;color:#cbd5e1;font-size:12px;font-weight:700}label b{color:#fda4af}label small{display:block;margin-top:5px;color:#64748b}input:not(.checkbox),textarea,select{width:100%;border:1px solid #ffffff1a;border-radius:12px;background:#070a11;color:#f8fafc;padding:11px 12px;outline:none}input:focus,textarea:focus,select:focus{border-color:#8b5cf6}.checkbox{width:20px;height:20px;accent-color:#8b5cf6}.primary,.secondary,.ghost,.danger{border:0;border-radius:11px;padding:10px 14px;font-weight:700;cursor:pointer}.primary,.secondary{background:linear-gradient(120deg,#7c3aed,#0891b2);color:white}.primary{width:100%;margin-top:4px}.ghost{background:#ffffff0c;color:#cbd5e1}.danger{background:#ef44441a;color:#fca5a5}.ghost:disabled,.primary:disabled{opacity:.45;cursor:not-allowed}.error{border:1px solid #ef444455;background:#ef444414;color:#fecaca;padding:12px 16px;border-radius:13px}@media(max-width:1100px){.query-bar{grid-template-columns:1fr 1fr}.search-form{grid-column:1/-1}}@media(max-width:960px){.app-shell{grid-template-columns:1fr}.sidebar{border-right:0;border-bottom:1px solid #ffffff14}.sidebar nav{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.health{margin-top:0}.content-grid{grid-template-columns:1fr}}@media(max-width:600px){.workspace-header{align-items:stretch;flex-direction:column}.workspace{padding:20px}.panel{padding:14px}.sidebar{padding:22px 18px}.query-bar{grid-template-columns:1fr}.search-form{grid-column:auto}.pagination{justify-content:space-between}}`),
  ]
}

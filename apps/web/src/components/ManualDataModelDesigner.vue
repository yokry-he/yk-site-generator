<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, DatabaseZap, Link2, Plus, Settings2, Trash2 } from 'lucide-vue-next'
import {
  MANUAL_FIELD_TYPES,
  MANUAL_RELATION_ON_DELETE_ACTIONS,
  MANUAL_SORT_DIRECTIONS,
  MAX_MANUAL_ENTITIES,
  MAX_MANUAL_FIELDS_PER_ENTITY,
  MAX_MANUAL_RELATIONS_PER_ENTITY,
  lowerFirst,
  normalizeManualEntities,
  relationIdField,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
  type ManualFieldType,
  type ManualListDefinition,
  type ManualRelationDefinition,
  type ManualRelationOnDelete,
  type ManualSortDirection,
} from 'shared'

const props = defineProps<{ modelValue: ManualEntityDefinition[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: ManualEntityDefinition[]] }>()
const activeIndex = ref(0)

const fieldTypeLabels: Record<ManualFieldType, string> = {
  text: '短文本',
  'long-text': '长文本',
  integer: '整数',
  decimal: '小数',
  boolean: '布尔值',
  date: '日期',
  datetime: '日期时间',
  enum: '枚举',
}

const onDeleteLabels: Record<ManualRelationOnDelete, string> = {
  restrict: '阻止删除',
  cascade: '级联删除',
  'set-null': '清空外键',
}

const sortDirectionLabels: Record<ManualSortDirection, string> = {
  asc: '升序',
  desc: '降序',
}

const activeEntity = computed(() => props.modelValue[activeIndex.value])
const availableRelationTargets = computed(() => props.modelValue.slice(0, activeIndex.value))
const sortableOptions = computed(() => {
  const entity = activeEntity.value
  if (!entity) return []
  return [
    { value: 'id', label: 'ID' },
    { value: 'createdAt', label: '创建时间' },
    { value: 'updatedAt', label: '更新时间' },
    ...entity.fields.filter((field) => field.sortable !== false).map((field) => ({ value: field.name, label: field.label })),
    ...(entity.relations ?? []).filter((relation) => relation.sortable !== false).map((relation) => ({ value: relationIdField(relation), label: relation.label })),
  ]
})
const validationMessage = computed(() => {
  try {
    normalizeManualEntities(props.modelValue)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : '数据模型配置不合法'
  }
})

function defaultList(): ManualListDefinition {
  return { pageSize: 20, defaultSortField: 'id', defaultSortDirection: 'desc' }
}

function cloneEntities(): ManualEntityDefinition[] {
  return props.modelValue.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => ({
      ...field,
      enumValues: field.enumValues ? [...field.enumValues] : undefined,
    })),
    relations: entity.relations?.map((relation) => ({ ...relation })) ?? [],
    list: entity.list ? { ...entity.list } : defaultList(),
  }))
}

function updateEntity(patch: Partial<ManualEntityDefinition>) {
  const next = cloneEntities()
  next[activeIndex.value] = { ...next[activeIndex.value], ...patch }
  emit('update:modelValue', next)
}

function updateList(patch: Partial<ManualListDefinition>) {
  const next = cloneEntities()
  const entity = next[activeIndex.value]
  entity.list = { ...(entity.list ?? defaultList()), ...patch }
  emit('update:modelValue', next)
}

function updateField(index: number, patch: Partial<ManualFieldDefinition>) {
  const next = cloneEntities()
  const entity = next[activeIndex.value]
  const current = entity.fields[index]
  entity.fields[index] = { ...current, ...patch }
  if (patch.sortable === false && entity.list?.defaultSortField === current.name) {
    entity.list = { ...(entity.list ?? defaultList()), defaultSortField: 'id' }
  }
  emit('update:modelValue', next)
}

function updateRelation(index: number, patch: Partial<ManualRelationDefinition>) {
  const next = cloneEntities()
  const entity = next[activeIndex.value]
  const current = entity.relations?.[index]
  if (!current) return
  entity.relations![index] = { ...current, ...patch }
  if (patch.sortable === false && entity.list?.defaultSortField === relationIdField(current)) {
    entity.list = { ...(entity.list ?? defaultList()), defaultSortField: 'id' }
  }
  emit('update:modelValue', next)
}

function addEntity() {
  if (props.modelValue.length >= MAX_MANUAL_ENTITIES) return
  const number = props.modelValue.length + 1
  const next = cloneEntities()
  next.push({
    name: `Resource${number}`,
    label: `资源${number}`,
    pluralLabel: `资源${number}管理`,
    route: `/resources-${number}`,
    fields: [{
      name: 'name',
      label: '名称',
      type: 'text',
      required: true,
      searchable: true,
      sortable: true,
      showInList: true,
      showInForm: true,
    }],
    relations: [],
    list: defaultList(),
  })
  emit('update:modelValue', next)
  activeIndex.value = next.length - 1
}

function duplicateEntity() {
  const source = activeEntity.value
  if (!source || props.modelValue.length >= MAX_MANUAL_ENTITIES) return
  const number = props.modelValue.length + 1
  const next = cloneEntities()
  next.push({
    ...source,
    name: `${source.name}Copy${number}`,
    label: `${source.label}副本`,
    pluralLabel: `${source.pluralLabel}副本`,
    route: `${source.route}-copy-${number}`,
    fields: source.fields.map((field) => ({ ...field, enumValues: field.enumValues ? [...field.enumValues] : undefined })),
    relations: source.relations?.map((relation) => ({ ...relation })) ?? [],
    list: source.list ? { ...source.list } : defaultList(),
  })
  emit('update:modelValue', next)
  activeIndex.value = next.length - 1
}

function removeEntity() {
  if (props.modelValue.length <= 1) return
  const next = cloneEntities()
  const removedName = next[activeIndex.value].name
  next.splice(activeIndex.value, 1)
  for (const entity of next) {
    const removedRelationIds = new Set((entity.relations ?? [])
      .filter((relation) => relation.targetEntity === removedName)
      .map(relationIdField))
    entity.relations = (entity.relations ?? []).filter((relation) => relation.targetEntity !== removedName)
    if (entity.list && removedRelationIds.has(entity.list.defaultSortField)) entity.list.defaultSortField = 'id'
  }
  activeIndex.value = Math.max(0, Math.min(activeIndex.value, next.length - 1))
  emit('update:modelValue', next)
}

function addField() {
  const entity = activeEntity.value
  if (!entity || entity.fields.length >= MAX_MANUAL_FIELDS_PER_ENTITY) return
  const next = cloneEntities()
  const fields = next[activeIndex.value].fields
  const number = fields.length + 1
  fields.push({
    name: `field${number}`,
    label: `字段${number}`,
    type: 'text',
    required: false,
    searchable: true,
    sortable: true,
    showInList: true,
    showInForm: true,
  })
  emit('update:modelValue', next)
}

function removeField(index: number) {
  const entity = activeEntity.value
  if (!entity || entity.fields.length <= 1) return
  const next = cloneEntities()
  const removedName = next[activeIndex.value].fields[index].name
  next[activeIndex.value].fields.splice(index, 1)
  if (next[activeIndex.value].list?.defaultSortField === removedName) next[activeIndex.value].list!.defaultSortField = 'id'
  emit('update:modelValue', next)
}

function updateEnumValues(index: number, value: string) {
  updateField(index, { enumValues: value.split(',').map((item) => item.trim()).filter(Boolean) })
}

function fieldCanSearch(field: ManualFieldDefinition): boolean {
  return field.type === 'text' || field.type === 'long-text' || field.type === 'enum'
}

function changeFieldType(index: number, type: ManualFieldType) {
  const field = activeEntity.value?.fields[index]
  if (!field) return
  updateField(index, {
    type,
    enumValues: type === 'enum' ? (field.enumValues?.length ? field.enumValues : ['draft', 'active']) : undefined,
    searchable: type === 'text' || type === 'long-text' || type === 'enum',
  })
}

function addRelation() {
  const entity = activeEntity.value
  const target = availableRelationTargets.value[availableRelationTargets.value.length - 1]
  if (!entity || !target || (entity.relations?.length ?? 0) >= MAX_MANUAL_RELATIONS_PER_ENTITY) return
  const next = cloneEntities()
  const relations = next[activeIndex.value].relations ?? []
  const existing = new Set(relations.map((relation) => relation.name))
  const base = lowerFirst(target.name)
  let name = base
  let suffix = 2
  while (existing.has(name) || entity.fields.some((field) => field.name === name || field.name === `${name}Id`)) {
    name = `${base}${suffix}`
    suffix += 1
  }
  relations.push({
    name,
    label: target.label,
    targetEntity: target.name,
    required: false,
    onDelete: 'set-null',
    sortable: true,
    showInList: true,
    showInForm: true,
  })
  next[activeIndex.value].relations = relations
  emit('update:modelValue', next)
}

function removeRelation(index: number) {
  const next = cloneEntities()
  const entity = next[activeIndex.value]
  const relation = entity.relations?.[index]
  if (!relation) return
  entity.relations!.splice(index, 1)
  if (entity.list?.defaultSortField === relationIdField(relation)) entity.list.defaultSortField = 'id'
  emit('update:modelValue', next)
}

function updateRelationRequired(index: number, required: boolean) {
  const relation = activeEntity.value?.relations?.[index]
  if (!relation) return
  updateRelation(index, { required, onDelete: required && relation.onDelete === 'set-null' ? 'restrict' : relation.onDelete })
}
</script>

<template>
  <article class="rounded-3xl border border-line/10 bg-soft/60 p-5 sm:p-7">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><DatabaseZap class="h-5 w-5" /></span>
        <div><h2 class="text-base font-semibold text-ink">4. 数据模型、关系与 CRUD</h2><p class="mt-1 text-xs leading-5 text-mut">同一份配置会生成外键、迁移、分页查询、OpenAPI、后端 CRUD 和 Vue 管理界面。</p></div>
      </div>
      <button :disabled="modelValue.length >= MAX_MANUAL_ENTITIES" class="flex items-center gap-1.5 rounded-xl border border-line/10 px-3 py-2 text-xs font-semibold text-sub hover:border-brand1/25 hover:text-ink disabled:opacity-40" @click="addEntity"><Plus class="h-3.5 w-3.5" />新增实体</button>
    </div>

    <div class="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="数据实体">
      <button v-for="(entity, index) in modelValue" :key="`${entity.name}-${index}`" role="tab" :aria-selected="activeIndex === index" class="min-w-32 rounded-xl border px-3 py-2 text-left" :class="activeIndex === index ? 'border-brand1/35 bg-brand1/[0.075]' : 'border-line/10 bg-app/45'" @click="activeIndex = index"><strong class="block truncate text-xs text-ink">{{ entity.label || entity.name || `实体 ${index + 1}` }}</strong><span class="mt-1 block truncate font-mono text-[9px] text-faint">{{ entity.route }}</span></button>
    </div>

    <div v-if="activeEntity" class="mt-4 rounded-2xl border border-line/10 bg-app/35 p-4 sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-ink">实体设置</h3>
        <div class="flex gap-2"><button :disabled="modelValue.length >= MAX_MANUAL_ENTITIES" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] text-mut hover:bg-ink/5 hover:text-ink disabled:opacity-40" @click="duplicateEntity"><Copy class="h-3 w-3" />复制</button><button :disabled="modelValue.length <= 1" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] text-red-500 hover:bg-red-500/[0.06] disabled:opacity-35" @click="removeEntity"><Trash2 class="h-3 w-3" />删除</button></div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="text-[10px] font-semibold text-sub">代码名称（PascalCase）<input :value="activeEntity.name" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs text-ink outline-none focus:border-brand1/35" @input="updateEntity({ name: ($event.target as HTMLInputElement).value })" /></label>
        <label class="text-[10px] font-semibold text-sub">单数显示名<input :value="activeEntity.label" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs text-ink outline-none focus:border-brand1/35" @input="updateEntity({ label: ($event.target as HTMLInputElement).value })" /></label>
        <label class="text-[10px] font-semibold text-sub">模块显示名<input :value="activeEntity.pluralLabel" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs text-ink outline-none focus:border-brand1/35" @input="updateEntity({ pluralLabel: ($event.target as HTMLInputElement).value })" /></label>
        <label class="text-[10px] font-semibold text-sub">API 路由<input :value="activeEntity.route" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand1/35" @input="updateEntity({ route: ($event.target as HTMLInputElement).value })" /></label>
      </div>

      <section class="mt-5 rounded-xl border border-line/10 bg-soft/45 p-3">
        <div class="flex items-center gap-2"><Settings2 class="h-4 w-4 text-brand1" /><h3 class="text-sm font-semibold text-ink">列表查询</h3></div>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <label class="text-[9px] font-semibold text-sub">每页数量<input :value="activeEntity.list?.pageSize ?? 20" type="number" min="5" max="100" step="5" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateList({ pageSize: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="text-[9px] font-semibold text-sub">默认排序<select :value="activeEntity.list?.defaultSortField ?? 'id'" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @change="updateList({ defaultSortField: ($event.target as HTMLSelectElement).value })"><option v-for="option in sortableOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
          <label class="text-[9px] font-semibold text-sub">默认方向<select :value="activeEntity.list?.defaultSortDirection ?? 'desc'" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @change="updateList({ defaultSortDirection: ($event.target as HTMLSelectElement).value as ManualSortDirection })"><option v-for="direction in MANUAL_SORT_DIRECTIONS" :key="direction" :value="direction">{{ sortDirectionLabels[direction] }}</option></select></label>
        </div>
      </section>

      <div class="mt-5 flex items-center justify-between gap-3"><div><h3 class="text-sm font-semibold text-ink">业务字段</h3><p class="mt-1 text-[10px] text-faint">系统会自动增加 id、createdAt 和 updatedAt。</p></div><button :disabled="activeEntity.fields.length >= MAX_MANUAL_FIELDS_PER_ENTITY" class="flex items-center gap-1.5 rounded-lg border border-line/10 px-3 py-2 text-[10px] font-semibold text-sub hover:text-ink disabled:opacity-40" @click="addField"><Plus class="h-3 w-3" />添加字段</button></div>

      <div class="mt-3 grid gap-3">
        <section v-for="(field, fieldIndex) in activeEntity.fields" :key="`${field.name}-${fieldIndex}`" class="rounded-xl border border-line/10 bg-soft/45 p-3">
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_auto]">
            <label class="text-[9px] font-semibold text-sub">字段名（camelCase）<input :value="field.name" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateField(fieldIndex, { name: ($event.target as HTMLInputElement).value })" /></label>
            <label class="text-[9px] font-semibold text-sub">显示名<input :value="field.label" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateField(fieldIndex, { label: ($event.target as HTMLInputElement).value })" /></label>
            <label class="text-[9px] font-semibold text-sub">类型<select :value="field.type" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @change="changeFieldType(fieldIndex, ($event.target as HTMLSelectElement).value as ManualFieldType)"><option v-for="type in MANUAL_FIELD_TYPES" :key="type" :value="type">{{ fieldTypeLabels[type] }}</option></select></label>
            <button :disabled="activeEntity.fields.length <= 1" class="self-end rounded-lg p-2 text-red-500 hover:bg-red-500/[0.06] disabled:opacity-30" :aria-label="`删除字段 ${field.label}`" @click="removeField(fieldIndex)"><Trash2 class="h-4 w-4" /></button>
          </div>
          <label v-if="field.type === 'enum'" class="mt-2 block text-[9px] font-semibold text-sub">枚举值（逗号分隔）<input :value="field.enumValues?.join(', ')" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateEnumValues(fieldIndex, ($event.target as HTMLInputElement).value)" /></label>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-mut">
            <label class="flex items-center gap-1.5"><input :checked="field.required" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { required: ($event.target as HTMLInputElement).checked })" />必填</label>
            <label class="flex items-center gap-1.5"><input :checked="field.unique" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { unique: ($event.target as HTMLInputElement).checked })" />唯一</label>
            <label class="flex items-center gap-1.5" :class="!fieldCanSearch(field) && 'opacity-45'"><input :checked="field.searchable" :disabled="!fieldCanSearch(field)" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { searchable: ($event.target as HTMLInputElement).checked })" />可搜索</label>
            <label class="flex items-center gap-1.5"><input :checked="field.sortable !== false" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { sortable: ($event.target as HTMLInputElement).checked })" />可排序</label>
            <label class="flex items-center gap-1.5"><input :checked="field.showInList !== false" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { showInList: ($event.target as HTMLInputElement).checked })" />列表展示</label>
            <label class="flex items-center gap-1.5"><input :checked="field.showInForm !== false" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { showInForm: ($event.target as HTMLInputElement).checked })" />表单展示</label>
          </div>
        </section>
      </div>

      <div class="mt-6 flex items-center justify-between gap-3"><div><h3 class="flex items-center gap-2 text-sm font-semibold text-ink"><Link2 class="h-4 w-4 text-brand1" />属于关系</h3><p class="mt-1 text-[10px] text-faint">外键目标必须是当前实体之前定义的实体，确保迁移顺序稳定且无循环。</p></div><button :disabled="!availableRelationTargets.length || (activeEntity.relations?.length ?? 0) >= MAX_MANUAL_RELATIONS_PER_ENTITY" class="flex items-center gap-1.5 rounded-lg border border-line/10 px-3 py-2 text-[10px] font-semibold text-sub hover:text-ink disabled:opacity-40" @click="addRelation"><Plus class="h-3 w-3" />添加关系</button></div>

      <p v-if="!availableRelationTargets.length" class="mt-3 rounded-xl border border-dashed border-line/10 px-3 py-4 text-[10px] leading-5 text-faint">第一个实体不能创建外键。先新增第二个实体，再让它关联前面的实体。</p>
      <div v-else class="mt-3 grid gap-3">
        <section v-for="(relation, relationIndex) in activeEntity.relations ?? []" :key="`${relation.name}-${relationIndex}`" class="rounded-xl border border-line/10 bg-soft/45 p-3">
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_150px_auto]">
            <label class="text-[9px] font-semibold text-sub">关系名（camelCase）<input :value="relation.name" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateRelation(relationIndex, { name: ($event.target as HTMLInputElement).value })" /></label>
            <label class="text-[9px] font-semibold text-sub">显示名<input :value="relation.label" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateRelation(relationIndex, { label: ($event.target as HTMLInputElement).value })" /></label>
            <label class="text-[9px] font-semibold text-sub">目标实体<select :value="relation.targetEntity" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @change="updateRelation(relationIndex, { targetEntity: ($event.target as HTMLSelectElement).value })"><option v-for="target in availableRelationTargets" :key="target.name" :value="target.name">{{ target.label }} · {{ target.name }}</option></select></label>
            <label class="text-[9px] font-semibold text-sub">删除策略<select :value="relation.onDelete" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @change="updateRelation(relationIndex, { onDelete: ($event.target as HTMLSelectElement).value as ManualRelationOnDelete })"><option v-for="action in MANUAL_RELATION_ON_DELETE_ACTIONS" :key="action" :value="action" :disabled="relation.required && action === 'set-null'">{{ onDeleteLabels[action] }}</option></select></label>
            <button class="self-end rounded-lg p-2 text-red-500 hover:bg-red-500/[0.06]" :aria-label="`删除关系 ${relation.label}`" @click="removeRelation(relationIndex)"><Trash2 class="h-4 w-4" /></button>
          </div>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-mut">
            <label class="flex items-center gap-1.5"><input :checked="relation.required" type="checkbox" class="accent-violet-600" @change="updateRelationRequired(relationIndex, ($event.target as HTMLInputElement).checked)" />必填</label>
            <label class="flex items-center gap-1.5"><input :checked="relation.sortable !== false" type="checkbox" class="accent-violet-600" @change="updateRelation(relationIndex, { sortable: ($event.target as HTMLInputElement).checked })" />可排序</label>
            <label class="flex items-center gap-1.5"><input :checked="relation.showInList !== false" type="checkbox" class="accent-violet-600" @change="updateRelation(relationIndex, { showInList: ($event.target as HTMLInputElement).checked })" />列表展示</label>
            <label class="flex items-center gap-1.5"><input :checked="relation.showInForm !== false" type="checkbox" class="accent-violet-600" @change="updateRelation(relationIndex, { showInForm: ($event.target as HTMLInputElement).checked })" />表单展示</label>
            <span class="font-mono text-faint">字段：{{ relationIdField(relation) }}</span>
          </div>
        </section>
      </div>
    </div>

    <p v-if="validationMessage" class="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-500" role="alert">{{ validationMessage }}</p>
    <p v-else class="mt-4 text-[10px] text-emerald-600">数据模型有效：{{ modelValue.length }} 个实体，{{ modelValue.reduce((sum, entity) => sum + entity.fields.length, 0) }} 个业务字段，{{ modelValue.reduce((sum, entity) => sum + (entity.relations?.length ?? 0), 0) }} 个外键关系。</p>
  </article>
</template>

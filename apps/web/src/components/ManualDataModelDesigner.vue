<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, DatabaseZap, Plus, Trash2 } from 'lucide-vue-next'
import {
  MANUAL_FIELD_TYPES,
  MAX_MANUAL_ENTITIES,
  MAX_MANUAL_FIELDS_PER_ENTITY,
  normalizeManualEntities,
  type ManualEntityDefinition,
  type ManualFieldDefinition,
  type ManualFieldType,
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

const activeEntity = computed(() => props.modelValue[activeIndex.value])
const validationMessage = computed(() => {
  try {
    normalizeManualEntities(props.modelValue)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : '数据模型配置不合法'
  }
})

function cloneEntities(): ManualEntityDefinition[] {
  return props.modelValue.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => ({
      ...field,
      enumValues: field.enumValues ? [...field.enumValues] : undefined,
    })),
  }))
}

function updateEntity(patch: Partial<ManualEntityDefinition>) {
  const next = cloneEntities()
  next[activeIndex.value] = { ...next[activeIndex.value], ...patch }
  emit('update:modelValue', next)
}

function updateField(index: number, patch: Partial<ManualFieldDefinition>) {
  const next = cloneEntities()
  const entity = next[activeIndex.value]
  entity.fields[index] = { ...entity.fields[index], ...patch }
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
      showInList: true,
      showInForm: true,
    }],
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
  })
  emit('update:modelValue', next)
  activeIndex.value = next.length - 1
}

function removeEntity() {
  if (props.modelValue.length <= 1) return
  const next = cloneEntities()
  next.splice(activeIndex.value, 1)
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
    showInList: true,
    showInForm: true,
  })
  emit('update:modelValue', next)
}

function removeField(index: number) {
  const entity = activeEntity.value
  if (!entity || entity.fields.length <= 1) return
  const next = cloneEntities()
  next[activeIndex.value].fields.splice(index, 1)
  emit('update:modelValue', next)
}

function updateEnumValues(index: number, value: string) {
  updateField(index, { enumValues: value.split(',').map((item) => item.trim()).filter(Boolean) })
}
</script>

<template>
  <article class="rounded-3xl border border-line/10 bg-soft/60 p-5 sm:p-7">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500"><DatabaseZap class="h-5 w-5" /></span>
        <div><h2 class="text-base font-semibold text-ink">4. 数据模型与 CRUD</h2><p class="mt-1 text-xs leading-5 text-mut">实体配置会同时生成数据库表、迁移、OpenAPI、后端 CRUD 和 Vue 管理界面。</p></div>
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

      <div class="mt-5 flex items-center justify-between gap-3"><div><h3 class="text-sm font-semibold text-ink">业务字段</h3><p class="mt-1 text-[10px] text-faint">系统会自动增加 id、createdAt 和 updatedAt。</p></div><button :disabled="activeEntity.fields.length >= MAX_MANUAL_FIELDS_PER_ENTITY" class="flex items-center gap-1.5 rounded-lg border border-line/10 px-3 py-2 text-[10px] font-semibold text-sub hover:text-ink disabled:opacity-40" @click="addField"><Plus class="h-3 w-3" />添加字段</button></div>

      <div class="mt-3 grid gap-3">
        <section v-for="(field, fieldIndex) in activeEntity.fields" :key="`${field.name}-${fieldIndex}`" class="rounded-xl border border-line/10 bg-soft/45 p-3">
          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_150px_auto]">
            <label class="text-[9px] font-semibold text-sub">字段名（camelCase）<input :value="field.name" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateField(fieldIndex, { name: ($event.target as HTMLInputElement).value })" /></label>
            <label class="text-[9px] font-semibold text-sub">显示名<input :value="field.label" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateField(fieldIndex, { label: ($event.target as HTMLInputElement).value })" /></label>
            <label class="text-[9px] font-semibold text-sub">类型<select :value="field.type" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @change="updateField(fieldIndex, { type: ($event.target as HTMLSelectElement).value as ManualFieldType, enumValues: ($event.target as HTMLSelectElement).value === 'enum' ? (field.enumValues?.length ? field.enumValues : ['draft', 'active']) : undefined })"><option v-for="type in MANUAL_FIELD_TYPES" :key="type" :value="type">{{ fieldTypeLabels[type] }}</option></select></label>
            <button :disabled="activeEntity.fields.length <= 1" class="self-end rounded-lg p-2 text-red-500 hover:bg-red-500/[0.06] disabled:opacity-30" :aria-label="`删除字段 ${field.label}`" @click="removeField(fieldIndex)"><Trash2 class="h-4 w-4" /></button>
          </div>
          <label v-if="field.type === 'enum'" class="mt-2 block text-[9px] font-semibold text-sub">枚举值（逗号分隔）<input :value="field.enumValues?.join(', ')" class="mt-1 w-full rounded-lg border border-line/10 bg-app/70 px-2.5 py-2 text-xs text-ink outline-none" @input="updateEnumValues(fieldIndex, ($event.target as HTMLInputElement).value)" /></label>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-mut">
            <label class="flex items-center gap-1.5"><input :checked="field.required" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { required: ($event.target as HTMLInputElement).checked })" />必填</label>
            <label class="flex items-center gap-1.5"><input :checked="field.unique" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { unique: ($event.target as HTMLInputElement).checked })" />唯一</label>
            <label class="flex items-center gap-1.5"><input :checked="field.showInList !== false" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { showInList: ($event.target as HTMLInputElement).checked })" />列表展示</label>
            <label class="flex items-center gap-1.5"><input :checked="field.showInForm !== false" type="checkbox" class="accent-violet-600" @change="updateField(fieldIndex, { showInForm: ($event.target as HTMLInputElement).checked })" />表单展示</label>
          </div>
        </section>
      </div>
    </div>

    <p v-if="validationMessage" class="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-500" role="alert">{{ validationMessage }}</p>
    <p v-else class="mt-4 text-[10px] text-emerald-600">数据模型有效：{{ modelValue.length }} 个实体，{{ modelValue.reduce((sum, entity) => sum + entity.fields.length, 0) }} 个业务字段。</p>
  </article>
</template>

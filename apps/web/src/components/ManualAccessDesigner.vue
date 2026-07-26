<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Clock3, Database, KeyRound, Plus, RotateCcw, ShieldCheck, Trash2 } from 'lucide-vue-next'
import {
  MANUAL_PERMISSION_ACTIONS,
  MAX_MANUAL_ACTIVE_SESSIONS,
  MAX_MANUAL_ROLES,
  MAX_MANUAL_SESSION_TTL_SECONDS,
  MIN_MANUAL_ACTIVE_SESSIONS,
  MIN_MANUAL_SESSION_TTL_SECONDS,
  cloneManualAccess,
  normalizeManualAccess,
  normalizeManualSession,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
  type ManualPermissionAction,
  type ManualRoleDefinition,
} from 'shared'

const props = defineProps<{
  modelValue: ManualAccessDefinition
  entities: ManualEntityDefinition[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ManualAccessDefinition] }>()
const activeIndex = ref(0)

const actionLabels: Record<ManualPermissionAction, string> = {
  list: '列表',
  read: '详情',
  create: '新建',
  update: '修改',
  delete: '删除',
}

const activeRole = computed(() => props.modelValue.roles[activeIndex.value])
const session = computed(() => normalizeManualSession(props.modelValue.session))
const validationMessage = computed(() => {
  try {
    normalizeManualAccess(props.modelValue, props.entities)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : '角色权限配置不合法'
  }
})
const permissionCount = computed(() => props.modelValue.roles.reduce(
  (sum, role) => sum + role.permissions.reduce((roleSum, permission) => roleSum + permission.actions.length, 0),
  0,
))

watch(() => props.modelValue.roles.length, (length) => {
  activeIndex.value = Math.max(0, Math.min(activeIndex.value, length - 1))
})

function updateAccess(transform: (next: ManualAccessDefinition) => void) {
  const next = cloneManualAccess(props.modelValue)
  transform(next)
  emit('update:modelValue', next)
}

function updateSession(patch: Partial<NonNullable<ManualAccessDefinition['session']>>) {
  updateAccess((next) => {
    next.session = { ...normalizeManualSession(next.session), ...patch }
  })
}

function updateRole(patch: Partial<ManualRoleDefinition>) {
  updateAccess((next) => {
    next.roles[activeIndex.value] = { ...next.roles[activeIndex.value], ...patch }
  })
}

function roleActions(role: ManualRoleDefinition, entityName: string): ManualPermissionAction[] {
  return role.permissions.find((permission) => permission.entity === entityName)?.actions ?? []
}

function toggleAction(entityName: string, action: ManualPermissionAction, checked: boolean) {
  updateAccess((next) => {
    const role = next.roles[activeIndex.value]
    let permission = role.permissions.find((item) => item.entity === entityName)
    if (!permission) {
      permission = { entity: entityName, actions: [] }
      role.permissions.push(permission)
    }
    const actions = new Set(permission.actions)
    if (checked) actions.add(action)
    else actions.delete(action)
    permission.actions = MANUAL_PERMISSION_ACTIONS.filter((item) => actions.has(item))
  })
}

function applyPreset(actions: readonly ManualPermissionAction[]) {
  updateAccess((next) => {
    next.roles[activeIndex.value].permissions = props.entities.map((entity) => ({
      entity: entity.name,
      actions: [...actions],
    }))
  })
}

function addRole() {
  if (props.modelValue.roles.length >= MAX_MANUAL_ROLES) return
  const used = new Set(props.modelValue.roles.map((role) => role.key))
  let number = props.modelValue.roles.length + 1
  let key = `custom-role-${number}`
  while (used.has(key)) {
    number += 1
    key = `custom-role-${number}`
  }
  updateAccess((next) => {
    next.roles.push({
      key,
      label: `自定义角色 ${number}`,
      description: '按资源配置允许的操作。',
      permissions: props.entities.map((entity) => ({ entity: entity.name, actions: ['list', 'read'] })),
    })
  })
  activeIndex.value = props.modelValue.roles.length
}

function removeRole() {
  if (props.modelValue.roles.length <= 1) return
  updateAccess((next) => {
    next.roles.splice(activeIndex.value, 1)
  })
  activeIndex.value = Math.max(0, activeIndex.value - 1)
}
</script>

<template>
  <article class="rounded-3xl border border-line/10 bg-soft/60 p-5 sm:p-7">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><ShieldCheck class="h-5 w-5" /></span>
        <div>
          <h2 class="text-base font-semibold text-ink">5. 认证与角色权限</h2>
          <p class="mt-1 text-xs leading-5 text-mut">配置角色对每个实体的权限，并可选择生成持久化用户与 Session 数据模型。</p>
        </div>
      </div>
      <button :disabled="modelValue.roles.length >= MAX_MANUAL_ROLES" class="flex items-center gap-1.5 rounded-xl border border-line/10 px-3 py-2 text-xs font-semibold text-sub hover:border-brand1/25 hover:text-ink disabled:opacity-40" @click="addRole"><Plus class="h-3.5 w-3.5" />新增角色</button>
    </div>

    <label class="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-line/10 bg-app/45 p-4">
      <span><strong class="block text-xs text-ink">生成认证与路由权限代码</strong><small class="mt-1 block text-[10px] leading-5 text-mut">生成代码后运行时仍默认关闭，只有设置 AUTH_ENABLED=true 才会保护 API。</small></span>
      <input :checked="modelValue.enabled" type="checkbox" class="h-5 w-5 accent-violet-600" aria-label="生成认证与路由权限代码" @change="updateAccess((next) => { next.enabled = ($event.target as HTMLInputElement).checked })" />
    </label>

    <section class="mt-3 rounded-2xl border border-line/10 bg-app/45 p-4">
      <label class="flex items-center justify-between gap-4">
        <span class="flex min-w-0 gap-3"><Database class="mt-0.5 h-4 w-4 shrink-0 text-brand1" /><span><strong class="block text-xs text-ink">生成持久化用户与 Session 数据层</strong><small class="mt-1 block text-[10px] leading-5 text-mut">为五套后端增加用户表、Session 表、迁移和安全协议。当前 Bearer 路由保护仍保持不变。</small></span></span>
        <input :checked="Boolean(modelValue.persistentSessions)" type="checkbox" class="h-5 w-5 accent-violet-600" aria-label="生成持久化用户与 Session 数据层" @change="updateAccess((next) => { next.persistentSessions = ($event.target as HTMLInputElement).checked })" />
      </label>
      <div v-if="modelValue.persistentSessions" class="mt-4 grid gap-3 border-t border-line/10 pt-4 sm:grid-cols-2">
        <label class="text-[10px] font-semibold text-sub"><span class="flex items-center gap-1.5"><Clock3 class="h-3.5 w-3.5" />Session 有效期（秒）</span><input :value="session.ttlSeconds" type="number" :min="MIN_MANUAL_SESSION_TTL_SECONDS" :max="MAX_MANUAL_SESSION_TTL_SECONDS" step="900" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs text-ink outline-none focus:border-brand1/35" @input="updateSession({ ttlSeconds: Number(($event.target as HTMLInputElement).value) })" /></label>
        <label class="text-[10px] font-semibold text-sub">单用户活动 Session 上限<input :value="session.maxActiveSessions" type="number" :min="MIN_MANUAL_ACTIVE_SESSIONS" :max="MAX_MANUAL_ACTIVE_SESSIONS" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs text-ink outline-none focus:border-brand1/35" @input="updateSession({ maxActiveSessions: Number(($event.target as HTMLInputElement).value) })" /></label>
      </div>
    </section>

    <div class="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="访问角色">
      <button v-for="(role, index) in modelValue.roles" :key="`${role.key}-${index}`" role="tab" :aria-selected="activeIndex === index" class="min-w-36 rounded-xl border px-3 py-2 text-left" :class="activeIndex === index ? 'border-brand1/35 bg-brand1/[0.075]' : 'border-line/10 bg-app/45'" @click="activeIndex = index"><strong class="block truncate text-xs text-ink">{{ role.label || role.key }}</strong><span class="mt-1 block truncate font-mono text-[9px] text-faint">{{ role.key }}</span></button>
    </div>

    <section v-if="activeRole" class="mt-4 rounded-2xl border border-line/10 bg-app/35 p-4 sm:p-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div><h3 class="flex items-center gap-2 text-sm font-semibold text-ink"><KeyRound class="h-4 w-4 text-brand1" />角色设置</h3><p class="mt-1 text-[10px] text-faint">角色标识会写入认证策略与持久化用户角色字段。</p></div>
        <button :disabled="modelValue.roles.length <= 1" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] text-red-500 hover:bg-red-500/[0.06] disabled:opacity-35" @click="removeRole"><Trash2 class="h-3 w-3" />删除角色</button>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="text-[10px] font-semibold text-sub">角色标识<input :value="activeRole.key" maxlength="32" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 font-mono text-xs text-ink outline-none focus:border-brand1/35" @input="updateRole({ key: ($event.target as HTMLInputElement).value })" /></label>
        <label class="text-[10px] font-semibold text-sub">角色名称<input :value="activeRole.label" maxlength="60" class="mt-1.5 w-full rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs text-ink outline-none focus:border-brand1/35" @input="updateRole({ label: ($event.target as HTMLInputElement).value })" /></label>
        <label class="text-[10px] font-semibold text-sub sm:col-span-2">角色说明<textarea :value="activeRole.description ?? ''" rows="2" maxlength="240" class="mt-1.5 w-full resize-y rounded-lg border border-line/10 bg-app/70 px-3 py-2 text-xs leading-5 text-ink outline-none focus:border-brand1/35" @input="updateRole({ description: ($event.target as HTMLTextAreaElement).value })" /></label>
      </div>

      <div class="mt-5 flex flex-wrap items-center gap-2">
        <span class="mr-1 text-[10px] font-semibold text-faint">快速预设</span>
        <button class="flex items-center gap-1 rounded-lg border border-line/10 px-2.5 py-1.5 text-[10px] text-sub hover:text-ink" @click="applyPreset(MANUAL_PERMISSION_ACTIONS)"><RotateCcw class="h-3 w-3" />完整权限</button>
        <button class="rounded-lg border border-line/10 px-2.5 py-1.5 text-[10px] text-sub hover:text-ink" @click="applyPreset(['list', 'read', 'create', 'update'])">编辑预设</button>
        <button class="rounded-lg border border-line/10 px-2.5 py-1.5 text-[10px] text-sub hover:text-ink" @click="applyPreset(['list', 'read'])">只读预设</button>
        <button class="rounded-lg border border-line/10 px-2.5 py-1.5 text-[10px] text-sub hover:text-ink" @click="applyPreset([])">清空权限</button>
      </div>

      <div class="mt-4 overflow-x-auto rounded-xl border border-line/10">
        <table class="min-w-[680px] w-full border-collapse text-left text-[10px]">
          <thead class="bg-soft/70 text-faint"><tr><th class="px-3 py-2.5 font-semibold">资源</th><th v-for="action in MANUAL_PERMISSION_ACTIONS" :key="action" class="px-3 py-2.5 text-center font-semibold">{{ actionLabels[action] }}</th></tr></thead>
          <tbody>
            <tr v-for="entity in entities" :key="entity.name" class="border-t border-line/10">
              <th class="px-3 py-3"><strong class="block text-xs text-ink">{{ entity.pluralLabel || entity.label }}</strong><span class="mt-1 block font-mono text-[9px] text-faint">{{ entity.name }}</span></th>
              <td v-for="action in MANUAL_PERMISSION_ACTIONS" :key="action" class="px-3 py-3 text-center"><input :checked="roleActions(activeRole, entity.name).includes(action)" type="checkbox" class="h-4 w-4 accent-violet-600" :aria-label="`${activeRole.label} ${entity.label} ${actionLabels[action]}`" @change="toggleAction(entity.name, action, ($event.target as HTMLInputElement).checked)" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p v-if="validationMessage" class="mt-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] px-3 py-2.5 text-[10px] leading-5 text-red-500" role="alert">{{ validationMessage }}</p>
    <p v-else class="mt-4 text-[10px] text-emerald-600">权限配置有效：{{ modelValue.roles.length }} 个角色 · {{ permissionCount }} 项资源动作<span v-if="modelValue.persistentSessions"> · 持久化 Session 数据层</span>。</p>
  </article>
</template>

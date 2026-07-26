<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Container,
  Database,
  Download,
  FileCode2,
  Loader2,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from 'lucide-vue-next'
import {
  BACKEND_STACK_PROFILES,
  DEFAULT_MANUAL_ENTITIES,
  backendDatabaseLabel,
  createDefaultManualAccess,
  getBackendStackProfile,
  normalizeManualAccess,
  normalizeManualEntities,
  reconcileManualAccessEntities,
  type BackendDatabaseId,
  type BackendStackId,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
} from 'shared'
import ManualAccessDesigner from '../components/ManualAccessDesigner.vue'
import ManualDataModelDesigner from '../components/ManualDataModelDesigner.vue'
import { useToast } from '../composables/useToast'
import { buildManualAccessProjectZip, createManualAccessProjectScaffold } from '../lib/manualAccessProjectScaffold'

function initialEntities(): ManualEntityDefinition[] {
  return DEFAULT_MANUAL_ENTITIES.map((entity) => ({
    ...entity,
    fields: entity.fields.map((field) => ({ ...field, enumValues: field.enumValues ? [...field.enumValues] : undefined })),
    relations: entity.relations?.map((relation) => ({ ...relation })) ?? [],
    list: entity.list ? { ...entity.list } : undefined,
  }))
}

const toast = useToast()
const name = ref('现代任务管理系统')
const description = ref('包含 Vue 前端、类型化 API、数据库迁移、测试与 Docker 的全栈工程。')
const backendStack = ref<BackendStackId>('hono-drizzle')
const database = ref<BackendDatabaseId>('sqlite')
const includeDocker = ref(true)
const includeGithubActions = ref(true)
const generating = ref(false)
const entities = ref<ManualEntityDefinition[]>(initialEntities())
const access = ref<ManualAccessDefinition>(createDefaultManualAccess(entities.value))

const profile = computed(() => getBackendStackProfile(backendStack.value) ?? BACKEND_STACK_PROFILES[0])
const availableDatabases = computed(() => profile.value.databases)
const relationCount = computed(() => entities.value.reduce((sum, entity) => sum + (entity.relations?.length ?? 0), 0))
const modelError = computed(() => {
  try { normalizeManualEntities(entities.value); return '' }
  catch (error) { return error instanceof Error ? error.message : '数据模型配置不合法' }
})
const accessError = computed(() => {
  try {
    normalizeManualAccess(access.value, normalizeManualEntities(entities.value))
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : '角色权限配置不合法'
  }
})
const configurationError = computed(() => modelError.value || accessError.value)
const scaffold = computed(() => {
  try {
    return createManualAccessProjectScaffold({
      name: name.value || 'SiteForge App',
      description: description.value,
      backendStack: backendStack.value,
      database: database.value,
      includeDocker: includeDocker.value,
      includeGithubActions: includeGithubActions.value,
      entities: entities.value,
      access: access.value,
    })
  } catch {
    return null
  }
})

watch(profile, (next) => {
  if (!next.databases.includes(database.value)) database.value = next.recommendedDatabase
})

watch(entities, (next, previous) => {
  access.value = reconcileManualAccessEntities(access.value, previous ?? [], next)
})

async function downloadProject() {
  if (!name.value.trim()) {
    toast.error('请输入项目名称')
    return
  }
  if (modelError.value) {
    toast.error('数据模型不合法', modelError.value)
    return
  }
  if (accessError.value) {
    toast.error('角色权限不合法', accessError.value)
    return
  }
  generating.value = true
  try {
    const blob = await buildManualAccessProjectZip({
      name: name.value,
      description: description.value,
      backendStack: backendStack.value,
      database: database.value,
      includeDocker: includeDocker.value,
      includeGithubActions: includeGithubActions.value,
      entities: entities.value,
      access: access.value,
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${scaffold.value?.slug ?? 'siteforge-app'}.zip`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    toast.success('工程 ZIP 已生成', `${profile.value.name} · ${entities.value.length} 个 CRUD 模块 · ${access.value.roles.length} 个角色`)
  } catch (error) {
    toast.error('生成失败', error instanceof Error ? error.message : '请稍后重试')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <main class="min-h-[calc(100vh-4rem)] pt-20 pb-20">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <header class="flex flex-wrap items-center gap-3 border-b border-line/10 py-6">
        <RouterLink to="/projects" class="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-mut hover:bg-ink/5 hover:text-ink"><ArrowLeft class="h-4 w-4" />项目列表</RouterLink>
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2 text-xs font-semibold text-brand1"><Sparkles class="h-3.5 w-3.5" />确定性工程生成</p>
          <h1 class="mt-1 text-2xl font-bold text-ink">手动创建全栈项目</h1>
          <p class="mt-1 text-xs text-mut">不调用 AI，不需要 API Key；数据模型与角色矩阵会确定性生成前端、五套后端、数据库、权限和 OpenAPI。</p>
        </div>
      </header>

      <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <section class="space-y-6">
          <article class="rounded-3xl border border-line/10 bg-soft/60 p-5 sm:p-7">
            <div class="flex items-start gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-brand1/10 text-brand1"><FileCode2 class="h-5 w-5" /></span><div><h2 class="text-base font-semibold text-ink">1. 项目基础</h2><p class="mt-1 text-xs text-mut">名称和说明会写入 README、包信息与工程清单。</p></div></div>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <label class="text-xs font-semibold text-sub">项目名称<input v-model="name" maxlength="80" class="mt-2 w-full rounded-xl border border-line/10 bg-app/65 px-3.5 py-3 text-sm text-ink outline-none focus:border-brand1/35" /></label>
              <label class="text-xs font-semibold text-sub">工程标识<input :value="scaffold?.slug ?? 'siteforge-app'" disabled class="mt-2 w-full rounded-xl border border-line/10 bg-ink/[0.035] px-3.5 py-3 font-mono text-sm text-faint" /></label>
              <label class="text-xs font-semibold text-sub sm:col-span-2">项目说明<textarea v-model="description" rows="3" maxlength="500" class="mt-2 w-full resize-y rounded-xl border border-line/10 bg-app/65 p-3.5 text-sm leading-6 text-ink outline-none focus:border-brand1/35" /></label>
            </div>
          </article>

          <article class="rounded-3xl border border-line/10 bg-soft/60 p-5 sm:p-7">
            <div class="flex items-start gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-500"><ServerCog class="h-5 w-5" /></span><div><h2 class="text-base font-semibold text-ink">2. 后端技术栈</h2><p class="mt-1 text-xs text-mut">每个选项都有固定框架、ORM、迁移工具、命令和容器基线。</p></div></div>
            <div class="mt-5 grid gap-3 md:grid-cols-2">
              <button v-for="item in BACKEND_STACK_PROFILES" :key="item.id" class="rounded-2xl border p-4 text-left transition" :class="backendStack === item.id ? 'border-brand1/35 bg-brand1/[0.075] shadow-lg shadow-brand1/5' : 'border-line/10 bg-app/45 hover:border-brand1/20'" @click="backendStack = item.id">
                <div class="flex items-center justify-between gap-3"><strong class="text-sm text-ink">{{ item.name }}</strong><span v-if="item.recommended" class="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-ink">推荐</span><Check v-else-if="backendStack === item.id" class="h-4 w-4 text-brand1" /></div>
                <p class="mt-2 text-[11px] leading-5 text-mut">{{ item.description }}</p>
                <div class="mt-3 flex flex-wrap gap-1.5 text-[9px] text-faint"><span class="rounded bg-ink/5 px-2 py-1">{{ item.language }}</span><span class="rounded bg-ink/5 px-2 py-1">{{ item.runtime }}</span><span class="rounded bg-ink/5 px-2 py-1">{{ item.migrationTool }}</span></div>
              </button>
            </div>
          </article>

          <article class="rounded-3xl border border-line/10 bg-soft/60 p-5 sm:p-7">
            <div class="flex items-start gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><Database class="h-5 w-5" /></span><div><h2 class="text-base font-semibold text-ink">3. 数据库与工程设施</h2><p class="mt-1 text-xs text-mut">只显示当前后端已验证的数据库组合。</p></div></div>
            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <button v-for="item in availableDatabases" :key="item" class="rounded-2xl border p-4 text-left" :class="database === item ? 'border-brand1/35 bg-brand1/[0.075]' : 'border-line/10 bg-app/45'" @click="database = item"><strong class="text-sm text-ink">{{ backendDatabaseLabel(item) }}</strong><p class="mt-1 text-[10px] text-mut">{{ item === 'sqlite' ? '零服务、本地文件数据库，适合开发与轻量部署。' : '生产级关系数据库，适合容器和云环境。' }}</p></button>
            </div>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <label class="flex items-center gap-3 rounded-2xl border border-line/10 bg-app/45 p-4"><input v-model="includeDocker" type="checkbox" class="h-4 w-4 accent-violet-600" /><span><strong class="block text-xs text-ink">Docker / Compose</strong><small class="mt-1 block text-[10px] text-mut">生成前后端镜像和数据库服务。</small></span></label>
              <label class="flex items-center gap-3 rounded-2xl border border-line/10 bg-app/45 p-4"><input v-model="includeGithubActions" type="checkbox" class="h-4 w-4 accent-violet-600" /><span><strong class="block text-xs text-ink">GitHub Actions</strong><small class="mt-1 block text-[10px] text-mut">生成基础构建与测试工作流。</small></span></label>
            </div>
          </article>

          <ManualDataModelDesigner v-model="entities" />
          <ManualAccessDesigner v-model="access" :entities="entities" />
        </section>

        <aside class="h-fit space-y-4 xl:sticky xl:top-24">
          <article class="overflow-hidden rounded-3xl border border-line/10 bg-soft/70 shadow-xl shadow-black/5">
            <div class="bg-brand-gradient p-5 text-white"><p class="text-[10px] font-semibold tracking-widest uppercase opacity-75">生成摘要</p><h2 class="mt-2 text-xl font-bold">{{ profile.name }}</h2><p class="mt-2 text-xs leading-5 text-white/75">{{ profile.description }}</p></div>
            <div class="p-5">
              <dl class="grid gap-3 text-xs"><div class="flex justify-between gap-3"><dt class="text-faint">语言 / Runtime</dt><dd class="text-right font-semibold text-ink">{{ profile.language }} · {{ profile.runtime }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">ORM / 迁移</dt><dd class="text-right font-semibold text-ink">{{ profile.orm }} · {{ profile.migrationTool }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">数据库</dt><dd class="font-semibold text-ink">{{ backendDatabaseLabel(database) }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">CRUD 模块</dt><dd class="font-semibold text-ink">{{ entities.length }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">外键关系</dt><dd class="font-semibold text-ink">{{ relationCount }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">访问角色</dt><dd class="font-semibold text-ink">{{ access.roles.length }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">认证代码</dt><dd class="font-semibold text-ink">{{ access.enabled ? '生成' : '关闭' }}</dd></div><div class="flex justify-between gap-3"><dt class="text-faint">文件数量</dt><dd class="font-semibold text-ink">{{ scaffold?.files.length ?? 0 }}</dd></div></dl>
              <div class="mt-5 rounded-2xl border border-line/10 bg-app/45 p-4"><p class="flex items-center gap-2 text-xs font-semibold text-ink"><ShieldCheck class="h-4 w-4 text-emerald-500" />不会执行生成代码</p><p class="mt-2 text-[10px] leading-5 text-mut">本阶段只在浏览器中确定性拼装并下载源码 ZIP。后续隔离 Runner 完成前，SiteForge 不会运行用户工程。</p></div>
              <button :disabled="generating || !name.trim() || Boolean(configurationError)" class="bg-brand-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand1/20 disabled:opacity-45" @click="downloadProject"><Loader2 v-if="generating" class="h-4 w-4 animate-spin" /><Download v-else class="h-4 w-4" />{{ generating ? '正在生成…' : '生成并下载工程 ZIP' }}</button>
              <p v-if="configurationError" class="mt-2 text-[10px] leading-5 text-red-500">{{ configurationError }}</p>
            </div>
          </article>

          <article class="rounded-3xl border border-line/10 bg-soft/60 p-5"><h3 class="flex items-center gap-2 text-sm font-semibold text-ink"><Container class="h-4 w-4 text-brand1" />工程中包含</h3><ul class="mt-4 grid gap-2 text-[11px] text-mut"><li v-for="item in ['Vue 3 分页 CRUD 管理界面','搜索 / 排序 / 分页 API','外键与删除策略','自定义角色与 Bearer Token 权限','统一结构化 API 错误','OpenAPI、siteforge.json 与权限协议','.env.example、Docker 与双语 README']" :key="item" class="flex items-center gap-2"><ChevronRight class="h-3 w-3 text-brand1" />{{ item }}</li></ul></article>
        </aside>
      </div>
    </div>
  </main>
</template>

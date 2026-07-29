import type {
  ArtifactFile,
  BackendDatabaseId,
  ManualAccessDefinition,
  ManualEntityDefinition,
  ManualPermissionAction,
} from 'shared'
import { text } from './manualCrudHelpers'

interface RuntimeTarget {
  entity: string
  route: string
}

type RuntimeRules = Record<string, Record<string, ManualPermissionAction[]>>

export function replaceFile(
  files: ArtifactFile[],
  path: string,
  transform: (content: string) => string,
): void {
  const file = files.find((item) => item.path === path)
  if (!file) throw new Error(`认证脚手架缺少目标文件：${path}`)
  file.content = transform(file.content)
}

export function runtimeRules(access: ManualAccessDefinition): RuntimeRules {
  return Object.fromEntries(access.roles.map((role) => [
    role.key,
    Object.fromEntries(role.permissions.map((permission) => [
      permission.entity,
      permission.actions,
    ])),
  ]))
}

export function runtimeTargets(entities: readonly ManualEntityDefinition[]): RuntimeTarget[] {
  return [...entities]
    .sort((left, right) => right.route.length - left.route.length)
    .map((entity) => ({ entity: entity.name, route: `/api${entity.route}` }))
}

export function authPolicyFile(
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): ArtifactFile {
  return text('siteforge.auth.json', JSON.stringify({
    schemaVersion: 1,
    strategy: 'opaque-bearer',
    enabledByDefault: false,
    environment: {
      enabled: 'AUTH_ENABLED',
      identities: 'AUTH_IDENTITIES_JSON',
    },
    publicRoutes: ['/api/health'],
    identityShape: {
      token: 'secret',
      userId: 'string',
      email: 'string',
      role: access.roles.map((role) => role.key),
    },
    actions: ['list', 'read', 'create', 'update', 'delete'],
    resources: entities.map((entity) => ({ entity: entity.name, route: `/api${entity.route}` })),
    roles: access.roles,
  }, null, 2))
}

export function authEnvFile(database: BackendDatabaseId): ArtifactFile {
  const databaseUrl = database === 'sqlite'
    ? 'file:./data/app.db'
    : 'postgresql://siteforge:siteforge@localhost:5432/siteforge_app'
  return text('.env.example', `API_PORT=8787
DATABASE_URL=${databaseUrl}
VITE_API_BASE_URL=http://localhost:8787

# Route authentication is opt-in so existing local and Docker workflows keep working.
AUTH_ENABLED=false
AUTH_IDENTITIES_JSON=[{"token":"replace-with-at-least-32-random-characters","userId":"admin","email":"admin@example.com","role":"admin"}]
`)
}

export function authGuideFile(access: ManualAccessDefinition): ArtifactFile {
  const roleLinesZh = access.roles.map((role) => `- \`${role.key}\`: ${role.label} — ${role.description ?? ''}`).join('\n')
  const roleLinesEn = access.roles.map((role) => {
    const summary = role.permissions.map((permission) => `${permission.entity}: ${permission.actions.join('/')}`).join('; ')
    return `- \`${role.key}\`: ${summary}`
  }).join('\n')
  return text('AUTHORIZATION.md', `# Route Authentication / 路由认证

[中文](#中文) · [English](#english)

---

## 中文

生成工程包含可选的 Opaque Bearer Token 认证和资源级角色权限。运行时默认关闭，避免破坏现有本地启动流程。

### 启用

请使用真实随机 Token，并把环境变量直接传给 API 启动进程：

\`\`\`bash
AUTH_ENABLED=true \\
AUTH_IDENTITIES_JSON='[{"token":"replace-with-a-random-secret-at-least-32-characters","userId":"admin","email":"admin@example.com","role":"admin"}]' \\
pnpm dev
\`\`\`

\`.env.example\` 只提供变量格式示例。容器部署时必须把 \`AUTH_ENABLED\` 和 \`AUTH_IDENTITIES_JSON\` 显式注入 API 容器或部署平台 Secret；当前生成的 Compose 基线不会自动把这两个变量传入容器。

### 默认角色

${roleLinesZh}

权限动作统一为 \`list\`、\`read\`、\`create\`、\`update\` 和 \`delete\`。\`/api/health\` 保持公开；\`/api/auth/me\` 返回当前认证状态和公开身份字段。

认证启用但身份列表无效时返回 \`503 AUTH_NOT_CONFIGURED\`；Token 缺失或无效时返回 \`401 UNAUTHORIZED\`；角色无权执行操作时返回 \`403 FORBIDDEN\`。Token 在比较前使用 SHA-256 固定长度摘要，并通过各语言的常量时间原语比较。

生成的 Vue 管理端把 Token 保存在当前标签页的 \`sessionStorage\`，并为 API 请求添加 \`Authorization: Bearer ...\`。不要把真实 Token 提交到仓库、日志或截图。

当前阶段没有生成密码注册、持久化用户表、刷新 Token、服务端 Session、Token 轮换后台或自定义角色设计器；这些能力需要后续安全阶段完成。

---

## English

The generated project includes optional opaque bearer-token authentication and resource-level role permissions. Runtime enforcement is disabled by default to preserve the existing local startup path.

### Enable it

Use a real random token and pass the variables directly to the API process:

\`\`\`bash
AUTH_ENABLED=true \\
AUTH_IDENTITIES_JSON='[{"token":"replace-with-a-random-secret-at-least-32-characters","userId":"admin","email":"admin@example.com","role":"admin"}]' \\
pnpm dev
\`\`\`

\`.env.example\` documents the variable shape only. For container deployments, explicitly inject \`AUTH_ENABLED\` and \`AUTH_IDENTITIES_JSON\` into the API container or deployment-platform secret store. The current generated Compose baseline does not forward these two values automatically.

### Default roles

${roleLinesEn}

The shared actions are \`list\`, \`read\`, \`create\`, \`update\`, and \`delete\`. \`/api/health\` stays public, while \`/api/auth/me\` returns the current authentication status and public identity fields.

An enabled deployment with no valid identities returns \`503 AUTH_NOT_CONFIGURED\`; a missing or invalid token returns \`401 UNAUTHORIZED\`; and a role without the required action returns \`403 FORBIDDEN\`. Tokens are reduced to fixed-length SHA-256 digests before each language's constant-time comparison primitive is used.

The generated Vue admin stores the token in the current tab's \`sessionStorage\` and adds \`Authorization: Bearer ...\` to API requests. Never commit real tokens to the repository or expose them in logs or screenshots.

This phase does not generate password registration, a persistent user table, refresh tokens, server-side sessions, a token-rotation console, or a custom role designer. Those remain follow-up security work.
`)
}

export function frontendAuthFiles(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/web/src/App.vue', (content) => content
    .replace(
      "import { resources, type ResourceField, type ResourceRelation, type SortDirection } from './resources'",
      "import { resources, type ResourceField, type ResourceRelation, type SortDirection } from './resources'\nimport AuthPanel from './AuthPanel.vue'\nimport { authFetch } from './auth'",
    )
    .replaceAll('fetch(', 'authFetch(')
    .replace(
      'watch(activeKey, async () => {',
      `async function refreshAfterAuth() {
  await Promise.all([loadRelationOptions(), loadRecords()])
}

watch(activeKey, async () => {`,
    )
    .replace(
      '<a class="health" :href="apiBase + \'/api/health\'" target="_blank" rel="noreferrer">API 健康检查</a>',
      '<AuthPanel :api-base="apiBase" @changed="refreshAfterAuth" />\n      <a class="health" :href="apiBase + \'/api/health\'" target="_blank" rel="noreferrer">API 健康检查</a>',
    )
    .replace(
      '包含外键、搜索、排序、分页和完整 CRUD 的确定性管理端。',
      '包含外键、搜索、排序、分页、Bearer Token 与角色权限的确定性管理端。',
    ))

  return [
    text('apps/web/src/auth.ts', `const TOKEN_KEY = 'siteforge-auth-token'

export function getAuthToken(): string {
  return window.sessionStorage.getItem(TOKEN_KEY) || ''
}

export function setAuthToken(token: string): void {
  const value = token.trim()
  if (value) window.sessionStorage.setItem(TOKEN_KEY, value)
  else window.sessionStorage.removeItem(TOKEN_KEY)
}

export function clearAuthToken(): void {
  window.sessionStorage.removeItem(TOKEN_KEY)
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAuthToken()
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(input, { ...init, headers })
}
`),
    text('apps/web/src/AuthPanel.vue', `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { authFetch, clearAuthToken, getAuthToken, setAuthToken } from './auth'

const props = defineProps<{ apiBase: string }>()
const emit = defineEmits<{ changed: [] }>()
const token = ref(getAuthToken())
const status = ref('正在读取认证状态…')
const detail = ref('')
const busy = ref(false)

async function inspect() {
  busy.value = true
  try {
    const response = await authFetch(props.apiBase + '/api/auth/me')
    const body = await response.json().catch(() => ({})) as {
      enabled?: boolean
      identity?: { email?: string; role?: string; userId?: string } | null
      error?: string
    }
    if (!response.ok) {
      status.value = response.status === 503 ? '认证尚未配置' : 'Token 无效或缺失'
      detail.value = body.error || 'HTTP ' + response.status
      return
    }
    if (body.enabled === false) {
      status.value = '访问控制未启用'
      detail.value = '设置 AUTH_ENABLED=true 后启用路由保护'
      return
    }
    status.value = body.identity?.email || body.identity?.userId || '已认证'
    detail.value = body.identity?.role ? '角色：' + body.identity.role : '身份已验证'
  } catch (error) {
    status.value = '无法读取认证状态'
    detail.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    busy.value = false
  }
}

async function save() {
  setAuthToken(token.value)
  await inspect()
  emit('changed')
}

async function clear() {
  token.value = ''
  clearAuthToken()
  await inspect()
  emit('changed')
}

onMounted(inspect)
</script>

<template>
  <section class="auth-panel" aria-label="API 认证">
    <div>
      <strong>{{ status }}</strong>
      <small>{{ detail }}</small>
    </div>
    <input v-model="token" type="password" autocomplete="off" placeholder="Bearer Token" aria-label="Bearer Token" />
    <div class="actions">
      <button :disabled="busy" @click="save">应用 Token</button>
      <button :disabled="busy" class="ghost" @click="clear">清除</button>
    </div>
  </section>
</template>

<style scoped>
.auth-panel{display:grid;gap:9px;padding:12px;border:1px solid #ffffff14;border-radius:14px;background:#070a11}
.auth-panel strong{display:block;color:#e2e8f0;font-size:12px}
.auth-panel small{display:block;margin-top:4px;color:#64748b;font-size:10px;line-height:1.5}
.auth-panel input{width:100%;border:1px solid #ffffff1a;border-radius:10px;background:#0f1420;color:#f8fafc;padding:9px 10px;font-size:11px;outline:none}
.auth-panel input:focus{border-color:#8b5cf6}
.actions{display:grid;grid-template-columns:1fr auto;gap:7px}
.actions button{border:0;border-radius:9px;background:#7c3aed;color:white;padding:8px 10px;font-size:10px;font-weight:700;cursor:pointer}
.actions button.ghost{background:#ffffff0c;color:#cbd5e1}
.actions button:disabled{opacity:.45;cursor:not-allowed}
</style>
`),
  ]
}

export function openApiAuth(files: ArtifactFile[]): void {
  replaceFile(files, 'openapi.yaml', (content) => content
    .replace(
      'paths:\n',
      `security:
  - bearerAuth: []
paths:
  /api/auth/me:
    get:
      summary: Get the current authenticated identity
      responses:
        '200': { description: Authentication status }
        '401': { description: Missing or invalid bearer token }
        '503': { description: Authentication is enabled but no identities are configured }
`,
    )
    .replace(
      'components:\n  schemas:',
      `components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
  schemas:`,
    ))
}

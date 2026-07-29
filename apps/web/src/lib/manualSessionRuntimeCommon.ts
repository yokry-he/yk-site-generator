import {
  MANUAL_PERMISSION_ACTIONS,
  type ArtifactFile,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
} from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'

export function sessionBootstrapRole(
  access: ManualAccessDefinition,
  entities: readonly ManualEntityDefinition[],
): string {
  const full = access.roles.find((role) => entities.every((entity) => {
    const permission = role.permissions.find((item) => item.entity === entity.name)
    return MANUAL_PERMISSION_ACTIONS.every((action) => permission?.actions.includes(action))
  }))
  return full?.key ?? access.roles[0]?.key ?? 'admin'
}

export function sessionRuntimePolicyFile(access: ManualAccessDefinition): ArtifactFile {
  return text('siteforge.session.json', JSON.stringify({
    schemaVersion: 1,
    status: 'runtime-ready',
    runtime: 'wired',
    password: {
      algorithm: 'PBKDF2-HMAC-SHA256',
      iterations: 600_000,
      saltBytes: 16,
      derivedKeyBytes: 32,
      storageFormat: 'pbkdf2_sha256$iterations$saltHex$hashHex',
    },
    session: {
      tokenBytes: 32,
      tokenStorage: 'SHA-256 digest only',
      ttlSeconds: access.session!.ttlSeconds,
      maxActiveSessions: access.session!.maxActiveSessions,
      revocation: 'revoked_at timestamp',
      rotation: 'create replacement and revoke current session transactionally',
    },
    endpoints: {
      bootstrap: 'POST /api/auth/bootstrap',
      login: 'POST /api/auth/login',
      currentIdentity: 'GET /api/auth/me',
      logout: 'POST /api/auth/logout',
      rotate: 'POST /api/auth/rotate',
      revokeAll: 'POST /api/auth/revoke-all',
    },
    compatibility: {
      staticBearerFallback: 'AUTH_IDENTITIES_JSON',
      routeProtectionSwitch: 'AUTH_ENABLED',
    },
  }, null, 2))
}

export function sessionRuntimeGuideFile(access: ManualAccessDefinition): ArtifactFile {
  return text('SESSION_SECURITY.md', `# Persistent Session Runtime / 持久化 Session 运行时

[中文](#中文) · [English](#english)

---

## 中文

本工程已经接入持久化用户、密码验证和 Session 运行时。现有 \`AUTH_IDENTITIES_JSON\` 仍作为兼容的静态 Bearer Token 回退；数据库 Session Token 与静态 Token 都可以通过同一 \`Authorization: Bearer ...\` 头保护资源接口。

### 可用端点

\`\`\`text
POST /api/auth/bootstrap
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/rotate
POST /api/auth/revoke-all
\`\`\`

- \`bootstrap\` 只在数据库没有任何用户时创建首个完整权限管理员，凭据来自 \`AUTH_BOOTSTRAP_EMAIL\` 和 \`AUTH_BOOTSTRAP_PASSWORD\`。
- \`login\` 使用邮箱和密码创建 Session，返回一次性可见的原始 Token。
- \`logout\` 撤销当前数据库 Session；静态环境变量 Token 不会被数据库撤销。
- \`rotate\` 创建新 Session 并撤销旧 Session，只接受数据库 Session Token。
- \`revoke-all\` 撤销当前用户的全部数据库 Session。

### 密码与 Token

- 密码使用 PBKDF2-HMAC-SHA256、600,000 次迭代、16 字节随机盐和 32 字节派生密钥。
- 每个 Session Token 使用 32 字节密码学随机数。
- 数据库只保存 Token 的 SHA-256 摘要，原始 Token 只在登录或轮换响应中返回一次。
- 密码验证和摘要比较使用各语言的常量时间原语。

### Session 规则

- 有效期：${access.session!.ttlSeconds} 秒。
- 单用户最多 ${access.session!.maxActiveSessions} 个活动 Session；超限时撤销最旧的活动 Session。
- 已过期、已撤销或被禁用用户的 Session 不会通过认证。
- Session 请求会更新 \`last_used_at\`。

### 错误

- \`INVALID_CREDENTIALS\`：邮箱或密码无效，不区分用户是否存在。
- \`BOOTSTRAP_NOT_CONFIGURED\`：引导 Secret 缺失、仍为占位值或过短。
- \`BOOTSTRAP_ALREADY_COMPLETED\`：数据库已经存在用户。
- \`SESSION_REQUIRED\`：轮换或批量撤销使用了静态 Token。

### 当前边界

本阶段不包含公开注册、密码找回、邮箱验证、MFA、OAuth/OIDC、登录限流、IP 风险判断、设备管理页面或自动 Session 清理任务。部署前必须通过 Secret 管理注入引导密码，并在完成引导后移除该 Secret。

---

## English

The generated project now wires persistent users, password verification, and session runtime behavior. \`AUTH_IDENTITIES_JSON\` remains a compatible static bearer-token fallback. Database sessions and static tokens protect resource routes through the same \`Authorization: Bearer ...\` header.

### Available endpoints

\`\`\`text
POST /api/auth/bootstrap
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
POST /api/auth/rotate
POST /api/auth/revoke-all
\`\`\`

- \`bootstrap\` creates the first full-access administrator only when the user table is empty, using \`AUTH_BOOTSTRAP_EMAIL\` and \`AUTH_BOOTSTRAP_PASSWORD\`.
- \`login\` verifies email and password, creates a session, and returns the raw token once.
- \`logout\` revokes the current database session. Static environment tokens cannot be revoked through the database.
- \`rotate\` creates a replacement session and revokes the current one; it requires a database session token.
- \`revoke-all\` revokes every database session owned by the current user.

### Passwords and tokens

- Passwords use PBKDF2-HMAC-SHA256 with 600,000 iterations, a 16-byte random salt, and a 32-byte derived key.
- Session tokens contain 32 bytes of cryptographic randomness.
- The database stores only SHA-256 token digests. Raw tokens are returned only once during login or rotation.
- Password and digest checks use each language's constant-time comparison primitive.

### Session rules

- Lifetime: ${access.session!.ttlSeconds} seconds.
- At most ${access.session!.maxActiveSessions} active sessions per user; the oldest active sessions are revoked when the limit is exceeded.
- Expired, revoked, or disabled-user sessions do not authenticate.
- Authenticated session requests update \`last_used_at\`.

### Errors

- \`INVALID_CREDENTIALS\`: invalid email or password without revealing whether the account exists.
- \`BOOTSTRAP_NOT_CONFIGURED\`: bootstrap secrets are missing, still placeholders, or too short.
- \`BOOTSTRAP_ALREADY_COMPLETED\`: at least one user already exists.
- \`SESSION_REQUIRED\`: rotation or bulk revocation was attempted with a static token.

### Current boundary

This phase does not include public registration, password recovery, email verification, MFA, OAuth/OIDC, login rate limiting, IP-risk evaluation, a device-management screen, or an automatic session-cleanup job. Inject the bootstrap password through secret management and remove it after the first administrator is created.
`)
}

export function applySessionRuntimeFrontend(files: ArtifactFile[]): void {
  replaceFile(files, 'apps/web/src/auth.ts', () => `const TOKEN_KEY = 'siteforge-auth-token'

export interface AuthIdentity {
  userId: string
  email: string
  role: string
}

export interface SessionResponse {
  token: string
  expiresAt: string
  identity: AuthIdentity
}

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

async function jsonRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await authFetch(url, init)
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || 'HTTP ' + response.status)
  return body
}

export function bootstrapAdministrator(apiBase: string): Promise<{ created: boolean; identity: AuthIdentity }> {
  return jsonRequest(apiBase + '/api/auth/bootstrap', { method: 'POST' })
}

export async function loginWithPassword(apiBase: string, email: string, password: string): Promise<SessionResponse> {
  const session = await jsonRequest<SessionResponse>(apiBase + '/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  setAuthToken(session.token)
  return session
}

export async function rotateSession(apiBase: string): Promise<SessionResponse> {
  const session = await jsonRequest<SessionResponse>(apiBase + '/api/auth/rotate', { method: 'POST' })
  setAuthToken(session.token)
  return session
}

export async function logoutSession(apiBase: string): Promise<void> {
  const response = await authFetch(apiBase + '/api/auth/logout', { method: 'POST' })
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || 'HTTP ' + response.status)
  }
  clearAuthToken()
}

export async function revokeAllSessions(apiBase: string): Promise<void> {
  const response = await authFetch(apiBase + '/api/auth/revoke-all', { method: 'POST' })
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || 'HTTP ' + response.status)
  }
  clearAuthToken()
}
`)

  replaceFile(files, 'apps/web/src/AuthPanel.vue', () => `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  authFetch,
  bootstrapAdministrator,
  clearAuthToken,
  getAuthToken,
  loginWithPassword,
  logoutSession,
  revokeAllSessions,
  rotateSession,
  setAuthToken,
} from './auth'

const props = defineProps<{ apiBase: string }>()
const emit = defineEmits<{ changed: [] }>()
const token = ref(getAuthToken())
const email = ref('')
const password = ref('')
const status = ref('正在读取认证状态…')
const detail = ref('')
const busy = ref(false)

async function inspect() {
  busy.value = true
  try {
    const response = await authFetch(props.apiBase + '/api/auth/me')
    const body = await response.json().catch(() => ({})) as {
      enabled?: boolean
      source?: string | null
      expiresAt?: string | null
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
    detail.value = [body.identity?.role ? '角色：' + body.identity.role : '', body.source ? '来源：' + body.source : '', body.expiresAt ? '到期：' + body.expiresAt : ''].filter(Boolean).join(' · ')
  } catch (error) {
    status.value = '无法读取认证状态'
    detail.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    busy.value = false
  }
}

async function run(action: () => Promise<unknown>) {
  busy.value = true
  try {
    await action()
    token.value = getAuthToken()
    password.value = ''
    await inspect()
    emit('changed')
  } catch (error) {
    status.value = '认证操作失败'
    detail.value = error instanceof Error ? error.message : 'Unknown error'
  } finally {
    busy.value = false
  }
}

async function saveToken() {
  setAuthToken(token.value)
  await inspect()
  emit('changed')
}

async function clearToken() {
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
    <div class="credentials">
      <input v-model="email" type="email" autocomplete="username" placeholder="邮箱" aria-label="登录邮箱" />
      <input v-model="password" type="password" autocomplete="current-password" placeholder="密码" aria-label="登录密码" />
      <button :disabled="busy || !email.trim() || !password" @click="run(() => loginWithPassword(apiBase, email, password))">密码登录</button>
      <button :disabled="busy" class="ghost" @click="run(() => bootstrapAdministrator(apiBase))">初始化管理员</button>
    </div>
    <details>
      <summary>兼容 Bearer Token</summary>
      <input v-model="token" type="password" autocomplete="off" placeholder="Bearer Token" aria-label="Bearer Token" />
      <div class="actions"><button :disabled="busy" @click="saveToken">应用 Token</button><button :disabled="busy" class="ghost" @click="clearToken">清除</button></div>
    </details>
    <div class="session-actions">
      <button :disabled="busy || !token" class="ghost" @click="run(() => rotateSession(apiBase))">轮换</button>
      <button :disabled="busy || !token" class="ghost" @click="run(() => logoutSession(apiBase))">退出</button>
      <button :disabled="busy || !token" class="danger" @click="run(() => revokeAllSessions(apiBase))">撤销全部</button>
    </div>
  </section>
</template>

<style scoped>
.auth-panel{display:grid;gap:10px;padding:12px;border:1px solid #ffffff14;border-radius:14px;background:#070a11}.auth-panel strong{display:block;color:#e2e8f0;font-size:12px}.auth-panel small{display:block;margin-top:4px;color:#64748b;font-size:10px;line-height:1.5}.credentials{display:grid;gap:7px}.auth-panel input{width:100%;border:1px solid #ffffff1a;border-radius:10px;background:#0f1420;color:#f8fafc;padding:9px 10px;font-size:11px;outline:none}.auth-panel input:focus{border-color:#8b5cf6}.auth-panel button{border:0;border-radius:9px;background:#7c3aed;color:white;padding:8px 10px;font-size:10px;font-weight:700;cursor:pointer}.auth-panel button.ghost{background:#ffffff0c;color:#cbd5e1}.auth-panel button.danger{background:#ef44441a;color:#fca5a5}.auth-panel button:disabled{opacity:.45;cursor:not-allowed}.actions{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:7px}.session-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.auth-panel summary{cursor:pointer;color:#94a3b8;font-size:10px;margin-bottom:7px}
</style>
`)
}

export function applySessionRuntimeOpenApi(files: ArtifactFile[]): void {
  replaceFile(files, 'openapi.yaml', (content) => content
    .replace(
      'paths:\n  /api/auth/me:',
      `paths:
  /api/auth/bootstrap:
    post:
      security: []
      summary: Create the first administrator from server-side bootstrap secrets
      responses:
        '201': { description: Administrator created }
        '409': { description: Bootstrap already completed, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        '503': { description: Bootstrap secrets are not configured, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
  /api/auth/login:
    post:
      security: []
      summary: Create a persistent session with email and password
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LoginInput' }
      responses:
        '200': { description: Session created, content: { application/json: { schema: { $ref: '#/components/schemas/SessionResponse' } } } }
        '401': { description: Invalid credentials, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
  /api/auth/logout:
    post:
      summary: Revoke the current database session
      responses:
        '204': { description: Session revoked }
  /api/auth/rotate:
    post:
      summary: Rotate the current database session
      responses:
        '200': { description: Replacement session, content: { application/json: { schema: { $ref: '#/components/schemas/SessionResponse' } } } }
        '409': { description: A database session is required, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
  /api/auth/revoke-all:
    post:
      summary: Revoke every database session for the current user
      responses:
        '204': { description: Sessions revoked }
        '409': { description: A database session is required, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
  /api/auth/me:`,
    )
    .replace(
      '  schemas:\n    ErrorResponse:',
      `  schemas:
    LoginInput:
      type: object
      required: [email, password]
      properties:
        email: { type: string, format: email }
        password: { type: string, minLength: 12 }
    AuthIdentity:
      type: object
      required: [userId, email, role]
      properties:
        userId: { type: string }
        email: { type: string, format: email }
        role: { type: string }
    SessionResponse:
      type: object
      required: [token, expiresAt, identity]
      properties:
        token: { type: string }
        expiresAt: { type: string, format: date-time }
        identity: { $ref: '#/components/schemas/AuthIdentity' }
    ErrorResponse:`,
    )
    .replace(
      'enum: [VALIDATION_ERROR, NOT_FOUND, CONSTRAINT_CONFLICT, UNAUTHORIZED, FORBIDDEN, AUTH_NOT_CONFIGURED, HTTP_ERROR, INTERNAL_ERROR]',
      'enum: [VALIDATION_ERROR, NOT_FOUND, CONSTRAINT_CONFLICT, UNAUTHORIZED, FORBIDDEN, AUTH_NOT_CONFIGURED, INVALID_CREDENTIALS, BOOTSTRAP_NOT_CONFIGURED, BOOTSTRAP_ALREADY_COMPLETED, SESSION_REQUIRED, HTTP_ERROR, INTERNAL_ERROR]',
    ))
}

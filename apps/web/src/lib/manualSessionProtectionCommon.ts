import type { ArtifactFile } from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'

export const LOGIN_WINDOW_SECONDS = 900
export const MAX_LOGIN_ATTEMPTS = 5
export const LOGIN_LOCKOUT_SECONDS = 900
export const AUDIT_RETENTION_DAYS = 30
export const SESSION_RETENTION_DAYS = 7

export function appendEnvironment(files: ArtifactFile[]) {
  replaceFile(files, '.env.example', (content) => content.includes('AUTH_AUDIT_HASH_KEY=') ? content : `${content.trimEnd()}

# Login protection, privacy-preserving security audit, and cleanup.
AUTH_AUDIT_HASH_KEY=replace-with-at-least-32-random-characters
AUTH_LOGIN_WINDOW_SECONDS=${LOGIN_WINDOW_SECONDS}
AUTH_MAX_LOGIN_ATTEMPTS=${MAX_LOGIN_ATTEMPTTS}
AUTH_LOGIN_LOCKOUT_SECONDS=${LOGIN_LOCKOUT_SECONDS}
AUTH_AUDIT_RETENTION_DAYS=${AUDIT_RETENTION_DAYS}
AUTH_SESSION_RETENTION_DAYS=${SESSION_RETENTION_DAYS}
AUTH_TRUST_PROXY=false
`)
}

export function updatePolicy(files: ArtifactFile[]) {
  replaceFile(files, 'siteforge.session.json', (content) => {
    const policy = JSON.parse(content) as Record<string, unknown>
    policy.protection = {
      rateLimit: {
        scope: 'process-local principal and trusted-network hashes',
        windowSeconds: LOGIN_WINDOW_SECONDS,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        lockoutSeconds: LOGIN_LOCKOUT_SECONDS,
      },
      audit: {
        storage: 'auth_login_events',
        principal: 'HMAC-SHA256 normalized email',
        network: 'HMAC-SHA256 trusted client address when AUTH_TRUST_PROXY=true',
        retentionDays: AUDIT_RETENTION_DAYS,
        prohibitedFields: ['raw email', 'raw IP address', 'password', 'token'],
      },
      cleanup: {
        opportunistic: 'after successful password login',
        endpoint: 'POST /api/auth/maintenance/cleanup',
        sessionRetentionDays: SESSION_RETENTION_DAYS,
      },
    }
    return JSON.stringify(policy, null, 2) + '\n'
  })
}

export function updateOpenApi(files: ArtifactFile[]) {
  replaceFile(files, 'openapi.yaml', (content) => content
    .replace(
      '  /api/auth/revoke-all:\n',
      `  /api/auth/maintenance/cleanup:
    post:
      summary: Delete retained authentication audit events and expired or revoked sessions
      responses:
        '200': { description: Cleanup completed }
        '403': { description: Full-access administrator role required, content: { application/json: { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
  /api/auth/revoke-all:
~

   )
    .replace(
      'enum: [VALIDATION_ERROR, NOT_FOUND, CONSTRAINT_CONFLICT, UNAUTHORIZED, FORBIDDEN, AUTH_NOT_CONFIGURED, INVALID_CREDENTIALS,',
      'enum: [VALIDATION_ERROR, NOT_FOUND, CONSTRAINT_CONFLICT, UNAUTHORIZED, FORBIDDEN, AUTH_NOT_CONFIGURED, INVALID_CREDENTIALS, LOGIN_RATE_LIMITED,',
    ))
}

export function guideFile(): ArtifactFile {
  return text('AUTH_PROTECTION.md', `# Login Protection and Security Audit / 登录保护与安全审计

[中文](#中文) · [English](#english)

---

## 中文

生成工程为密码登录增加进程内限流、隐私保护的持久化审计和数据清理：

- 默认在 ${LOGIN_WINDOW_SECONDS} 秒窗口内允许 ${MAX_LOGIN_ATTEMPTS} 次失败；超过后锁定 ${LOGIN_LOCKOUT_SECONDS} 秒。
- 限流键使用 \`AUTH_AUDIT_HASH_KEY\` 进行 HMAC-SHA256，不保存原始邮箱。
- 只有 \`AUTH_TRUST_PROXY=true\` 时才读取 \`X-Forwarded-For\` 的第一个地址并加入网络维度；仅应在可信反向代理会覆盖该 Header 时启用。
- \`auth_login_events\` 只保存主体摘要、可选网络摘要、结果代码和时间，不保存邮箱、IP、密码或 Token。
- 成功登录会执行节流式清理；完整权限管理员也可调用 \`POST /api/auth/maintenance/cleanup\`。
- 审计默认保留 ${AUDIT_RETENTION_DAYS} 天；已过期或已撤销 Session 默认在 ${SESSION_RETENTION_DAYS} 天后清理。

当前限流状态保存在单个 API 进程内，多实例部署需要后续接入共享 Redis 或数据库锁定状态。数据库审计在所有实例之间持久化，但本阶段不会把审计表作为同步限流锁。

---

## English

Generated projects add process-local password-login throttling, privacy-preserving persistent audit events, and retained-data cleanup:

- By default, ${MAX_LOGIN_ATTEMPTS} failures are allowed in a ${LOGIN_WINDOW_SECONDS}-second window, followed by a ${LOGIN_LOCKOUT_SECONDS}-second lockout.
- Rate-limit keys use HMAC-SHA256 with \`AUTH_AUDIT_HASH_KEY\`; raw email addresses are not stored.
- The first \`X-Forwarded-For\` address participates only when \`AUTH_TRUST_PROXY=true\`. Enable it only behind a trusted reverse proxy that overwrites the header.
- \`auth_login_events\` stores principal digests, optional network digests, outcome codes, and timestamps—not email addresses, IP addresses, passwords, or tokens.
- Successful login performs throttled cleanup. A full-access administrator can also call \`POST /api/auth/maintenance/cleanup\`.
- Audit events are retained for ${AUDIT_RETENTION_DAYS} days by default. Expired or revoked sessions are removed after ${SESSION_RETENTION_DAYS} days.

Rate-limit state is local to one API process. Multi-instance deployments require a later shared Redis or database-backed lockout state. Database audit events persist across instances but are not used as a synchronous distributed lock in this phase.
`)
}


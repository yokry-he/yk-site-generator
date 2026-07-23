import { randomUUID } from 'node:crypto'
import type { Context, MiddlewareHandler } from 'hono'
import { env } from '../env'
import {
  mutateData,
  type AuditLogRecord,
  type SystemEventRecord,
  type UserRole,
} from './data-store'

const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{8,80}$/

export function requestIdFromContext(c: Context): string {
  const supplied = c.req.header('x-request-id')
  if (supplied && REQUEST_ID_RE.test(supplied)) return supplied
  const responseId = c.res.headers.get('x-request-id')
  return responseId && REQUEST_ID_RE.test(responseId) ? responseId : randomUUID()
}

export function requestMetadata(c: Context): {
  requestId: string
  ipAddress: string
  userAgent: string
} {
  return {
    requestId: requestIdFromContext(c),
    ipAddress: c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    userAgent: (c.req.header('user-agent') || 'unknown').slice(0, 500),
  }
}

export async function recordAudit(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
  const row: AuditLogRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  }
  await mutateData((data) => {
    data.auditLogs.push(row)
    if (data.auditLogs.length > 20_000) data.auditLogs.splice(0, data.auditLogs.length - 20_000)
  })
}

export async function recordSystemEvent(
  input: Omit<SystemEventRecord, 'id' | 'createdAt'>,
): Promise<void> {
  const row: SystemEventRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
  }
  await mutateData((data) => {
    data.systemEvents.push(row)
    if (data.systemEvents.length > env.SYSTEM_EVENT_LIMIT) {
      data.systemEvents.splice(0, data.systemEvents.length - env.SYSTEM_EVENT_LIMIT)
    }
  })
}

export function actorRole(role?: UserRole): UserRole {
  return role ?? 'user'
}

/**
 * 为每个请求生成稳定 request id，并仅记录慢请求与服务端错误。
 * 正常请求不落盘，避免单实例适配器产生不必要写放大。
 */
export const requestTelemetryMiddleware: MiddlewareHandler = async (c, next) => {
  const supplied = c.req.header('x-request-id')
  const requestId = supplied && REQUEST_ID_RE.test(supplied) ? supplied : randomUUID()
  c.header('X-Request-ID', requestId)
  const started = Date.now()
  try {
    await next()
  } catch (err) {
    await recordSystemEvent({
      level: 'error',
      source: 'http',
      eventType: 'request.exception',
      message: err instanceof Error ? err.message.slice(0, 500) : 'Unhandled request exception',
      requestId,
      durationMs: Date.now() - started,
      metadata: { method: c.req.method, path: c.req.path },
    })
    throw err
  }

  const durationMs = Date.now() - started
  if (c.res.status >= 500 || durationMs >= 1_500) {
    await recordSystemEvent({
      level: c.res.status >= 500 ? 'error' : 'warning',
      source: 'http',
      eventType: c.res.status >= 500 ? 'request.server_error' : 'request.slow',
      message: `${c.req.method} ${c.req.path} → ${c.res.status}`,
      requestId,
      durationMs,
      metadata: { method: c.req.method, path: c.req.path, status: c.res.status },
    })
  }
}

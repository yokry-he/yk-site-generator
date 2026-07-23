import { authFetch } from '../composables/useAuth'
import { ensureOk } from './api'

export interface QualitySummary {
  total: number
  positive: number
  negative: number
  negativeRate: number
  open: number
  topCategories: Array<{ category: string; count: number }>
}

export interface AdminOverview {
  users: { total: number; active: number; suspended: number; admins: number }
  projects: { total: number; versions: number; fromTemplates: number }
  publications: { total: number; published: number; offline: number }
  assets: { brandKits: number; officialTemplates: number }
  usage: { last30Days: number; byAction: Record<string, number>; daily: Array<{ date: string; value: number }> }
  quality: QualitySummary
  operations: { audit24h: number; errors24h: number; slow24h: number }
  recentEvents: SystemEvent[]
  recentAudit: AuditLog[]
  recentFeedback: AdminFeedback[]
}

export interface AdminUser {
  id: string
  email: string
  role: 'user' | 'admin' | 'support'
  status: 'active' | 'suspended' | 'deleted'
  createdAt: string
  updatedAt: string
  projectCount: number
  publicationCount: number
  usageUnits: number
  activeSessions: number
  lastActiveAt?: string
}

export interface AuditLog {
  id: string
  actorUserId?: string
  actorRole?: 'user' | 'admin' | 'support'
  action: string
  resourceType: string
  resourceId?: string
  requestId?: string
  ipAddress?: string
  userAgent?: string
  outcome: 'success' | 'failure'
  beforeData?: Record<string, unknown>
  afterData?: Record<string, unknown>
  errorCode?: string
  createdAt: string
}

export interface SystemEvent {
  id: string
  level: 'info' | 'warning' | 'error'
  source: string
  eventType: string
  message: string
  requestId?: string
  durationMs?: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface AdminFeedback {
  id: string
  userId: string
  projectId: string
  versionId: string
  sentiment: 'positive' | 'negative'
  categories: string[]
  message?: string
  siteType: string
  model?: string
  promptVersion?: string
  metadata?: Record<string, unknown>
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed'
  createdAt: string
  updatedAt: string
}

export interface HealthComponent {
  id: string
  name: string
  status: 'operational' | 'not_configured' | 'fallback' | 'degraded'
  detail: string
}

function queryString(input: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await ensureOk(await authFetch('/api/admin/overview'))
  return ((await response.json()) as { overview: AdminOverview }).overview
}

export async function listAdminUsers(input: {
  q?: string
  status?: string
  role?: string
  page?: number
  limit?: number
} = {}): Promise<{ users: AdminUser[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const response = await ensureOk(await authFetch(`/api/admin/users?${queryString(input)}`))
  return response.json() as Promise<{ users: AdminUser[]; pagination: { page: number; limit: number; total: number; pages: number } }>
}

export async function updateAdminUser(
  id: string,
  input: Partial<Pick<AdminUser, 'role' | 'status'>>,
): Promise<AdminUser> {
  const response = await ensureOk(
    await authFetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { user: AdminUser }).user
}

export async function listAdminFeedback(input: {
  limit?: number
  status?: string
  sentiment?: string
  siteType?: string
  model?: string
} = {}): Promise<{ feedback: AdminFeedback[]; summary: QualitySummary }> {
  const response = await ensureOk(await authFetch(`/api/admin/feedback?${queryString(input)}`))
  return response.json() as Promise<{ feedback: AdminFeedback[]; summary: QualitySummary }>
}

export async function updateAdminFeedbackStatus(
  id: string,
  status: AdminFeedback['status'],
): Promise<void> {
  await ensureOk(
    await authFetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    }),
  )
}

export async function listAuditLogs(input: {
  limit?: number
  action?: string
  resourceType?: string
  outcome?: string
} = {}): Promise<AuditLog[]> {
  const response = await ensureOk(await authFetch(`/api/admin/audit?${queryString(input)}`))
  return ((await response.json()) as { auditLogs: AuditLog[] }).auditLogs
}

export async function listSystemEvents(input: {
  limit?: number
  level?: string
  source?: string
} = {}): Promise<SystemEvent[]> {
  const response = await ensureOk(await authFetch(`/api/admin/events?${queryString(input)}`))
  return ((await response.json()) as { systemEvents: SystemEvent[] }).systemEvents
}

export async function getAdminHealth(): Promise<{ status: string; checkedAt: string; components: HealthComponent[] }> {
  const response = await ensureOk(await authFetch('/api/admin/health'))
  return ((await response.json()) as { health: { status: string; checkedAt: string; components: HealthComponent[] } }).health
}

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrandKit } from 'shared'
import { env } from '../env'

export type UserRole = 'user' | 'admin' | 'support'
export type UserStatus = 'active' | 'suspended' | 'deleted'

export interface UserRecord {
  id: string
  email: string
  /** 旧数据缺省为 user。 */
  role?: UserRole
  /** 旧数据缺省为 active。 */
  status?: UserStatus
  createdAt: string
  updatedAt: string
}

export interface VerificationCodeRecord {
  id: string
  email: string
  codeHash: string
  createdAt: string
  expiresAt: string
  attempts: number
}

export interface SessionRecord {
  id: string
  userId: string
  refreshTokenHash: string
  createdAt: string
  expiresAt: string
  lastUsedAt: string
  revokedAt?: string
}

export interface ProjectRecord {
  id: string
  userId: string
  title: string
  siteType: string
  requirement: string
  /** 官方模板来源；手动生成项目为空。 */
  templateId?: string
  createdAt: string
  updatedAt: string
}

export type ProjectVersionSource = 'generate' | 'iterate' | 'editor' | 'import'

export interface ProjectVersionRecord {
  id: string
  projectId: string
  userId: string
  version: number
  html: string
  source: ProjectVersionSource
  instruction?: string
  model?: string
  createdAt: string
}

export interface UsageRecord {
  id: string
  userId: string
  action: 'generate' | 'iterate' | 'publish'
  units: number
  siteType?: string
  model?: string
  createdAt: string
}

export interface PublicationRecord {
  id: string
  userId: string
  projectId?: string
  versionId?: string
  slug: string
  title: string
  html: string
  status: 'published' | 'offline'
  createdAt: string
  updatedAt: string
  publishedAt: string
}

export interface BrandKitRecord extends BrandKit {
  userId: string
}

export interface AuditLogRecord {
  id: string
  actorUserId?: string
  actorRole?: UserRole
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

export interface SystemEventRecord {
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

export interface AppData {
  schemaVersion: 3
  users: UserRecord[]
  verificationCodes: VerificationCodeRecord[]
  sessions: SessionRecord[]
  projects: ProjectRecord[]
  projectVersions: ProjectVersionRecord[]
  usage: UsageRecord[]
  publications: PublicationRecord[]
  brandKits: BrandKitRecord[]
  auditLogs: AuditLogRecord[]
  systemEvents: SystemEventRecord[]
}

const emptyData = (): AppData => ({
  schemaVersion: 3,
  users: [],
  verificationCodes: [],
  sessions: [],
  projects: [],
  projectVersions: [],
  usage: [],
  publications: [],
  brandKits: [],
  auditLogs: [],
  systemEvents: [],
})

let memoryData: AppData = emptyData()
let queue: Promise<unknown> = Promise.resolve()

function cloneData(data: AppData): AppData {
  return structuredClone(data)
}

function normalizeUsers(users: UserRecord[]): UserRecord[] {
  return users.map((user) => ({
    ...user,
    role: user.role ?? 'user',
    status: user.status ?? 'active',
  }))
}

async function readFromDisk(): Promise<AppData> {
  try {
    const raw = await readFile(env.DATA_STORAGE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as {
      schemaVersion?: number
      users?: UserRecord[]
      verificationCodes?: VerificationCodeRecord[]
      sessions?: SessionRecord[]
      projects?: ProjectRecord[]
      projectVersions?: ProjectVersionRecord[]
      usage?: UsageRecord[]
      publications?: PublicationRecord[]
      brandKits?: BrandKitRecord[]
      auditLogs?: AuditLogRecord[]
      systemEvents?: SystemEventRecord[]
    }
    if (![1, 2, 3].includes(parsed.schemaVersion ?? 0)) throw new Error('UNSUPPORTED_DATA_SCHEMA')
    return {
      schemaVersion: 3,
      users: normalizeUsers(parsed.users ?? []),
      verificationCodes: parsed.verificationCodes ?? [],
      sessions: parsed.sessions ?? [],
      projects: parsed.projects ?? [],
      projectVersions: parsed.projectVersions ?? [],
      usage: parsed.usage ?? [],
      publications: parsed.publications ?? [],
      brandKits: parsed.brandKits ?? [],
      auditLogs: parsed.auditLogs ?? [],
      systemEvents: parsed.systemEvents ?? [],
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyData()
    throw err
  }
}

async function persistToDisk(data: AppData): Promise<void> {
  const target = path.resolve(env.DATA_STORAGE_FILE)
  await mkdir(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, target)
}

export async function readData(): Promise<AppData> {
  if (env.NODE_ENV === 'test') return cloneData(memoryData)
  return readFromDisk()
}

/**
 * 对整个数据快照执行串行原子修改。回调内不得发起长耗时网络请求。
 * 返回值与落盘在同一临界区完成,避免项目版本号和额度计数竞争。
 */
export function mutateData<T>(mutator: (draft: AppData) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const current = env.NODE_ENV === 'test' ? cloneData(memoryData) : await readFromDisk()
    const result = await mutator(current)
    if (env.NODE_ENV === 'test') memoryData = current
    else await persistToDisk(current)
    return result
  })
  queue = task.catch(() => undefined)
  return task
}

export function resetDataStoreForTest(seed?: Partial<AppData>): void {
  memoryData = {
    ...emptyData(),
    ...seed,
    users: normalizeUsers(seed?.users ?? []),
    schemaVersion: 3,
  }
  queue = Promise.resolve()
}

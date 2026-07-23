import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrandKit } from 'shared'
import { env } from '../env'
import { getMysqlSnapshotStore } from './mysql-store'

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

export type FeedbackSentiment = 'positive' | 'negative'
export type FeedbackStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed'

export interface FeedbackRecord {
  id: string
  userId: string
  projectId: string
  versionId: string
  sentiment: FeedbackSentiment
  categories: string[]
  message?: string
  siteType: string
  model?: string
  promptVersion?: string
  metadata?: Record<string, unknown>
  status: FeedbackStatus
  createdAt: string
  updatedAt: string
}

export interface OnboardingContext {
  goal?: 'personal' | 'business' | 'content' | 'data'
  siteType?: string
  starter?: 'template' | 'ai'
  brandIntent?: 'create' | 'later'
}

export interface OnboardingProgressRecord {
  userId: string
  currentStep: 'welcome' | 'goal' | 'starter' | 'brand' | 'ready'
  completedSteps: string[]
  context: OnboardingContext
  completedAt?: string
  dismissedAt?: string
  updatedAt: string
}

export interface AppData {
  schemaVersion: 4
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
  feedback: FeedbackRecord[]
  onboardingProgress: OnboardingProgressRecord[]
}

export interface DataStoreHealth {
  driver: 'memory' | 'file' | 'mysql'
  status: 'operational' | 'degraded'
  message: string
  latencyMs?: number
  revision?: number
  schemaVersion: number
  updatedAt?: string
}

export const createEmptyData = (): AppData => ({
  schemaVersion: 4,
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
  feedback: [],
  onboardingProgress: [],
})

let memoryData: AppData = createEmptyData()
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

export function normalizeAppData(input: unknown): AppData {
  const parsed = (input && typeof input === 'object' ? input : {}) as Partial<AppData> & { schemaVersion?: number }
  if (parsed.schemaVersion !== undefined && ![1, 2, 3, 4].includes(parsed.schemaVersion)) {
    throw new Error('UNSUPPORTED_DATA_SCHEMA')
  }
  return {
    schemaVersion: 4,
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
    feedback: parsed.feedback ?? [],
    onboardingProgress: parsed.onboardingProgress ?? [],
  }
}

export async function readDataFile(filePath = env.DATA_STORAGE_FILE): Promise<AppData> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return normalizeAppData(JSON.parse(raw))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return createEmptyData()
    throw err
  }
}

export async function writeDataFile(data: AppData, filePath = env.DATA_STORAGE_FILE): Promise<void> {
  const target = path.resolve(filePath)
  await mkdir(path.dirname(target), { recursive: true })
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, JSON.stringify(normalizeAppData(data)), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, target)
}

function normalizeDraftInPlace(draft: AppData): AppData {
  const normalized = normalizeAppData(draft)
  for (const key of Object.keys(draft) as Array<keyof AppData>) delete draft[key]
  Object.assign(draft, normalized)
  return draft
}

export async function initializeDataStore(): Promise<void> {
  if (env.NODE_ENV === 'test') return
  if (env.DATA_STORAGE_DRIVER === 'mysql') {
    await getMysqlSnapshotStore().initialize()
    return
  }
  // 文件驱动在首次写入时创建目录；这里先验证已有文件能被读取。
  await readDataFile()
}

export async function closeDataStore(): Promise<void> {
  if (env.NODE_ENV !== 'test' && env.DATA_STORAGE_DRIVER === 'mysql') {
    await getMysqlSnapshotStore().close()
  }
}

export async function readData(): Promise<AppData> {
  if (env.NODE_ENV === 'test') return cloneData(memoryData)
  if (env.DATA_STORAGE_DRIVER === 'mysql') {
    const snapshot = await getMysqlSnapshotStore().read()
    return normalizeAppData(snapshot?.data ?? createEmptyData())
  }
  return readDataFile()
}

/**
 * 对整个数据快照执行原子修改。
 * - file:进程内队列 + 临时文件原子替换
 * - mysql:事务 + SELECT ... FOR UPDATE,跨实例串行化
 * 回调内不得发起长耗时网络请求。
 */
export function mutateData<T>(mutator: (draft: AppData) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    if (env.NODE_ENV === 'test') {
      const current = cloneData(memoryData)
      const result = await mutator(current)
      memoryData = current
      return result
    }

    if (env.DATA_STORAGE_DRIVER === 'mysql') {
      return getMysqlSnapshotStore().mutate(createEmptyData(), async (draft) => {
        normalizeDraftInPlace(draft)
        return mutator(draft)
      })
    }

    const current = await readDataFile()
    const result = await mutator(current)
    await writeDataFile(current)
    return result
  })
  queue = task.catch(() => undefined)
  return task
}

export async function getDataStoreHealth(): Promise<DataStoreHealth> {
  if (env.NODE_ENV === 'test') {
    return { driver: 'memory', status: 'operational', message: '内存测试适配器', schemaVersion: 4 }
  }
  const startedAt = Date.now()
  if (env.DATA_STORAGE_DRIVER === 'mysql') {
    const health = await getMysqlSnapshotStore().health()
    return {
      driver: 'mysql',
      status: health.status === 'operational' ? 'operational' : 'degraded',
      message: health.message,
      latencyMs: health.latencyMs,
      revision: health.revision,
      schemaVersion: health.schemaVersion ?? 4,
      updatedAt: health.updatedAt,
    }
  }
  try {
    const data = await readDataFile()
    return {
      driver: 'file',
      status: 'operational',
      message: `原子 JSON 文件 · ${data.projects.length} 个项目`,
      latencyMs: Date.now() - startedAt,
      schemaVersion: data.schemaVersion,
    }
  } catch (error) {
    return {
      driver: 'file',
      status: 'degraded',
      message: error instanceof Error ? error.message : '文件数据存储不可用',
      latencyMs: Date.now() - startedAt,
      schemaVersion: 4,
    }
  }
}

export function resetDataStoreForTest(seed?: Partial<AppData>): void {
  memoryData = normalizeAppData({ ...createEmptyData(), ...seed, schemaVersion: 4 })
  queue = Promise.resolve()
}

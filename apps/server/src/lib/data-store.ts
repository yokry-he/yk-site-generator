import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { BrandKit } from 'shared'
import { env } from '../env'

export interface UserRecord {
  id: string
  email: string
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

export interface AppData {
  schemaVersion: 2
  users: UserRecord[]
  verificationCodes: VerificationCodeRecord[]
  sessions: SessionRecord[]
  projects: ProjectRecord[]
  projectVersions: ProjectVersionRecord[]
  usage: UsageRecord[]
  publications: PublicationRecord[]
  brandKits: BrandKitRecord[]
}

type StoredAppData = Omit<Partial<AppData>, 'schemaVersion'> & { schemaVersion?: 1 | 2 }

const emptyData = (): AppData => ({
  schemaVersion: 2,
  users: [],
  verificationCodes: [],
  sessions: [],
  projects: [],
  projectVersions: [],
  usage: [],
  publications: [],
  brandKits: [],
})

let memoryData: AppData = emptyData()
let queue: Promise<unknown> = Promise.resolve()

function cloneData(data: AppData): AppData {
  return structuredClone(data)
}

async function readFromDisk(): Promise<AppData> {
  try {
    const raw = await readFile(env.DATA_STORAGE_FILE, 'utf8')
    const parsed = JSON.parse(raw) as StoredAppData
    if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) throw new Error('UNSUPPORTED_DATA_SCHEMA')
    return {
      schemaVersion: 2,
      users: parsed.users ?? [],
      verificationCodes: parsed.verificationCodes ?? [],
      sessions: parsed.sessions ?? [],
      projects: parsed.projects ?? [],
      projectVersions: parsed.projectVersions ?? [],
      usage: parsed.usage ?? [],
      publications: parsed.publications ?? [],
      brandKits: parsed.brandKits ?? [],
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
  memoryData = { ...emptyData(), ...seed, schemaVersion: 2 }
  queue = Promise.resolve()
}

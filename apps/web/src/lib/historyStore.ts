/**
 * 生成历史 IndexedDB 持久化(SF-1-7),零依赖原生封装。
 * 对象仓库 sessions:keyPath=id,索引 updatedAt(列表按更新时间倒序)。
 */
import type { IterationRound, IterationSession } from './iterationSession'

/* ============ 存储结构 ============ */

export interface StoredSession {
  id: string
  /** 标题:默认取需求前 20 字,可重命名 */
  title: string
  siteType: string
  requirement: string
  provider?: string
  model?: string
  createdAt: string
  updatedAt: string
  /** 迭代轮次(与 iterationSession 的 IterationRound 对齐,含每轮 html) */
  rounds: IterationRound[]
  /** 迭代基底轮(索引,与 IterationSession.current 对齐) */
  currentRound: number
}

export interface SessionMeta {
  id: string
  title: string
  siteType: string
  model?: string
  updatedAt: string
  roundCount: number
  /** 全部轮次 HTML 总字节数(容量保护提示用) */
  htmlBytes: number
}

/** 单会话 HTML 总量阈值:超过则提示「该会话较大」 */
export const LARGE_SESSION_BYTES = 2 * 1024 * 1024

export function newSessionId(): string {
  return `ses_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function titleFromRequirement(requirement: string): string {
  const t = requirement.trim().replace(/\s+/g, ' ')
  return t.length > 20 ? `${t.slice(0, 20)}…` : t || '未命名会话'
}

export function sessionHtmlBytes(rounds: IterationRound[]): number {
  return rounds.reduce((sum, r) => sum + r.html.length, 0)
}

export function toMeta(s: StoredSession): SessionMeta {
  return {
    id: s.id,
    title: s.title,
    siteType: s.siteType,
    model: s.model,
    updatedAt: s.updatedAt,
    roundCount: s.rounds.length,
    htmlBytes: sessionHtmlBytes(s.rounds),
  }
}

/* ============ 与 IterationSession 互转(round-trip) ============ */

export function recordToSession(rec: StoredSession): IterationSession {
  const current = Math.min(Math.max(rec.currentRound, 0), Math.max(rec.rounds.length - 1, -1))
  return { rounds: rec.rounds, viewing: current, current }
}

export function sessionToRecord(
  base: Pick<StoredSession, 'id' | 'title' | 'siteType' | 'requirement' | 'createdAt'> &
    Partial<Pick<StoredSession, 'provider' | 'model'>>,
  session: IterationSession,
): StoredSession {
  return {
    ...base,
    updatedAt: new Date().toISOString(),
    rounds: session.rounds,
    currentRound: session.current,
  }
}

/* ============ IndexedDB 封装 ============ */

const DB_NAME = 'siteforge-history'
const DB_VERSION = 1
const STORE = 'sessions'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt')
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
    })
  }
  return dbPromise
}

/** 测试辅助:重置缓存的连接(fake-indexeddb 换实例时用) */
export function resetHistoryDbForTest(): void {
  dbPromise = null
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'))
      }),
  )
}

export async function upsertSession(s: StoredSession): Promise<void> {
  await tx('readwrite', (store) => store.put(s))
}

export async function getSession(id: string): Promise<StoredSession | undefined> {
  return (await tx('readonly', (store) => store.get(id))) as StoredSession | undefined
}

export async function listSessions(): Promise<StoredSession[]> {
  const all = (await tx('readonly', (store) => store.getAll())) as StoredSession[]
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function renameSession(id: string, title: string): Promise<void> {
  const s = await getSession(id)
  if (!s) return
  await upsertSession({ ...s, title: title.trim() || s.title })
}

export async function deleteSession(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id))
}

export async function clearSessions(): Promise<void> {
  await tx('readwrite', (store) => store.clear())
}

/* ============ 导出 / 导入(JSON,为 V1 云端迁移探路) ============ */

export function exportSessionJson(s: StoredSession): string {
  return JSON.stringify({ format: 'siteforge-session@1', session: s }, null, 2)
}

/** 解析导入的 JSON;非法结构抛错。导入时生成新 id 避免覆盖本地已有会话 */
export function parseSessionJson(text: string): StoredSession {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('不是合法的 JSON 文件')
  }
  const d = data as { format?: string; session?: Partial<StoredSession> }
  if (d.format !== 'siteforge-session@1' || !d.session) {
    throw new Error('不是 siteforge 会话导出文件(format 不匹配)')
  }
  const s = d.session
  if (
    typeof s.title !== 'string' ||
    typeof s.siteType !== 'string' ||
    typeof s.requirement !== 'string' ||
    !Array.isArray(s.rounds) ||
    s.rounds.some((r) => typeof r?.html !== 'string' || typeof r?.instruction !== 'string')
  ) {
    throw new Error('会话文件结构不完整(title/siteType/requirement/rounds 缺失或非法)')
  }
  const now = new Date().toISOString()
  return {
    id: newSessionId(),
    title: s.title,
    siteType: s.siteType,
    requirement: s.requirement,
    provider: typeof s.provider === 'string' ? s.provider : undefined,
    model: typeof s.model === 'string' ? s.model : undefined,
    createdAt: typeof s.createdAt === 'string' ? s.createdAt : now,
    updatedAt: now,
    rounds: s.rounds as IterationRound[],
    currentRound: typeof s.currentRound === 'number' ? s.currentRound : s.rounds.length - 1,
  }
}

/** 判断是否为容量超限错误 */
export function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

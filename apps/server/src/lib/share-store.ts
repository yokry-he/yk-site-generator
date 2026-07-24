import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'

export interface ShareRecord {
  id: string
  title: string
  siteType: string
  html: string
  createdAt: string
  expiresAt: string
  deleteTokenHash: string
}

export interface ShareSummary {
  id: string
  title: string
  siteType: string
  createdAt: string
  expiresAt: string
  sizeBytes: number
}

const memory = new Map<string, ShareRecord>()
const SAFE_ID = /^[a-zA-Z0-9_-]{12,64}$/

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function summary(record: ShareRecord): ShareSummary {
  return {
    id: record.id,
    title: record.title,
    siteType: record.siteType,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    sizeBytes: Buffer.byteLength(record.html, 'utf8'),
  }
}

function expired(record: ShareRecord, now = Date.now()): boolean {
  return Date.parse(record.expiresAt) <= now
}

function filePath(id: string): string {
  if (!SAFE_ID.test(id)) throw new Error('INVALID_SHARE_ID')
  return path.resolve(env.SHARE_STORAGE_DIR, `${id}.json`)
}

async function persist(record: ShareRecord): Promise<void> {
  if (env.NODE_ENV === 'test') return
  await mkdir(env.SHARE_STORAGE_DIR, { recursive: true })
  const target = filePath(record.id)
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, JSON.stringify(record), { encoding: 'utf8', mode: 0o600 })
  await rename(temp, target)
}

async function removePersisted(id: string): Promise<void> {
  if (env.NODE_ENV === 'test') return
  await rm(filePath(id), { force: true })
}

async function readPersisted(id: string): Promise<ShareRecord | null> {
  if (env.NODE_ENV === 'test') return null
  try {
    const raw = await readFile(filePath(id), 'utf8')
    const parsed = JSON.parse(raw) as ShareRecord
    if (!parsed || parsed.id !== id || typeof parsed.html !== 'string') return null
    return parsed
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return null
    throw err
  }
}

export async function createShare(input: {
  html: string
  title?: string
  siteType?: string
}): Promise<{ share: ShareSummary; deleteToken: string }> {
  const sizeBytes = Buffer.byteLength(input.html, 'utf8')
  if (sizeBytes > env.MAX_SHARE_BYTES) throw new Error('SHARE_TOO_LARGE')

  const id = randomBytes(12).toString('base64url')
  const deleteToken = randomBytes(24).toString('base64url')
  const createdAt = new Date()
  const expiresAt = new Date(createdAt.getTime() + env.SHARE_TTL_DAYS * 86_400_000)
  const record: ShareRecord = {
    id,
    title: input.title?.trim().slice(0, 120) || 'SiteForge 临时站点',
    siteType: input.siteType?.trim().slice(0, 40) || 'website',
    html: input.html,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deleteTokenHash: tokenHash(deleteToken),
  }
  memory.set(id, record)
  await persist(record)
  return { share: summary(record), deleteToken }
}

export async function getShare(id: string): Promise<ShareRecord | null> {
  if (!SAFE_ID.test(id)) return null
  let record = memory.get(id) ?? null
  if (!record) {
    record = await readPersisted(id)
    if (record) memory.set(id, record)
  }
  if (!record) return null
  if (expired(record)) {
    memory.delete(id)
    await removePersisted(id)
    return null
  }
  return record
}

export async function deleteShare(id: string, deleteToken: string): Promise<boolean> {
  const record = await getShare(id)
  if (!record || tokenHash(deleteToken) !== record.deleteTokenHash) return false
  memory.delete(id)
  await removePersisted(id)
  return true
}

export async function cleanupExpiredShares(now = Date.now()): Promise<number> {
  let removed = 0
  for (const [id, record] of memory) {
    if (!expired(record, now)) continue
    memory.delete(id)
    await removePersisted(id)
    removed += 1
  }

  if (env.NODE_ENV !== 'test') {
    await mkdir(env.SHARE_STORAGE_DIR, { recursive: true })
    for (const name of await readdir(env.SHARE_STORAGE_DIR)) {
      if (!name.endsWith('.json')) continue
      const id = name.slice(0, -5)
      if (!SAFE_ID.test(id) || memory.has(id)) continue
      const record = await readPersisted(id)
      if (record && expired(record, now)) {
        await removePersisted(id)
        removed += 1
      }
    }
  }
  return removed
}

export function shareSummary(record: ShareRecord): ShareSummary {
  return summary(record)
}

export function resetShareStoreForTest(): void {
  memory.clear()
}

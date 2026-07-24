import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'
import {
  deletePublishedObject,
  invalidatePublicationCache,
  putPublishedObject,
  s3PublicationUrl,
} from './s3-storage'

export function normalizeSlug(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

function slugDirectory(slug: string): string {
  const safe = normalizeSlug(slug)
  if (!safe || safe !== slug) throw new Error('INVALID_PUBLICATION_SLUG')
  return path.resolve(env.PUBLISH_STORAGE_DIR, safe)
}

async function writeLocal(slug: string, html: string): Promise<void> {
  const directory = slugDirectory(slug)
  await mkdir(directory, { recursive: true })
  const target = path.join(directory, 'index.html')
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, html, { encoding: 'utf8', mode: 0o644 })
  await rename(temp, target)
}

export async function writePublishedArtifact(slug: string, html: string): Promise<void> {
  if (env.NODE_ENV === 'test') return
  if (env.s3Enabled) await putPublishedObject(slug, html)
  else await writeLocal(slug, html)
  await invalidatePublicationCache(slug, 'publish')
}

export async function removePublishedArtifact(slug: string): Promise<void> {
  if (env.NODE_ENV === 'test') return
  if (env.s3Enabled) await deletePublishedObject(slug)
  else await rm(slugDirectory(slug), { recursive: true, force: true })
  await invalidatePublicationCache(slug, 'delete')
}

export function publicationUrl(slug: string): string {
  if (env.s3Enabled) return s3PublicationUrl(slug)
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, '')
  const routePath = `/site/${slug}`
  return base ? `${base}${routePath}` : routePath
}

export function publicationStorageKind(): 's3' | 'local' {
  return env.s3Enabled ? 's3' : 'local'
}

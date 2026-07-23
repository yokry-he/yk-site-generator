import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { env } from '../env'

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

export async function writePublishedArtifact(slug: string, html: string): Promise<void> {
  if (env.NODE_ENV === 'test') return
  const directory = slugDirectory(slug)
  await mkdir(directory, { recursive: true })
  const target = path.join(directory, 'index.html')
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, html, { encoding: 'utf8', mode: 0o644 })
  await rename(temp, target)
}

export async function removePublishedArtifact(slug: string): Promise<void> {
  if (env.NODE_ENV === 'test') return
  await rm(slugDirectory(slug), { recursive: true, force: true })
}

export function publicationUrl(slug: string): string {
  const base = env.PUBLIC_BASE_URL.replace(/\/$/, '')
  const path = `/site/${slug}`
  return base ? `${base}${path}` : path
}

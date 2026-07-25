import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  legacyHtmlSiteProject,
  sitePageOutputPath,
  type SitePage,
} from 'shared'
import { env } from '../env'
import {
  deletePublishedObjects,
  invalidatePublicationCache,
  putPublishedObjects,
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

function normalizedPages(input: string | readonly SitePage[]): SitePage[] {
  return typeof input === 'string' ? legacyHtmlSiteProject(input).pages : input.map((page) => ({ ...page }))
}

async function writeLocal(slug: string, pages: readonly SitePage[]): Promise<void> {
  const directory = slugDirectory(slug)
  const tempDirectory = `${directory}.${process.pid}.${Date.now()}.tmp`
  const backupDirectory = `${directory}.${process.pid}.${Date.now()}.bak`
  await rm(tempDirectory, { recursive: true, force: true })
  await mkdir(tempDirectory, { recursive: true })
  for (const page of pages) {
    const target = path.join(tempDirectory, sitePageOutputPath(page))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, page.html, { encoding: 'utf8', mode: 0o644 })
  }

  let movedCurrent = false
  try {
    await rename(directory, backupDirectory)
    movedCurrent = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  try {
    await rename(tempDirectory, directory)
    if (movedCurrent) await rm(backupDirectory, { recursive: true, force: true })
  } catch (error) {
    await rm(tempDirectory, { recursive: true, force: true })
    if (movedCurrent) await rename(backupDirectory, directory)
    throw error
  }
}

export async function writePublishedArtifact(slug: string, input: string | readonly SitePage[]): Promise<void> {
  if (env.NODE_ENV === 'test') return
  const pages = normalizedPages(input)
  if (env.s3Enabled) await putPublishedObjects(slug, pages)
  else await writeLocal(slug, pages)
  await invalidatePublicationCache(slug, 'publish', pages)
}

export async function removePublishedArtifact(slug: string, pages: readonly Pick<SitePage, 'path'>[] = [{ path: '/' }]): Promise<void> {
  if (env.NODE_ENV === 'test') return
  if (env.s3Enabled) await deletePublishedObjects(slug, pages)
  else await rm(slugDirectory(slug), { recursive: true, force: true })
  await invalidatePublicationCache(slug, 'delete', pages)
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

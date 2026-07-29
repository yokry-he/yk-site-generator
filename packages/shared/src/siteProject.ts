export const SITE_PROJECT_SCHEMA_VERSION = 1 as const
export const MAX_SITE_PAGES = 12
export const MAX_SITE_PAGE_TITLE_LENGTH = 80
export const MAX_SITE_PAGE_ID_LENGTH = 80

export interface SitePage {
  id: string
  title: string
  /** Canonical public path. Home is `/`; other paths are lowercase ASCII segments. */
  path: string
  html: string
}

export interface SitePageSummary extends Omit<SitePage, 'html'> {
  sizeBytes: number
}

export interface SiteProjectDocument {
  schemaVersion: typeof SITE_PROJECT_SCHEMA_VERSION
  homePageId: string
  pages: SitePage[]
}

export type SiteProjectInput = {
  html?: string
  pages?: readonly Partial<SitePage>[]
  homePageId?: string
}

const textEncoder = new TextEncoder()

export function utf8ByteLength(value: string): number {
  return textEncoder.encode(value).byteLength
}

function normalizedSegment(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)
}

/** Convert user input into a safe canonical site path. */
export function normalizeSitePath(value: string): string {
  const raw = value.trim().split(/[?#]/u, 1)[0] || '/'
  const segments = raw
    .split('/')
    .map(normalizedSegment)
    .filter(Boolean)
  return segments.length ? `/${segments.join('/')}` : '/'
}

export function isCanonicalSitePath(value: string): boolean {
  if (value === '/') return true
  return /^\/[a-z0-9](?:[a-z0-9-]{0,62})(?:\/[a-z0-9](?:[a-z0-9-]{0,62}))*$/u.test(value)
}

export function canonicalSiteRequestPath(value: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(value.split(/[?#]/u, 1)[0] || '/')
  } catch {
    return null
  }
  decoded = decoded.replace(/\/index\.html$/iu, '') || '/'
  decoded = decoded.replace(/\/{2,}/gu, '/').replace(/\/$/u, '') || '/'
  if (!decoded.startsWith('/')) decoded = `/${decoded}`
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) return null
  return isCanonicalSitePath(decoded) ? decoded : null
}

export function sitePageOutputPath(page: Pick<SitePage, 'path'>): string {
  return page.path === '/' ? 'index.html' : `${page.path.slice(1)}/index.html`
}

export function pageSlugFromTitle(title: string, fallback = 'page'): string {
  return normalizedSegment(title) || normalizedSegment(fallback) || 'page'
}

function uniqueValue(preferred: string, used: Set<string>, suffixSeparator = '-'): string {
  if (!used.has(preferred)) {
    used.add(preferred)
    return preferred
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${preferred}${suffixSeparator}${index}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
  const fallback = `${preferred}${suffixSeparator}${Date.now().toString(36)}`
  used.add(fallback)
  return fallback
}

function normalizedPageId(value: unknown, index: number, used: Set<string>): string {
  const preferred = typeof value === 'string'
    ? normalizedSegment(value).slice(0, MAX_SITE_PAGE_ID_LENGTH)
    : ''
  return uniqueValue(preferred || `page-${index + 1}`, used)
}

function normalizedPageTitle(value: unknown, index: number): string {
  if (typeof value !== 'string') return index === 0 ? '首页' : `页面 ${index + 1}`
  return value.trim().slice(0, MAX_SITE_PAGE_TITLE_LENGTH) || (index === 0 ? '首页' : `页面 ${index + 1}`)
}

function uniquePath(preferred: string, used: Set<string>, index: number): string {
  if (preferred === '/' && !used.has('/')) {
    used.add('/')
    return '/'
  }
  const base = preferred === '/' ? `/page-${index + 1}` : preferred
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
  const fallback = `${base}-${Date.now().toString(36)}`
  used.add(fallback)
  return fallback
}

export function legacyHtmlSiteProject(html: string, title = '首页'): SiteProjectDocument {
  return {
    schemaVersion: SITE_PROJECT_SCHEMA_VERSION,
    homePageId: 'home',
    pages: [{ id: 'home', title: title.trim().slice(0, MAX_SITE_PAGE_TITLE_LENGTH) || '首页', path: '/', html }],
  }
}

/** Normalize new and legacy project versions into a stable, backwards-compatible document. */
export function normalizeSiteProject(input: SiteProjectInput, fallbackTitle = '首页'): SiteProjectDocument {
  const sourcePages = Array.isArray(input.pages) && input.pages.length
    ? input.pages.slice(0, MAX_SITE_PAGES)
    : input.html
      ? [{ id: 'home', title: fallbackTitle, path: '/', html: input.html }]
      : []

  if (!sourcePages.length) return legacyHtmlSiteProject('', fallbackTitle)

  const usedIds = new Set<string>()
  const usedPaths = new Set<string>()
  const pages = sourcePages.map((page, index): SitePage => {
    const id = normalizedPageId(page.id, index, usedIds)
    const title = normalizedPageTitle(page.title, index)
    const requestedPath = typeof page.path === 'string' ? normalizeSitePath(page.path) : index === 0 ? '/' : `/${pageSlugFromTitle(title, `page-${index + 1}`)}`
    const path = uniquePath(requestedPath, usedPaths, index)
    return {
      id,
      title,
      path,
      html: typeof page.html === 'string' ? page.html : '',
    }
  })

  const requestedHome = typeof input.homePageId === 'string'
    ? pages.find((page) => page.id === input.homePageId)
    : undefined
  const home = requestedHome ?? pages.find((page) => page.path === '/') ?? pages[0]

  if (home.path !== '/') {
    usedPaths.delete(home.path)
    const previousHome = pages.find((page) => page.path === '/')
    if (previousHome && previousHome.id !== home.id) {
      previousHome.path = uniquePath(`/${pageSlugFromTitle(previousHome.title, 'page')}`, usedPaths, pages.indexOf(previousHome))
    }
    home.path = '/'
    usedPaths.add('/')
  }

  return {
    schemaVersion: SITE_PROJECT_SCHEMA_VERSION,
    homePageId: home.id,
    pages,
  }
}

export function siteProjectHomePage(document: SiteProjectDocument): SitePage {
  return document.pages.find((page) => page.id === document.homePageId) ?? document.pages[0]
}

export function siteProjectPageForPath(document: SiteProjectDocument, path: string): SitePage | undefined {
  const canonical = canonicalSiteRequestPath(path)
  return canonical ? document.pages.find((page) => page.path === canonical) : undefined
}

export function siteProjectByteLength(document: SiteProjectDocument): number {
  return utf8ByteLength(JSON.stringify(document))
}

export function sitePageSummaries(document: SiteProjectDocument): SitePageSummary[] {
  return document.pages.map(({ html, ...page }) => ({ ...page, sizeBytes: utf8ByteLength(html) }))
}

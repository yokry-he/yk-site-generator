export interface StarterProjectDraft {
  slug: string
  html: string
  updatedAt: string
}

const STORAGE_KEY = 'siteforge:starter-project-drafts-v1'
const MAX_DRAFTS = 8
const MAX_HTML_BYTES = 1_500_000

function browserStorage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage
}

function readDrafts(storage: Storage | null = browserStorage()): StarterProjectDraft[] {
  if (!storage) return []
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    return value.filter((item): item is StarterProjectDraft => {
      if (!item || typeof item !== 'object') return false
      const row = item as Partial<StarterProjectDraft>
      return typeof row.slug === 'string'
        && typeof row.html === 'string'
        && typeof row.updatedAt === 'string'
    })
  } catch {
    storage.removeItem(STORAGE_KEY)
    return []
  }
}

export function loadStarterProjectDraft(
  slug: string,
  storage: Storage | null = browserStorage(),
): StarterProjectDraft | null {
  return readDrafts(storage).find((draft) => draft.slug === slug) ?? null
}

export function saveStarterProjectDraft(
  slug: string,
  html: string,
  storage: Storage | null = browserStorage(),
): StarterProjectDraft {
  const byteLength = new TextEncoder().encode(html).byteLength
  if (byteLength > MAX_HTML_BYTES) {
    throw new Error('本地项目超过 1.5MB，无法继续自动保存；请先导出备份或精简页面。')
  }

  const draft: StarterProjectDraft = {
    slug,
    html,
    updatedAt: new Date().toISOString(),
  }
  if (!storage) return draft

  const rows = readDrafts(storage)
    .filter((item) => item.slug !== slug)
    .concat(draft)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_DRAFTS)
  storage.setItem(STORAGE_KEY, JSON.stringify(rows))
  return draft
}

export function removeStarterProjectDraft(
  slug: string,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) return
  storage.setItem(STORAGE_KEY, JSON.stringify(readDrafts(storage).filter((draft) => draft.slug !== slug)))
}

export function listStarterProjectDrafts(
  storage: Storage | null = browserStorage(),
): StarterProjectDraft[] {
  return readDrafts(storage).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

import type { SitePage, SitePageSummary } from 'shared'
import { authFetch } from '../composables/useAuth'
import { ensureOk } from './api'

export type ProjectLifecycleStatus = 'active' | 'archived' | 'trashed'

export interface ProjectVersionSummary {
  id: string
  projectId: string
  userId: string
  version: number
  source: 'generate' | 'iterate' | 'editor' | 'import'
  instruction?: string
  model?: string
  name?: string
  note?: string
  starred: boolean
  parentVersionId?: string
  changeSummary: string[]
  createdAt: string
  homePageId: string
  pages: SitePageSummary[]
  pageCount: number
  sizeBytes: number
}

export interface ProjectVersion extends Omit<ProjectVersionSummary, 'sizeBytes' | 'pages'> {
  html: string
  pages: SitePage[]
  sizeBytes: number
}

export interface CloudProject {
  id: string
  userId: string
  title: string
  siteType: string
  requirement: string
  templateId?: string
  status: ProjectLifecycleStatus
  starred: boolean
  openedAt?: string
  duplicatedFromId?: string
  brandKitId?: string
  coverDataUrl?: string
  createdAt: string
  updatedAt: string
  latestVersion: ProjectVersionSummary | null
}

export interface ProjectDetail {
  project: CloudProject
  versions: ProjectVersionSummary[]
}

export interface Publication {
  id: string
  userId: string
  projectId?: string
  versionId?: string
  slug: string
  title: string
  status: 'published' | 'offline'
  createdAt: string
  updatedAt: string
  publishedAt: string
  homePageId?: string
  pageCount: number
  sizeBytes: number
  url: string
  host: string
}

export interface QuotaSummary {
  period: string
  limit: number
  used: number
  remaining: number
  byAction: Record<string, number>
  resetsAt: string
}

function jsonHeaders(): HeadersInit {
  return { 'content-type': 'application/json' }
}

export async function listProjects(status: ProjectLifecycleStatus | 'all' = 'all'): Promise<CloudProject[]> {
  const response = await ensureOk(await authFetch(`/api/projects?status=${encodeURIComponent(status)}`))
  return ((await response.json()) as { projects: CloudProject[] }).projects
}

export async function getProject(id: string): Promise<ProjectDetail> {
  const response = await ensureOk(await authFetch(`/api/projects/${encodeURIComponent(id)}`))
  return response.json() as Promise<ProjectDetail>
}

export async function createProject(input: {
  title: string
  siteType: string
  requirement: string
  html?: string
  pages?: SitePage[]
  homePageId?: string
  source?: ProjectVersionSummary['source']
  instruction?: string
  model?: string
  brandKitId?: string
}): Promise<CloudProject> {
  const response = await ensureOk(
    await authFetch('/api/projects', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { project: CloudProject }).project
}

export async function updateProject(
  id: string,
  input: Partial<Pick<CloudProject, 'title' | 'siteType' | 'requirement' | 'status' | 'starred' | 'openedAt' | 'brandKitId' | 'coverDataUrl'>> & {
    brandKitId?: string | null
    coverDataUrl?: string | null
  },
): Promise<CloudProject> {
  const response = await ensureOk(
    await authFetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { project: CloudProject }).project
}

export async function duplicateProject(id: string): Promise<CloudProject> {
  const response = await ensureOk(
    await authFetch(`/api/projects/${encodeURIComponent(id)}/duplicate`, { method: 'POST' }),
  )
  return ((await response.json()) as { project: CloudProject }).project
}

export async function deleteProject(id: string): Promise<void> {
  await ensureOk(await authFetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }))
}

export async function addProjectVersion(
  id: string,
  input: {
    html?: string
    pages?: SitePage[]
    homePageId?: string
    source: ProjectVersionSummary['source']
    instruction?: string
    model?: string
    name?: string
    note?: string
    parentVersionId?: string
    changeSummary?: string[]
  },
): Promise<ProjectVersionSummary> {
  const response = await ensureOk(
    await authFetch(`/api/projects/${encodeURIComponent(id)}/versions`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { version: ProjectVersionSummary }).version
}

export async function updateProjectVersion(
  projectId: string,
  versionId: string,
  input: { name?: string | null; note?: string | null; starred?: boolean },
): Promise<ProjectVersionSummary> {
  const response = await ensureOk(
    await authFetch(`/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { version: ProjectVersionSummary }).version
}

export async function getProjectVersion(projectId: string, versionId: string): Promise<ProjectVersion> {
  const response = await ensureOk(
    await authFetch(
      `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    ),
  )
  return ((await response.json()) as { version: ProjectVersion }).version
}

export async function rollbackProject(projectId: string, versionId: string): Promise<ProjectVersionSummary> {
  const response = await ensureOk(
    await authFetch(`/api/projects/${encodeURIComponent(projectId)}/rollback`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ versionId }),
    }),
  )
  return ((await response.json()) as { version: ProjectVersionSummary }).version
}

export async function listPublications(): Promise<Publication[]> {
  const response = await ensureOk(await authFetch('/api/publications'))
  return ((await response.json()) as { publications: Publication[] }).publications
}

export async function createPublication(input: {
  title: string
  slug?: string
  projectId?: string
  versionId?: string
  html?: string
  pages?: SitePage[]
  homePageId?: string
}): Promise<Publication> {
  const response = await ensureOk(
    await authFetch('/api/publications', {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { publication: Publication }).publication
}

export async function updatePublication(
  id: string,
  input: { title?: string; status?: Publication['status'] },
): Promise<Publication> {
  const response = await ensureOk(
    await authFetch(`/api/publications/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { publication: Publication }).publication
}

export async function republish(
  id: string,
  input: { versionId?: string; html?: string; pages?: SitePage[]; homePageId?: string },
): Promise<Publication> {
  const response = await ensureOk(
    await authFetch(`/api/publications/${encodeURIComponent(id)}/republish`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { publication: Publication }).publication
}

export async function getQuota(): Promise<QuotaSummary> {
  const response = await ensureOk(await authFetch('/api/quota'))
  return ((await response.json()) as { quota: QuotaSummary }).quota
}

export async function getUsage(limit = 50): Promise<{ usage: Array<Record<string, unknown>>; quota: QuotaSummary }> {
  const response = await ensureOk(await authFetch(`/api/quota/usage?limit=${limit}`))
  return response.json() as Promise<{ usage: Array<Record<string, unknown>>; quota: QuotaSummary }>
}

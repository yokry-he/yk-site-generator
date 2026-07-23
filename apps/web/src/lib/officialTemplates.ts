import type { OfficialTemplateDefinition } from 'shared'
import { authFetch } from '../composables/useAuth'
import { ensureOk } from './api'
import type { CloudProject } from './workspace'

export interface OfficialTemplateFilters {
  categories: string[]
  industries: string[]
  styles: string[]
}

export interface OfficialTemplateCatalogResponse {
  templates: Array<OfficialTemplateDefinition & { variableCount: number }>
  filters: OfficialTemplateFilters
}

function anonymousId(): string {
  const key = 'siteforge:anonymous-id'
  const stored = localStorage.getItem(key)
  if (stored) return stored
  const value = crypto.randomUUID()
  localStorage.setItem(key, value)
  return value
}

export async function listOfficialTemplates(): Promise<OfficialTemplateCatalogResponse> {
  const response = await ensureOk(await authFetch('/api/templates', {
    headers: { 'x-anonymous-id': anonymousId() },
  }))
  return response.json() as Promise<OfficialTemplateCatalogResponse>
}

export async function useOfficialTemplate(
  templateId: string,
  input: {
    title?: string
    brandKitId?: string
    variables: Record<string, string>
  },
): Promise<CloudProject> {
  const response = await ensureOk(
    await authFetch(`/api/templates/${encodeURIComponent(templateId)}/use`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { project: CloudProject }).project
}

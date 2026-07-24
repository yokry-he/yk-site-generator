import type { OfficialTemplateDefinition } from 'shared'
import type { AppData, TemplateOperationRecord, TemplateOperationStatus } from './data-store'

export interface OperatedTemplate extends OfficialTemplateDefinition {
  status: TemplateOperationStatus
  sortOrder: number
  operationVersion: number
  operationUpdatedAt?: string
  operationUpdatedBy?: string
  useCount: number
  publicationCount: number
  negativeFeedbackCount: number
}

export function operationForTemplate(
  data: Pick<AppData, 'templateOperations'>,
  template: OfficialTemplateDefinition,
): TemplateOperationRecord | undefined {
  return data.templateOperations.find((item) => item.templateId === template.id)
}

export function operatedTemplate(data: AppData, template: OfficialTemplateDefinition): OperatedTemplate {
  const operation = operationForTemplate(data, template)
  const projectIds = data.projects
    .filter((item) => item.templateId === template.id)
    .map((item) => item.id)
  return {
    ...template,
    status: operation?.status ?? 'published',
    featured: operation?.featured ?? template.featured,
    sortOrder: operation?.sortOrder ?? 100,
    operationVersion: operation?.version ?? 0,
    operationUpdatedAt: operation?.updatedAt,
    operationUpdatedBy: operation?.updatedBy,
    useCount: projectIds.length,
    publicationCount: data.publications.filter((item) => item.projectId && projectIds.includes(item.projectId)).length,
    negativeFeedbackCount: data.feedback.filter(
      (item) => item.sentiment === 'negative' && projectIds.includes(item.projectId),
    ).length,
  }
}

export function operatedTemplates(data: AppData, templates: OfficialTemplateDefinition[]): OperatedTemplate[] {
  return templates
    .map((template) => operatedTemplate(data, template))
    .sort((a, b) => a.sortOrder - b.sortOrder || Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name))
}

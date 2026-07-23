import { OFFICIAL_TEMPLATES } from './officialTemplates'
import { ADDITIONAL_OFFICIAL_TEMPLATES } from './templateCatalog'

for (const template of ADDITIONAL_OFFICIAL_TEMPLATES) {
  if (!OFFICIAL_TEMPLATES.some((item) => item.id === template.id)) OFFICIAL_TEMPLATES.push(template)
}

export const REGISTERED_TEMPLATE_COUNT = OFFICIAL_TEMPLATES.length

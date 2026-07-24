import {
  getOfficialTemplate,
  officialTemplateDefaults,
  renderOfficialTemplate,
} from './officialTemplates'

export interface StarterProjectDefinition {
  id: string
  slug: string
  name: string
  description: string
  templateId: string
  audience: string
  useCase: string
  highlights: readonly string[]
  featured: boolean
}

/**
 * Ready-to-use projects that render to complete HTML without a model call,
 * authentication, or any configuration from the user.
 */
export const STARTER_PROJECTS: readonly StarterProjectDefinition[] = [
  {
    id: 'starter-aurora-launch',
    slug: 'aurora-product-launch',
    name: 'AI 产品发布站',
    description: '完整的 SaaS 产品主页，已经包含价值主张、能力说明、数据证明和行动入口。',
    templateId: 'tpl-aurora-saas',
    audience: 'AI、SaaS 与开发者工具团队',
    useCase: '产品上线、预约演示、早期用户转化',
    highlights: ['完整转化路径', '响应式产品界面', '无需模型即可使用'],
    featured: true,
  },
  {
    id: 'starter-northstar-company',
    slug: 'northstar-company-site',
    name: '企业服务官网',
    description: '适合咨询、制造和企业服务公司的可信官网，内容与结构可以直接替换使用。',
    templateId: 'tpl-northstar-corporate',
    audience: '企业服务、咨询与产业数字化团队',
    useCase: '公司介绍、能力展示、客户咨询',
    highlights: ['专业可信', '行业能力展示', '咨询转化入口'],
    featured: true,
  },
  {
    id: 'starter-mono-portfolio',
    slug: 'mono-creative-portfolio',
    name: '个人作品集',
    description: '适合设计师、摄影师、独立开发者和顾问的完整个人主页与作品展示。',
    templateId: 'tpl-mono-portfolio',
    audience: '设计师、创作者、顾问与独立开发者',
    useCase: '个人介绍、作品展示、合作邀约',
    highlights: ['作品优先', '编辑感排版', '手机端友好'],
    featured: true,
  },
  {
    id: 'starter-ember-restaurant',
    slug: 'ember-restaurant-site',
    name: '餐厅预约主页',
    description: '包含品牌故事、招牌菜、营业时间和预约入口的餐饮成品项目。',
    templateId: 'tpl-ember-table',
    audience: '餐厅、咖啡馆、酒吧与生活方式品牌',
    useCase: '菜单展示、品牌介绍、到店预约',
    highlights: ['菜单与价格', '营业信息', '预约转化'],
    featured: false,
  },
  {
    id: 'starter-orbit-course',
    slug: 'orbit-course-enrollment',
    name: '课程招生页',
    description: '已经规划好课程成果、学习路径、模块说明和报名入口的教育项目。',
    templateId: 'tpl-orbit-academy',
    audience: '课程主理人、培训机构与知识产品团队',
    useCase: '课程介绍、训练营招生、学习成果展示',
    highlights: ['课程路径清晰', '学习成果具体', '报名入口完整'],
    featured: false,
  },
  {
    id: 'starter-signal-dashboard',
    slug: 'signal-operations-dashboard',
    name: '运营数据看板',
    description: '带关键指标、趋势图、区域表现和系统状态的高完成度数据大屏。',
    templateId: 'tpl-signal-dashboard',
    audience: '运营、物流、零售和业务分析团队',
    useCase: '业务汇报、运营监控、数据演示',
    highlights: ['高信息密度', '关键指标总览', '深色大屏布局'],
    featured: true,
  },
] as const

export function getStarterProject(idOrSlug: string): StarterProjectDefinition | undefined {
  return STARTER_PROJECTS.find((project) => project.id === idOrSlug || project.slug === idOrSlug)
}

export function renderStarterProject(
  project: StarterProjectDefinition,
  variables: Record<string, string> = {},
): string {
  const template = getOfficialTemplate(project.templateId)
  if (!template) throw new Error(`内置项目引用了不存在的模板:${project.templateId}`)
  return renderOfficialTemplate(template, {
    ...officialTemplateDefaults(template),
    ...variables,
  })
}

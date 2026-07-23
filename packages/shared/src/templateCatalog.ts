import {
  OFFICIAL_TEMPLATES,
  type OfficialTemplateDefinition,
  type OfficialTemplateVariable,
} from './officialTemplates'

function variables(
  brandName: string,
  headline: string,
  description: string,
  cta: string,
): OfficialTemplateVariable[] {
  return [
    { key: 'brandName', label: '品牌或项目名称', type: 'text', defaultValue: brandName, placeholder: '输入品牌名称', maxLength: 60 },
    { key: 'headline', label: '核心标题', type: 'text', defaultValue: headline, placeholder: '一句话说明核心价值', maxLength: 100 },
    { key: 'description', label: '简短介绍', type: 'textarea', defaultValue: description, placeholder: '补充两到三句话', maxLength: 260 },
    { key: 'primaryCta', label: '主要按钮', type: 'text', defaultValue: cta, placeholder: '输入行动文案', maxLength: 32 },
  ]
}

export const ADDITIONAL_OFFICIAL_TEMPLATES: OfficialTemplateDefinition[] = [
  {
    id: 'tpl-nova-ai-tool', slug: 'nova-ai-tool', name: 'Nova AI Tool',
    description: '面向 AI 工具的产品主页，突出真实工作流、结果样例和低门槛试用。',
    siteType: 'saas', category: '商业营销', industry: 'AI 工具', styleTags: ['科技', '渐变', '产品演示'], featured: true,
    layout: 'saas', dark: true,
    palette: { primary: '#8b5cf6', secondary: '#06b6d4', accent: '#22c55e', background: '#07070b', surface: '#14141d', text: '#fafafa', muted: '#a1a1aa' },
    variables: variables('Nova AI', '从想法到可交付成果，只需要一次清晰对话', '面向专业团队的 AI 工作空间，把资料、推理和交付过程汇聚到一个可控的流程中。', '免费体验'),
  },
  {
    id: 'tpl-pulse-mobile-app', slug: 'pulse-mobile-app', name: 'Pulse Mobile App',
    description: '移动应用发布页，适合展示核心场景、应用截图、用户评价和下载入口。',
    siteType: 'landing', category: '商业营销', industry: '移动应用', styleTags: ['移动端', '活力', '应用截图'], featured: true,
    layout: 'saas', dark: false,
    palette: { primary: '#ec4899', secondary: '#8b5cf6', accent: '#f97316', background: '#fff7fb', surface: '#ffffff', text: '#201827', muted: '#786c7e' },
    variables: variables('Pulse', '把每天真正重要的事，放回注意力中心', '一款轻量的个人节奏应用，帮助你整理目标、专注执行并看见持续进步。', '下载应用'),
  },
  {
    id: 'tpl-clarity-consulting', slug: 'clarity-consulting', name: 'Clarity Consulting',
    description: '专业咨询机构官网，围绕问题、方法、行业经验和咨询转化建立信任。',
    siteType: 'business', category: '专业服务', industry: '咨询服务', styleTags: ['专业', '理性', '高信任'], featured: true,
    layout: 'corporate', dark: false,
    palette: { primary: '#173f5f', secondary: '#20639b', accent: '#f6c85f', background: '#f5f8fb', surface: '#ffffff', text: '#172033', muted: '#667085' },
    variables: variables('Clarity Partners', '把复杂决策，转化为可以执行的清晰路径', '我们与管理团队共同识别关键问题、验证选择，并建立可以持续运行的组织能力。', '预约初步沟通'),
  },
  {
    id: 'tpl-haven-real-estate', slug: 'haven-real-estate', name: 'Haven Real Estate',
    description: '房地产项目与经纪服务主页，强调优质房源、区域洞察和预约看房。',
    siteType: 'business', category: '专业服务', industry: '房地产', styleTags: ['高端', '空间感', '大图'], featured: false,
    layout: 'portfolio', dark: false,
    palette: { primary: '#334155', secondary: '#78716c', accent: '#b45309', background: '#f7f5f0', surface: '#ffffff', text: '#292524', muted: '#78716c' },
    variables: variables('Haven 地产', '找到与你下一阶段生活真正匹配的空间', '精选城市核心区域住宅，并用透明、专业的服务陪你完成每一个关键决定。', '预约看房'),
  },
  {
    id: 'tpl-vital-clinic', slug: 'vital-clinic', name: 'Vital Clinic',
    description: '医疗诊所官网，提供医生介绍、服务项目、就诊流程和预约入口。',
    siteType: 'business', category: '专业服务', industry: '医疗健康', styleTags: ['安心', '清洁', '友好'], featured: true,
    layout: 'corporate', dark: false,
    palette: { primary: '#0f766e', secondary: '#0284c7', accent: '#f59e0b', background: '#f4fbfa', surface: '#ffffff', text: '#16302d', muted: '#617a76' },
    variables: variables('Vital 综合诊所', '专业医疗，也可以是一段安心、清楚的体验', '从线上预约到持续随访，我们用明确流程和耐心沟通照顾每一位来访者。', '预约就诊'),
  },
  {
    id: 'tpl-veritas-law', slug: 'veritas-law', name: 'Veritas Law',
    description: '律师事务所官网，以专业领域、代表经验和保密咨询建立可信度。',
    siteType: 'business', category: '专业服务', industry: '法律服务', styleTags: ['权威', '克制', '经典'], featured: false,
    layout: 'corporate', dark: true,
    palette: { primary: '#d4a853', secondary: '#64748b', accent: '#f8fafc', background: '#111318', surface: '#1b1f27', text: '#f8fafc', muted: '#a8adb7' },
    variables: variables('Veritas 律师事务所', '在关键时刻，提供清晰、稳健的法律判断', '专注企业治理、商业争议与知识产权，为复杂事项建立可执行的解决路径。', '预约保密咨询'),
  },
  {
    id: 'tpl-kindred-nonprofit', slug: 'kindred-nonprofit', name: 'Kindred Nonprofit',
    description: '公益组织主页，清晰展示使命、行动成果、真实故事和参与方式。',
    siteType: 'landing', category: '组织与活动', industry: '公益组织', styleTags: ['温暖', '真实', '故事'], featured: false,
    layout: 'community', dark: false,
    palette: { primary: '#dc6b3f', secondary: '#2f855a', accent: '#2563eb', background: '#fffaf5', surface: '#ffffff', text: '#352b27', muted: '#786b65' },
    variables: variables('Kindred 公益计划', '让每个孩子都能在安全的环境里继续学习', '我们与社区伙伴长期协作，为资源不足地区提供学习空间、陪伴和教师支持。', '参与行动'),
  },
  {
    id: 'tpl-ever-after-wedding', slug: 'ever-after-wedding', name: 'Ever After Wedding',
    description: '婚礼邀请与活动信息页，包含故事、时间地点、流程、相册和 RSVP。',
    siteType: 'landing', category: '组织与活动', industry: '婚礼活动', styleTags: ['浪漫', '优雅', '邀请函'], featured: false,
    layout: 'event', dark: false,
    palette: { primary: '#be7180', secondary: '#b38b59', accent: '#7c9a78', background: '#fffaf8', surface: '#ffffff', text: '#493b3e', muted: '#8b787c' },
    variables: variables('Yuna & Kai', '我们要结婚了，期待与你分享这一天', '一场关于相遇、陪伴和新旅程的庆祝。请在这里查看时间、地点与当天流程。', '确认出席'),
  },
  {
    id: 'tpl-airwave-podcast', slug: 'airwave-podcast', name: 'Airwave Podcast',
    description: '播客与访谈节目主页，突出最新节目、主持人、订阅入口和主题分类。',
    siteType: 'blog', category: '内容社区', industry: '播客与音频', styleTags: ['声音', '大胆', '节目'], featured: true,
    layout: 'editorial', dark: true,
    palette: { primary: '#f97316', secondary: '#a855f7', accent: '#22d3ee', background: '#100d18', surface: '#1c1726', text: '#fafafa', muted: '#b6adbf' },
    variables: variables('Airwave Podcast', '与认真思考的人，聊那些不能只用标题概括的问题', '每周一次长对话，讨论产品、文化、创作与个人选择背后的真实过程。', '收听最新一期'),
  },
  {
    id: 'tpl-signal-newsletter', slug: 'signal-newsletter', name: 'Signal Newsletter',
    description: '新闻通讯订阅页，强调主题判断、往期内容和低干扰订阅转化。',
    siteType: 'blog', category: '内容社区', industry: '新闻通讯', styleTags: ['编辑感', '阅读', '订阅'], featured: false,
    layout: 'editorial', dark: false,
    palette: { primary: '#1d4ed8', secondary: '#475569', accent: '#e11d48', background: '#f8fafc', surface: '#ffffff', text: '#172033', muted: '#64748b' },
    variables: variables('Signal Brief', '每周一封，把重要变化解释清楚', '不追逐所有热点，只选择真正影响产品、商业和技术判断的信号。', '免费订阅'),
  },
  {
    id: 'tpl-arcade-game', slug: 'arcade-game', name: 'Arcade Game',
    description: '游戏发布主页，展示世界观、角色、玩法亮点、媒体评价和下载入口。',
    siteType: 'landing', category: '娱乐与创作', industry: '游戏', styleTags: ['游戏', '霓虹', '沉浸'], featured: true,
    layout: 'event', dark: true,
    palette: { primary: '#22d3ee', secondary: '#a855f7', accent: '#f43f5e', background: '#060813', surface: '#111528', text: '#f8fafc', muted: '#9aa5c0' },
    variables: variables('Neon Rift', '穿过裂隙，重新定义你的每一次选择', '一款融合探索、策略与叙事的科幻动作游戏。你的决定会改变城市和伙伴的命运。', '加入愿望单'),
  },
  {
    id: 'tpl-seed-startup', slug: 'seed-startup', name: 'Seed Startup',
    description: '早期创业公司主页，用问题、产品、早期数据和团队信念建立清晰叙事。',
    siteType: 'saas', category: '商业营销', industry: '创业公司', styleTags: ['创业', '直接', '成长'], featured: false,
    layout: 'saas', dark: false,
    palette: { primary: '#16a34a', secondary: '#2563eb', accent: '#f97316', background: '#f7fcf8', surface: '#ffffff', text: '#17261b', muted: '#66756a' },
    variables: variables('Seed Labs', '为小团队减少重复工作，把时间还给真正重要的决策', '我们正在构建一套轻量工作流工具，让成长团队不再被表格、同步和状态追踪拖慢。', '申请早期体验'),
  },
]

export const SITEFORGE_TEMPLATES: OfficialTemplateDefinition[] = [
  ...OFFICIAL_TEMPLATES,
  ...ADDITIONAL_OFFICIAL_TEMPLATES,
]

export function getSiteForgeTemplate(idOrSlug: string): OfficialTemplateDefinition | undefined {
  return SITEFORGE_TEMPLATES.find((template) => template.id === idOrSlug || template.slug === idOrSlug)
}

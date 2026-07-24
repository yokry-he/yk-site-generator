import { normalizeHex } from './brand'

export type OfficialTemplateLayout =
  | 'saas'
  | 'corporate'
  | 'portfolio'
  | 'editorial'
  | 'event'
  | 'restaurant'
  | 'commerce'
  | 'education'
  | 'docs'
  | 'community'
  | 'dashboard'

export interface OfficialTemplateVariable {
  key: string
  label: string
  type: 'text' | 'textarea'
  defaultValue: string
  placeholder: string
  maxLength: number
}

export interface OfficialTemplateDefinition {
  id: string
  slug: string
  name: string
  description: string
  siteType: string
  category: string
  industry: string
  styleTags: string[]
  featured: boolean
  layout: OfficialTemplateLayout
  dark: boolean
  palette: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    muted: string
  }
  variables: OfficialTemplateVariable[]
}

const commonVariables = (
  brandName: string,
  headline: string,
  description: string,
  cta = '立即开始',
): OfficialTemplateVariable[] => [
  {
    key: 'brandName',
    label: '品牌或项目名称',
    type: 'text',
    defaultValue: brandName,
    placeholder: '例如：星云科技',
    maxLength: 60,
  },
  {
    key: 'headline',
    label: '核心标题',
    type: 'text',
    defaultValue: headline,
    placeholder: '一句话说明你的核心价值',
    maxLength: 100,
  },
  {
    key: 'description',
    label: '简短介绍',
    type: 'textarea',
    defaultValue: description,
    placeholder: '用两到三句话介绍业务或内容',
    maxLength: 260,
  },
  {
    key: 'primaryCta',
    label: '主要按钮',
    type: 'text',
    defaultValue: cta,
    placeholder: '例如：预约演示',
    maxLength: 32,
  },
]

export const OFFICIAL_TEMPLATES: OfficialTemplateDefinition[] = [
  {
    id: 'tpl-aurora-saas',
    slug: 'aurora-saas',
    name: 'Aurora SaaS',
    description: '高信任感的 SaaS 产品主页，聚焦功能价值、数据证明和转化路径。',
    siteType: 'saas',
    category: '商业营销',
    industry: '软件与 AI',
    styleTags: ['现代', '渐变', '高转化'],
    featured: true,
    layout: 'saas',
    dark: false,
    palette: {
      primary: '#6d5dfc', secondary: '#0ea5e9', accent: '#22c55e', background: '#f8fafc',
      surface: '#ffffff', text: '#111827', muted: '#64748b',
    },
    variables: commonVariables('Aurora AI', '把复杂工作流，变成清晰的一步', '面向成长团队的智能协作平台，将计划、执行和复盘汇聚在一个稳定的工作空间。', '免费开始'),
  },
  {
    id: 'tpl-northstar-corporate',
    slug: 'northstar-corporate',
    name: 'Northstar 企业站',
    description: '稳健克制的企业官网，适合展示核心业务、行业能力与客户案例。',
    siteType: 'business',
    category: '商业营销',
    industry: '企业服务',
    styleTags: ['专业', '可信', '克制'],
    featured: true,
    layout: 'corporate',
    dark: false,
    palette: {
      primary: '#0f3d75', secondary: '#0f766e', accent: '#d97706', background: '#f5f7fb',
      surface: '#ffffff', text: '#172033', muted: '#667085',
    },
    variables: commonVariables('北辰智造', '以可靠技术，推动产业持续进化', '我们为制造、能源和物流企业提供数字化解决方案，让关键业务更稳定、更透明、更高效。', '咨询方案'),
  },
  {
    id: 'tpl-mono-portfolio',
    slug: 'mono-portfolio',
    name: 'Mono Portfolio',
    description: '以作品本身为主角的极简作品集，适合设计师、摄影师与创意团队。',
    siteType: 'portfolio',
    category: '个人创作',
    industry: '设计与创意',
    styleTags: ['极简', '编辑感', '大图'],
    featured: true,
    layout: 'portfolio',
    dark: false,
    palette: {
      primary: '#111111', secondary: '#525252', accent: '#ef4444', background: '#f3f1ec',
      surface: '#fffdf8', text: '#171717', muted: '#737373',
    },
    variables: commonVariables('林默设计', '让复杂产品拥有清晰表达', '独立产品设计师，专注数字产品、品牌系统与复杂工作流体验。', '查看作品'),
  },
  {
    id: 'tpl-ink-journal',
    slug: 'ink-journal',
    name: 'Ink Journal',
    description: '有杂志气质的内容首页，适合博客、专栏和长期知识写作。',
    siteType: 'blog',
    category: '内容社区',
    industry: '内容与媒体',
    styleTags: ['杂志', '留白', '长阅读'],
    featured: false,
    layout: 'editorial',
    dark: false,
    palette: {
      primary: '#9f1239', secondary: '#374151', accent: '#d97706', background: '#fbf8f1',
      surface: '#ffffff', text: '#292524', muted: '#78716c',
    },
    variables: commonVariables('折页周刊', '在快速变化里，保留值得反复阅读的内容', '关注设计、技术与城市文化，每周整理一组有判断、有背景的深度文章。', '阅读最新一期'),
  },
  {
    id: 'tpl-summit-event',
    slug: 'summit-event',
    name: 'Summit Event',
    description: '节奏鲜明的活动落地页，包含嘉宾、议程、亮点与报名转化。',
    siteType: 'landing',
    category: '商业营销',
    industry: '活动与会议',
    styleTags: ['大胆', '动感', '活动'],
    featured: true,
    layout: 'event',
    dark: true,
    palette: {
      primary: '#8b5cf6', secondary: '#06b6d4', accent: '#f59e0b', background: '#09090b',
      surface: '#18181b', text: '#fafafa', muted: '#a1a1aa',
    },
    variables: commonVariables('Future Summit 2026', '与真正改变行业的人面对面', '两天主题演讲、深度工作坊和开放交流，聚焦 AI 产品、组织与下一代数字体验。', '立即报名'),
  },
  {
    id: 'tpl-ember-table',
    slug: 'ember-table',
    name: 'Ember Table',
    description: '温暖而精致的餐厅主页，突出招牌菜、氛围、营业信息与预约入口。',
    siteType: 'restaurant',
    category: '商业营销',
    industry: '餐饮与生活',
    styleTags: ['温暖', '质感', '餐饮'],
    featured: true,
    layout: 'restaurant',
    dark: true,
    palette: {
      primary: '#f59e0b', secondary: '#b45309', accent: '#ef4444', background: '#17120d',
      surface: '#251d16', text: '#fff7ed', muted: '#d6c6b6',
    },
    variables: commonVariables('余火小馆', '把季节、火候与人情端上餐桌', '一间专注炭火料理与本地食材的小餐馆。每日菜单随市场与季节变化。', '预约座位'),
  },
  {
    id: 'tpl-craft-commerce',
    slug: 'craft-commerce',
    name: 'Craft Commerce',
    description: '适合小型品牌的商品橱窗，强调故事、质感和清晰的购买动作。',
    siteType: 'shop',
    category: '商业营销',
    industry: '零售与手作',
    styleTags: ['自然', '商品感', '故事'],
    featured: false,
    layout: 'commerce',
    dark: false,
    palette: {
      primary: '#166534', secondary: '#a16207', accent: '#be123c', background: '#f7f5ef',
      surface: '#ffffff', text: '#292524', muted: '#78716c',
    },
    variables: commonVariables('山野器物', '把日常使用，做成值得长久陪伴的物件', '小批量手工制作的木器、皮具与家居用品，每件作品都保留材料本来的纹理。', '浏览新品'),
  },
  {
    id: 'tpl-orbit-academy',
    slug: 'orbit-academy',
    name: 'Orbit Academy',
    description: '结构清晰的课程招生页，突出课程收获、学习路径、讲师与报名信息。',
    siteType: 'education',
    category: '商业营销',
    industry: '教育与培训',
    styleTags: ['友好', '清晰', '课程'],
    featured: false,
    layout: 'education',
    dark: false,
    palette: {
      primary: '#2563eb', secondary: '#7c3aed', accent: '#f97316', background: '#f8fbff',
      surface: '#ffffff', text: '#172033', muted: '#64748b',
    },
    variables: commonVariables('Orbit 学院', '用 8 周完成你的第一个 AI 产品', '从需求发现到原型、评测和上线，跟随真实项目完成一套可复用的 AI 产品方法。', '查看课程计划'),
  },
  {
    id: 'tpl-api-compass',
    slug: 'api-compass',
    name: 'API Compass',
    description: '开发者友好的文档站首页，包含快速开始、导航、代码示例和版本提示。',
    siteType: 'docs',
    category: '内容社区',
    industry: '开发者工具',
    styleTags: ['开发者', '文档', '高密度'],
    featured: true,
    layout: 'docs',
    dark: true,
    palette: {
      primary: '#22c55e', secondary: '#06b6d4', accent: '#e879f9', background: '#071018',
      surface: '#0f1d29', text: '#f8fafc', muted: '#94a3b8',
    },
    variables: commonVariables('Compass API', '在几分钟内接入稳定、清晰的开放能力', '一致的接口设计、完整示例和可复制代码，让团队更快完成集成。', '快速开始'),
  },
  {
    id: 'tpl-common-ground',
    slug: 'common-ground',
    name: 'Common Ground',
    description: '适合兴趣社区和专业论坛的现代首页，强调话题、成员和参与感。',
    siteType: 'forum',
    category: '内容社区',
    industry: '社区与兴趣',
    styleTags: ['社区', '活跃', '现代'],
    featured: false,
    layout: 'community',
    dark: false,
    palette: {
      primary: '#7c3aed', secondary: '#db2777', accent: '#0ea5e9', background: '#faf9ff',
      surface: '#ffffff', text: '#211d2e', muted: '#716b7f',
    },
    variables: commonVariables('Common Ground', '与认真做事的人，一起分享过程', '一个面向独立创作者和小团队的社区，讨论产品、设计、增长与长期主义。', '加入社区'),
  },
  {
    id: 'tpl-signal-dashboard',
    slug: 'signal-dashboard',
    name: 'Signal Dashboard',
    description: '适合运营、物流和业务监控的高信息密度数据大屏。',
    siteType: 'dashboard',
    category: '数据可视化',
    industry: '运营与分析',
    styleTags: ['数据', '深色', '实时'],
    featured: true,
    layout: 'dashboard',
    dark: true,
    palette: {
      primary: '#22d3ee', secondary: '#34d399', accent: '#f59e0b', background: '#020617',
      surface: '#0f172a', text: '#f8fafc', muted: '#94a3b8',
    },
    variables: commonVariables('Signal Ops', '实时掌握关键业务信号', '将营收、订单、履约和风险指标集中在一个适合大屏展示的实时工作台。', '查看实时数据'),
  },
  {
    id: 'tpl-studio-profile',
    slug: 'studio-profile',
    name: 'Studio Profile',
    description: '克制但有个性的个人主页，适合独立开发者、顾问和创作者。',
    siteType: 'personal',
    category: '个人创作',
    industry: '个人品牌',
    styleTags: ['个人', '简洁', '可信'],
    featured: false,
    layout: 'portfolio',
    dark: true,
    palette: {
      primary: '#a78bfa', secondary: '#22d3ee', accent: '#f472b6', background: '#0b0b10',
      surface: '#17171f', text: '#fafafa', muted: '#a1a1aa',
    },
    variables: commonVariables('周屿', '独立开发者，专注把模糊想法做成可用产品', '我帮助早期团队完成产品策略、原型设计与前端落地，也持续发布自己的小产品。', '查看项目'),
  },
]

export function getOfficialTemplate(idOrSlug: string): OfficialTemplateDefinition | undefined {
  return OFFICIAL_TEMPLATES.find((template) => template.id === idOrSlug || template.slug === idOrSlug)
}

export function officialTemplateDefaults(template: OfficialTemplateDefinition): Record<string, string> {
  return Object.fromEntries(template.variables.map((variable) => [variable.key, variable.defaultValue]))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizedVariables(
  template: OfficialTemplateDefinition,
  variables: Record<string, string> = {},
): Record<string, string> {
  return Object.fromEntries(
    template.variables.map((variable) => {
      const raw = typeof variables[variable.key] === 'string' ? variables[variable.key] : variable.defaultValue
      const value = raw.trim().slice(0, variable.maxLength) || variable.defaultValue
      return [variable.key, escapeHtml(value)]
    }),
  )
}

function layoutContent(layout: OfficialTemplateLayout, values: Record<string, string>): string {
  const { brandName, headline, description, primaryCta } = values
  if (layout === 'portfolio') {
    return `<main><section class="hero editorial-hero"><p class="eyebrow">Independent studio · Selected work</p><h1>${headline}</h1><p class="lead">${description}</p><div class="hero-actions"><a class="button" href="#work">${primaryCta}</a><a class="text-link" href="#about">了解我 →</a></div></section><section id="work" class="work-grid"><article class="work work-a"><span>01 / Product system</span><h2>把复杂工作流整理成清晰体验</h2></article><article class="work work-b"><span>02 / Brand direction</span><h2>建立可持续演进的品牌语言</h2></article><article class="work work-c"><span>03 / Digital launch</span><h2>从想法到真正上线的产品</h2></article></section><section id="about" class="about-strip"><strong>${brandName}</strong><p>策略、设计与实现，保持在同一条产品逻辑里。</p></section></main>`
  }
  if (layout === 'editorial') {
    return `<main><section class="hero editorial-hero"><p class="eyebrow">Independent publication · Issue 024</p><h1>${headline}</h1><p class="lead">${description}</p><a class="button" href="#stories">${primaryCta}</a></section><section id="stories" class="story-grid"><article class="feature-story"><span>封面故事 · 12 min</span><h2>我们如何在信息过载中重新建立判断</h2><p>从工具、组织与个人经验出发，理解什么值得被留下。</p></article><div class="story-list"><article><span>设计</span><h3>好的界面为什么总让人感觉更安静</h3></article><article><span>技术</span><h3>AI 产品正在重新定义什么叫“默认体验”</h3></article><article><span>城市</span><h3>那些仍然值得步行抵达的地方</h3></article></div></section></main>`
  }
  if (layout === 'event') {
    return `<main><section class="hero event-hero"><p class="eyebrow">OCT 18–19 · SHANGHAI</p><h1>${headline}</h1><p class="lead">${description}</p><div class="hero-actions"><a class="button" href="#register">${primaryCta}</a><span class="attendees">2,400+ 同行者已加入</span></div></section><section class="speaker-row"><article><span>KEYNOTE 01</span><h3>从模型能力到真实产品价值</h3><p>林澈 · Product Lead</p></article><article><span>KEYNOTE 02</span><h3>下一代组织如何与 AI 协作</h3><p>陈默 · Founder</p></article><article><span>WORKSHOP</span><h3>构建可评测的智能体验</h3><p>周屿 · Design Engineer</p></article></section><section id="register" class="schedule"><div><span>DAY 01</span><strong>趋势、产品与商业</strong></div><div><span>DAY 02</span><strong>实践、工具与组织</strong></div></section></main>`
  }
  if (layout === 'restaurant') {
    return `<main><section class="hero restaurant-hero"><p class="eyebrow">SEASONAL FIRE KITCHEN</p><h1>${headline}</h1><p class="lead">${description}</p><div class="hero-actions"><a class="button" href="#reserve">${primaryCta}</a><span class="attendees">周二至周日 · 17:30–23:00</span></div></section><section class="menu-grid"><article><span>炭火</span><h3>熟成牛小排</h3><p>黑蒜酱 · 时蔬 · 山椒</p><strong>¥168</strong></article><article><span>海味</span><h3>盐烤时令鱼</h3><p>柚子醋 · 紫苏 · 白萝卜</p><strong>¥128</strong></article><article><span>甜点</span><h3>焦糖米布丁</h3><p>桂花 · 海盐 · 榛子</p><strong>¥48</strong></article></section><section id="reserve" class="reservation"><div><small>${brandName}</small><h2>留一张桌子，慢慢吃一顿饭</h2></div><a class="button" href="#">在线预约</a></section></main>`
  }
  if (layout === 'commerce') {
    return `<main><section class="hero commerce-hero"><p class="eyebrow">SMALL BATCH · MADE TO LAST</p><h1>${headline}</h1><p class="lead">${description}</p><a class="button" href="#products">${primaryCta}</a></section><section id="products" class="product-grid"><article><div class="product-visual visual-a"></div><span>桌面器物</span><h3>胡桃木收纳盘</h3><strong>¥329</strong></article><article><div class="product-visual visual-b"></div><span>随身皮具</span><h3>植鞣革卡包</h3><strong>¥269</strong></article><article><div class="product-visual visual-c"></div><span>居家织物</span><h3>亚麻靠垫套</h3><strong>¥189</strong></article></section><section class="about-strip"><strong>${brandName}</strong><p>每件作品都保留材料本来的纹理，也经得起长期使用。</p></section></main>`
  }
  if (layout === 'education') {
    return `<main><section class="hero education-hero"><div><p class="eyebrow">COHORT 08 · 8 WEEKS</p><h1>${headline}</h1><p class="lead">${description}</p><div class="hero-actions"><a class="button" href="#curriculum">${primaryCta}</a><span class="attendees">下一期开课：9 月 12 日</span></div></div><div class="course-card"><span>你将完成</span><strong>1 个可上线的 AI 产品</strong><ul><li>需求与机会识别</li><li>交互原型与评测</li><li>模型接入与上线</li></ul></div></section><section id="curriculum" class="module-grid"><article><span>01</span><h3>发现真正的问题</h3><p>研究、用户任务与价值判断。</p></article><article><span>02</span><h3>设计智能交互</h3><p>状态、反馈与可控性。</p></article><article><span>03</span><h3>建立质量评测</h3><p>从主观感受到可复现指标。</p></article></section></main>`
  }
  if (layout === 'docs') {
    return `<main class="docs-shell"><aside><strong>${brandName}</strong><nav><a class="active">快速开始</a><a>身份认证</a><a>核心接口</a><a>错误处理</a><a>SDK 与示例</a></nav></aside><section class="docs-content"><p class="eyebrow">DOCUMENTATION · V2.4</p><h1>${headline}</h1><p class="lead">${description}</p><div class="hero-actions"><a class="button" href="#quickstart">${primaryCta}</a><a class="text-link">查看 API 参考 →</a></div><div id="quickstart" class="code-card"><div><span>TypeScript</span><button>复制</button></div><pre><code>const client = new Compass({ apiKey })

const result = await client.generate({
  model: 'compass-pro',
  input: 'Hello world'
})</code></pre></div><section class="docs-cards"><article><h3>一致的接口设计</h3><p>所有资源遵循相同的请求、分页与错误格式。</p></article><article><h3>从示例开始</h3><p>每个能力都提供完整、可运行的代码示例。</p></article></section></section></main>`
  }
  if (layout === 'community') {
    return `<main><section class="hero community-hero"><p class="eyebrow">12,480 MEMBERS · 340 ONLINE</p><h1>${headline}</h1><p class="lead">${description}</p><a class="button" href="#topics">${primaryCta}</a></section><section id="topics" class="community-layout"><div class="topic-list"><article><span>产品展示 · 2h</span><h3>我用三个周末做了一个面向设计师的 AI 工具</h3><p>42 条回复 · 186 个赞</p></article><article><span>增长复盘 · 5h</span><h3>从 0 到 1,000 用户，我们只做对了这两件事</h3><p>28 条回复 · 109 个赞</p></article><article><span>技术问答 · 8h</span><h3>如何为多模型产品设计稳定的评测流程？</h3><p>19 条回复 · 74 个赞</p></article></div><aside class="community-side"><span>本周主题</span><strong>持续发布，比一次完美更重要</strong><p>${brandName} 社区精选讨论</p></aside></section></main>`
  }
  if (layout === 'dashboard') {
    return `<main class="dashboard-shell"><aside><strong>${brandName}</strong><nav><a class="active">总览</a><a>实时订单</a><a>履约监控</a><a>风险事件</a></nav></aside><section class="dashboard-main"><header><div><small>OPERATION CENTER</small><h1>${headline}</h1></div><a class="button">${primaryCta}</a></header><div class="metric-grid"><article><span>今日营收</span><strong>¥482,760</strong><i>+18.4%</i></article><article><span>订单完成率</span><strong>96.8%</strong><i>+2.1%</i></article><article><span>平均履约时间</span><strong>32 min</strong><i>-8.6%</i></article><article><span>风险事件</span><strong>7</strong><i class="warn">需关注</i></article></div><section class="chart-panel"><div><span>实时业务趋势</span><small>${description}</small></div><div class="chart-lines"><i></i><i></i><i></i><i></i><i></i></div></section><div class="dashboard-row"><article><span>区域表现</span><div class="bars"><i style="height:42%"></i><i style="height:64%"></i><i style="height:78%"></i><i style="height:56%"></i><i style="height:88%"></i></div></article><article><span>系统状态</span><ul><li><i></i>订单服务正常</li><li><i></i>库存同步正常</li><li><i class="warning"></i>华东节点延迟</li></ul></article></div></section></main>`
  }
  const cards = layout === 'corporate'
    ? [['行业解决方案', '覆盖咨询、系统建设与持续运营'], ['可靠交付', '明确里程碑与质量保证'], ['长期伙伴', '从项目到持续增长的协作']]
    : [['统一工作空间', '让计划、协作与知识保持在同一上下文'], ['可靠智能能力', '清晰权限、评测和可控的自动化'], ['可持续扩展', '从小团队开始，逐步连接整个组织']]
  return `<main><section class="hero product-hero"><div><p class="eyebrow">TRUSTED BY MODERN TEAMS</p><h1>${headline}</h1><p class="lead">${description}</p><div class="hero-actions"><a class="button" href="#features">${primaryCta}</a><a class="text-link" href="#proof">查看客户案例 →</a></div><div class="trust-row"><span>Nova</span><span>Polaris</span><span>Vertex</span><span>Oasis</span></div></div><div class="product-panel"><span>${brandName} WORKSPACE</span><div class="panel-metrics"><article><small>活跃项目</small><strong>128</strong></article><article><small>本周效率</small><strong>+32%</strong></article></div><div class="panel-chart"></div></div></section><section id="features" class="feature-grid">${cards.map(([title, text], index) => `<article><span>0${index + 1}</span><h3>${title}</h3><p>${text}</p></article>`).join('')}</section><section id="proof" class="proof-strip"><p>“上线后的第一个季度，我们减少了 41% 的重复沟通。”</p><strong>— 客户成功团队</strong></section></main>`
}

export function renderOfficialTemplate(
  template: OfficialTemplateDefinition,
  variables: Record<string, string> = {},
): string {
  const values = normalizedVariables(template, variables)
  const palette = Object.fromEntries(
    Object.entries(template.palette).map(([key, value]) => [key, normalizeHex(value)]),
  ) as OfficialTemplateDefinition['palette']
  const body = layoutContent(template.layout, values)
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${values.brandName} · ${template.name}</title><meta name="description" content="${values.description}"><meta name="theme-color" content="${palette.primary}"><style>
:root{--primary:${palette.primary};--secondary:${palette.secondary};--accent:${palette.accent};--bg:${palette.background};--surface:${palette.surface};--text:${palette.text};--muted:${palette.muted};--line:color-mix(in srgb,var(--text) 11%,transparent);--shadow:0 24px 80px color-mix(in srgb,var(--text) 13%,transparent)}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,'PingFang SC','Microsoft YaHei',system-ui,sans-serif;line-height:1.6}a{color:inherit;text-decoration:none}button{font:inherit}main{min-height:100vh}.site-nav{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(22px,6vw,88px);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(18px);position:sticky;top:0;z-index:20}.brand{display:flex;align-items:center;gap:11px;font-weight:850;letter-spacing:-.02em}.brand-mark{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;box-shadow:0 10px 30px color-mix(in srgb,var(--primary) 35%,transparent)}.site-nav nav{display:flex;align-items:center;gap:26px;font-size:14px;color:var(--muted)}.nav-cta{padding:9px 14px;border-radius:10px;background:var(--text);color:var(--bg);font-weight:750}.hero{padding:clamp(70px,10vw,132px) clamp(22px,8vw,120px) 78px}.product-hero,.education-hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(330px,.92fr);align-items:center;gap:64px}.eyebrow{font-size:12px;letter-spacing:.12em;font-weight:800;color:var(--primary);text-transform:uppercase}.hero h1{font-size:clamp(44px,6vw,78px);line-height:1.02;letter-spacing:-.055em;margin:20px 0;max-width:900px}.lead{font-size:clamp(16px,1.8vw,20px);color:var(--muted);max-width:680px}.hero-actions{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:30px}.button{display:inline-flex;align-items:center;justify-content:center;padding:12px 19px;border-radius:12px;background:var(--primary);color:white;font-weight:800;box-shadow:0 14px 35px color-mix(in srgb,var(--primary) 30%,transparent)}.text-link{font-weight:700;color:var(--muted)}.trust-row{display:flex;gap:28px;flex-wrap:wrap;margin-top:48px;color:var(--muted);font-weight:800;opacity:.65}.product-panel,.course-card{border:1px solid var(--line);background:var(--surface);border-radius:24px;padding:20px;box-shadow:var(--shadow)}.product-panel>span,.course-card>span{font-size:11px;letter-spacing:.11em;color:var(--muted);font-weight:800}.panel-metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.panel-metrics article,.metric-grid article{padding:18px;border:1px solid var(--line);border-radius:16px;background:color-mix(in srgb,var(--surface) 92%,var(--primary))}.panel-metrics small{color:var(--muted)}.panel-metrics strong{display:block;font-size:28px;margin-top:7px}.panel-chart{height:180px;border-radius:16px;margin-top:12px;background:linear-gradient(180deg,color-mix(in srgb,var(--primary) 25%,transparent),transparent),repeating-linear-gradient(90deg,transparent 0 52px,var(--line) 53px),repeating-linear-gradient(0deg,transparent 0 42px,var(--line) 43px);position:relative;overflow:hidden}.panel-chart:after{content:'';position:absolute;left:0;right:0;bottom:25%;height:3px;background:linear-gradient(90deg,var(--secondary),var(--primary),var(--accent));transform:skewY(-7deg);box-shadow:0 0 24px var(--primary)}.feature-grid,.module-grid{padding:10px clamp(22px,8vw,120px) 100px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.feature-grid article,.module-grid article,.speaker-row article,.menu-grid article,.docs-cards article{padding:26px;border:1px solid var(--line);background:var(--surface);border-radius:18px}.feature-grid article>span,.module-grid article>span{font-size:12px;color:var(--primary);font-weight:850}.feature-grid h3,.module-grid h3{margin:16px 0 8px}.feature-grid p,.module-grid p{color:var(--muted);margin:0}.proof-strip,.about-strip,.reservation,.schedule{margin:0 clamp(22px,8vw,120px) 96px;padding:32px;border-radius:22px;background:var(--text);color:var(--bg);display:flex;align-items:center;justify-content:space-between;gap:24px}.proof-strip p{font-size:20px;font-weight:750;max-width:780px}.editorial-hero{max-width:1050px}.work-grid,.story-grid,.product-grid,.speaker-row,.menu-grid{padding:0 clamp(22px,8vw,120px) 92px;display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.work{min-height:360px;padding:28px;border-radius:18px;display:flex;flex-direction:column;justify-content:space-between;color:white;background:linear-gradient(150deg,var(--primary),var(--secondary));box-shadow:var(--shadow)}.work-b{background:linear-gradient(150deg,var(--text),var(--primary))}.work-c{background:linear-gradient(150deg,var(--accent),var(--secondary))}.work span,.feature-story span,.story-list span,.speaker-row span,.menu-grid span,.product-grid span{font-size:11px;letter-spacing:.1em;font-weight:800;opacity:.72}.work h2{font-size:30px;line-height:1.14}.feature-story{grid-column:span 2;padding:40px;border-radius:20px;background:var(--text);color:var(--bg);min-height:390px;display:flex;flex-direction:column;justify-content:flex-end}.feature-story h2{font-size:clamp(34px,4vw,54px);line-height:1.06;max-width:780px}.feature-story p{opacity:.7}.story-list{display:grid;gap:12px}.story-list article{padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}.event-hero,.restaurant-hero,.commerce-hero,.community-hero{padding-top:clamp(90px,14vw,180px);padding-bottom:110px;background:radial-gradient(circle at 80% 10%,color-mix(in srgb,var(--secondary) 26%,transparent),transparent 34%)}.attendees{color:var(--muted);font-size:14px}.speaker-row article,.menu-grid article{min-height:240px;display:flex;flex-direction:column;justify-content:flex-end}.speaker-row h3,.menu-grid h3{font-size:24px;margin:12px 0 6px}.speaker-row p,.menu-grid p{color:var(--muted)}.menu-grid article{background:linear-gradient(180deg,color-mix(in srgb,var(--primary) 10%,var(--surface)),var(--surface))}.menu-grid strong{margin-top:16px;color:var(--primary)}.product-grid article{display:grid;gap:8px}.product-visual{aspect-ratio:4/5;border-radius:16px;margin-bottom:12px;background:linear-gradient(145deg,color-mix(in srgb,var(--primary) 35%,var(--surface)),var(--surface))}.visual-b{background:linear-gradient(145deg,color-mix(in srgb,var(--secondary) 35%,var(--surface)),var(--surface))}.visual-c{background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 35%,var(--surface)),var(--surface))}.product-grid h3{margin:0}.product-grid strong{color:var(--primary)}.course-card strong{display:block;font-size:28px;line-height:1.2;margin:14px 0 20px}.course-card ul{margin:0;padding-left:20px;color:var(--muted)}.docs-shell,.dashboard-shell{display:grid;grid-template-columns:260px 1fr;min-height:100vh}.docs-shell aside,.dashboard-shell aside{padding:30px 22px;border-right:1px solid var(--line);background:var(--surface)}.docs-shell aside strong,.dashboard-shell aside strong{font-size:18px}.docs-shell aside nav,.dashboard-shell aside nav{display:grid;gap:5px;margin-top:32px}.docs-shell aside a,.dashboard-shell aside a{padding:10px 12px;border-radius:9px;color:var(--muted);font-size:14px}.docs-shell aside a.active,.dashboard-shell aside a.active{background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary);font-weight:800}.docs-content{padding:72px clamp(26px,7vw,100px)}.docs-content h1{font-size:clamp(42px,6vw,72px);line-height:1.03;letter-spacing:-.05em;max-width:850px}.code-card{margin-top:42px;border:1px solid var(--line);border-radius:16px;overflow:hidden;background:#071018;color:#dbeafe}.code-card>div{padding:12px 16px;border-bottom:1px solid #ffffff18;display:flex;justify-content:space-between;font-size:12px}.code-card button{border:0;background:transparent;color:#94a3b8}.code-card pre{padding:24px;overflow:auto;margin:0}.docs-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}.docs-cards p{color:var(--muted)}.community-layout{padding:0 clamp(22px,8vw,120px) 100px;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:20px}.topic-list{display:grid;gap:12px}.topic-list article,.community-side{padding:24px;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.topic-list span,.community-side span{font-size:11px;color:var(--primary);font-weight:800}.topic-list h3{font-size:20px;margin:10px 0}.topic-list p,.community-side p{color:var(--muted);font-size:13px}.community-side strong{display:block;font-size:26px;line-height:1.2;margin-top:14px}.dashboard-main{padding:30px;background:radial-gradient(circle at 50% 0,color-mix(in srgb,var(--primary) 10%,transparent),transparent 35%)}.dashboard-main header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.dashboard-main header small{color:var(--muted);letter-spacing:.12em}.dashboard-main h1{font-size:32px;margin:4px 0 0}.metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:28px}.metric-grid article span{color:var(--muted);font-size:12px}.metric-grid article strong{display:block;font-size:28px;margin:10px 0 4px}.metric-grid article i{font-style:normal;font-size:11px;color:#34d399}.metric-grid article i.warn{color:#f59e0b}.chart-panel,.dashboard-row article{margin-top:16px;padding:20px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}.chart-panel>div:first-child{display:flex;justify-content:space-between;gap:20px}.chart-panel small{color:var(--muted)}.chart-lines{height:260px;margin-top:18px;display:flex;align-items:flex-end;gap:12px;padding:20px;background:repeating-linear-gradient(0deg,transparent 0 49px,var(--line) 50px)}.chart-lines i{flex:1;border-radius:6px 6px 0 0;background:linear-gradient(180deg,var(--primary),color-mix(in srgb,var(--primary) 18%,transparent));height:42%}.chart-lines i:nth-child(2){height:66%}.chart-lines i:nth-child(3){height:54%}.chart-lines i:nth-child(4){height:82%}.chart-lines i:nth-child(5){height:72%}.dashboard-row{display:grid;grid-template-columns:1.3fr .7fr;gap:16px}.bars{height:160px;display:flex;align-items:flex-end;gap:14px;margin-top:18px}.bars i{flex:1;background:linear-gradient(180deg,var(--secondary),var(--primary));border-radius:6px 6px 0 0}.dashboard-row ul{padding:0;list-style:none;display:grid;gap:14px}.dashboard-row li{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px}.dashboard-row li i{width:8px;height:8px;border-radius:50%;background:#34d399}.dashboard-row li i.warning{background:#f59e0b}@media(max-width:900px){.site-nav nav span{display:none}.product-hero,.education-hero{grid-template-columns:1fr}.work-grid,.story-grid,.product-grid,.speaker-row,.menu-grid,.feature-grid,.module-grid{grid-template-columns:1fr}.feature-story{grid-column:auto}.community-layout{grid-template-columns:1fr}.docs-shell,.dashboard-shell{grid-template-columns:1fr}.docs-shell aside,.dashboard-shell aside{display:none}.metric-grid{grid-template-columns:1fr 1fr}.dashboard-row{grid-template-columns:1fr}}@media(max-width:560px){.hero{padding-left:20px;padding-right:20px}.hero h1{font-size:42px}.site-nav{padding:0 18px}.site-nav nav{gap:10px}.feature-grid,.module-grid,.work-grid,.story-grid,.product-grid,.speaker-row,.menu-grid,.community-layout{padding-left:20px;padding-right:20px}.proof-strip,.about-strip,.reservation,.schedule{margin-left:20px;margin-right:20px;align-items:flex-start;flex-direction:column}.metric-grid{grid-template-columns:1fr}.dashboard-main{padding:18px}.docs-content{padding:52px 20px}.docs-cards{grid-template-columns:1fr}}
</style></head><body><header class="site-nav"><a class="brand" href="#"><span class="brand-mark">${escapeHtml(values.brandName.slice(0, 1).toUpperCase())}</span><span>${values.brandName}</span></a><nav><span>产品</span><span>案例</span><span>关于</span><a class="nav-cta" href="#">${values.primaryCta}</a></nav></header>${body}</body></html>`
}

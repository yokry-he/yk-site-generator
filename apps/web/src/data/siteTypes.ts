import {
  User,
  Building2,
  BookOpen,
  BarChart3,
  Palette,
  Rocket,
  PenSquare,
  Cloud,
  Library,
  ShoppingBag,
  FileUser,
  UtensilsCrossed,
  GraduationCap,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-vue-next'

export interface SiteType {
  id: string
  name: string
  icon: LucideIcon
  group: string
  desc: string
  tags: string[]
  example: string
}

export const TYPE_GROUPS = ['个人创作', '商业营销', '内容社区', '数据可视化'] as const

export const SITE_TYPES: SiteType[] = [
  // ---- 个人创作 ----
  {
    id: 'personal',
    name: '个人主页',
    icon: User,
    group: '个人创作',
    desc: '聚合自我介绍、社交链接与动态,一张属于你的数字名片。',
    tags: ['响应式布局', '社交链接聚合'],
    example:
      '一个深色极简风格的个人主页,包含自我介绍、技能标签、社交媒体链接和最近动态,背景带一点粒子动效。',
  },
  {
    id: 'portfolio',
    name: '作品集',
    icon: Palette,
    group: '个人创作',
    desc: '用画廊级的排版展示作品,让每一件都被认真观看。',
    tags: ['瀑布流画廊', '灯箱预览'],
    example:
      '一个摄影师作品集网站,瀑布流照片墙,按系列分类,点开后有大图灯箱和拍摄参数说明。',
  },
  {
    id: 'resume',
    name: '在线简历',
    icon: FileUser,
    group: '个人创作',
    desc: '比 PDF 更生动的履历:经历时间线、技能图谱一键分享。',
    tags: ['经历时间线', '一键导出 PDF'],
    example:
      '一个前端工程师的在线简历,左侧是个人信息和技能条,右侧是工作与项目经历时间线,风格专业干净。',
  },
  {
    id: 'blog',
    name: '博客站',
    icon: PenSquare,
    group: '个人创作',
    desc: '专注写作的个人博客,文章列表、标签归档一应俱全。',
    tags: ['Markdown 写作', '标签归档'],
    example:
      '一个简约的中文技术博客,首页是文章列表,支持标签分类、归档和 RSS 订阅,排版适合长文阅读。',
  },
  // ---- 商业营销 ----
  {
    id: 'business',
    name: '企业官网',
    icon: Building2,
    group: '商业营销',
    desc: '品牌展示、产品服务与客户案例,一步到位的企业门面。',
    tags: ['SEO 优化', '表单留资'],
    example:
      '一家人工智能初创公司的官网,包含产品介绍、核心功能、客户案例和联系我们表单,风格现代专业。',
  },
  {
    id: 'saas',
    name: 'SaaS 产品页',
    icon: Cloud,
    group: '商业营销',
    desc: '功能卖点、客户评价与定价,为转化而生的产品主页。',
    tags: ['功能对比表', '评价墙'],
    example:
      '一个团队协作 SaaS 的产品主页,包含功能卖点、截图展示、客户评价、三档定价和免费试用按钮。',
  },
  {
    id: 'landing',
    name: '活动落地页',
    icon: Rocket,
    group: '商业营销',
    desc: '发布会、促销、报名页,聚焦转化的单页营销阵地。',
    tags: ['倒计时组件', '报名表单'],
    example:
      '一场线上技术大会的活动落地页,包含大会介绍、嘉宾阵容、议程时间表、倒计时和立即报名按钮。',
  },
  {
    id: 'shop',
    name: '电商橱窗',
    icon: ShoppingBag,
    group: '商业营销',
    desc: '小而美的商品陈列橱窗,所见即所得的购买入口。',
    tags: ['商品网格', '购买跳转'],
    example:
      '一个手作饰品品牌的小型电商橱窗,网格陈列商品图和价格,点进有详情和购买按钮,风格温暖文艺。',
  },
  {
    id: 'restaurant',
    name: '餐饮门店页',
    icon: UtensilsCrossed,
    group: '商业营销',
    desc: '招牌菜单、门店信息与预约,让人隔着屏幕闻到香味。',
    tags: ['菜单展示', '在线预约'],
    example:
      '一家日式料理店的门店页,包含招牌菜品展示、菜单价格、营业时间、地址地图和电话预约入口。',
  },
  {
    id: 'education',
    name: '教育课程页',
    icon: GraduationCap,
    group: '商业营销',
    desc: '课程大纲、讲师阵容与报名转化,招生页的完整答案。',
    tags: ['课程大纲', '讲师介绍'],
    example:
      '一个 Python 数据分析训练营的课程页,包含课程亮点、章节目录、讲师介绍、学员评价和报名价格。',
  },
  // ---- 内容社区 ----
  {
    id: 'docs',
    name: '文档站',
    icon: BookOpen,
    group: '内容社区',
    desc: '结构化产品文档,搜索、目录、代码高亮一应俱全。',
    tags: ['全文搜索', '代码高亮'],
    example:
      '一个开源项目的开发者文档站,左侧有目录导航,支持全文搜索、代码高亮和深色模式。',
  },
  {
    id: 'wiki',
    name: '知识库 Wiki',
    icon: Library,
    group: '内容社区',
    desc: '团队知识的中枢:分类、词条与版本沉淀。',
    tags: ['词条分类', '协作编辑'],
    example:
      '一个团队内部知识库 Wiki,顶部有搜索框,内容按部门分类,词条页有目录、表格和最近更新记录。',
  },
  {
    id: 'forum',
    name: '社区论坛',
    icon: MessagesSquare,
    group: '内容社区',
    desc: '话题、回帖与热度排行,一个能聊起来的角落。',
    tags: ['话题列表', '热度排序'],
    example:
      '一个摄影爱好者社区论坛,有板块分类、话题列表、回帖数和热度标识,整体风格简洁现代。',
  },
  // ---- 数据可视化 ----
  {
    id: 'dashboard',
    name: '数据大屏',
    icon: BarChart3,
    group: '数据可视化',
    desc: '实时指标、图表与地图可视化,会议室里的焦点。',
    tags: ['实时刷新', '图表联动'],
    example:
      '一个城市交通运行监测数据大屏,深色背景,包含实时流量指标、趋势折线图、柱状排行和地图模块。',
  },
]

export const typeById = (id: string) => SITE_TYPES.find((t) => t.id === id)

export type GenerationMode = 'fast' | 'balanced' | 'quality'

export interface GenerationModeProfile {
  id: GenerationMode
  label: string
  description: string
  maxTokens: number
  outputTarget: string
  sectionGuidance: string
  promptDirectives: readonly string[]
}

export const DEFAULT_GENERATION_MODE: GenerationMode = 'balanced'

export const GENERATION_MODES: readonly GenerationModeProfile[] = [
  {
    id: 'fast',
    label: '极速草稿',
    description: '最快得到完整、可继续编辑的页面',
    maxTokens: 2800,
    outputTarget: '约 1600–2400 tokens',
    sectionGuidance: '4–6 个关键区块',
    promptDirectives: [
      '优先尽快交付完整可运行页面，控制为 4–6 个关键区块',
      '避免非必要 JavaScript、复杂动画和重复装饰，先保证信息清楚与移动端可用',
      '文案保持具体，禁止 lorem ipsum、占位按钮和无意义数据',
    ],
  },
  {
    id: 'balanced',
    label: '平衡生成',
    description: '兼顾完成速度、视觉品质与内容深度',
    maxTokens: 4600,
    outputTarget: '约 2800–4200 tokens',
    sectionGuidance: '6–8 个完整区块',
    promptDirectives: [
      '生成 6–8 个完整区块，建立统一的色彩、字号、间距、圆角和组件语言',
      '内容必须针对用户业务，不使用空泛口号；首屏价值主张、证明信息和 CTA 要形成完整转化路径',
      '只加入真正提升体验的轻量交互，保证移动端、键盘操作和加载性能',
    ],
  },
  {
    id: 'quality',
    label: '精致成品',
    description: '使用更高输出预算，追求可直接交付的完成度',
    maxTokens: 7200,
    outputTarget: '约 4800–6500 tokens',
    sectionGuidance: '7–10 个高完成度区块',
    promptDirectives: [
      '以可直接交付为目标，生成 7–10 个高完成度区块，并形成明确的视觉概念而不是通用模板拼接',
      '文案、示例数据、标签和 CTA 必须具体可信；用真实的信息层级、对比和节奏建立专业感',
      '完善桌面、平板和手机布局，处理导航、长文本、卡片密度、触控尺寸、焦点样式和 reduced-motion',
      '控制运行成本：不引入重量级框架，不阻塞首屏，图片声明尺寸并延迟加载非首屏资源，避免布局偏移',
      '输出前静默自检 HTML 闭合、移动端横向溢出、颜色对比、占位文案、重复 ID、失效链接和无名称按钮',
    ],
  },
] as const

export function getGenerationModeProfile(mode: GenerationMode | string | undefined): GenerationModeProfile {
  return GENERATION_MODES.find((item) => item.id === mode)
    ?? GENERATION_MODES.find((item) => item.id === DEFAULT_GENERATION_MODE)!
}

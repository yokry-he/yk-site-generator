from pathlib import Path


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf8')


def replace(path: str, before: str, after: str, count: int = 1) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf8')
    if before not in source:
        raise SystemExit(f'anchor not found in {path}: {before[:80]!r}')
    target.write_text(source.replace(before, after, count), encoding='utf8')


write('packages/shared/src/generation.ts', r'''export type GenerationMode = 'fast' | 'balanced' | 'quality'

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
''')

replace('packages/shared/src/index.ts', "export * from './templateCatalogBootstrap'\n", "export * from './templateCatalogBootstrap'\nexport * from './generation'\n")

write('packages/shared/test/generation.test.ts', r'''import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GENERATION_MODE,
  GENERATION_MODES,
  getGenerationModeProfile,
} from '../src/generation'

describe('generation modes', () => {
  it('provides ordered fast, balanced and quality strategies', () => {
    expect(GENERATION_MODES.map((item) => item.id)).toEqual(['fast', 'balanced', 'quality'])
    expect(new Set(GENERATION_MODES.map((item) => item.maxTokens)).size).toBe(3)
    expect(GENERATION_MODES.every((item) => item.promptDirectives.length >= 3)).toBe(true)
  })

  it('falls back to balanced for missing or unknown values', () => {
    expect(DEFAULT_GENERATION_MODE).toBe('balanced')
    expect(getGenerationModeProfile(undefined).id).toBe('balanced')
    expect(getGenerationModeProfile('unknown').id).toBe('balanced')
  })

  it('allocates the largest budget to quality mode', () => {
    expect(getGenerationModeProfile('quality').maxTokens)
      .toBeGreaterThan(getGenerationModeProfile('balanced').maxTokens)
  })
})
''')

write('packages/prompts/src/system.ts', r'''import {
  DEFAULT_GENERATION_MODE,
  getGenerationModeProfile,
  type GenerationMode,
} from 'shared'

/**
 * 通用系统提示词：定义模型输出协议与全局质量约束。
 * 输出协议与 shared 包 parseModelOutput 的解析能力严格对齐。
 */
const BASE_SYSTEM_PROMPT = `你是一位资深的前端工程师、视觉设计师与内容策略师，负责根据用户需求直接生成可上线的静态网站。

## 输出协议（必须严格遵守）

1. 先输出一个文件清单，格式为一个 fenced code 块，语言标注为 json，内容形如：
   {"files": [{"path": "index.html", "description": "入口页面"}, {"path": "styles.css", "description": "全局样式"}]}
2. 然后逐个输出文件内容，每个文件一个 fenced code 块，语言标注后必须带上 path 标注，例如：
   \`\`\`html path="index.html"
   ...
   \`\`\`
3. 清单中的路径必须与代码块的 path 标注一一对应；路径使用相对路径，不要以 / 开头。
4. **清单之后必须紧跟全部文件的代码块，绝不允许只输出清单就结束回复**——清单不是交付物，代码才是。
5. 除文件清单和代码块之外，不要输出任何解释性散文。

## 产物约束

- 默认产物是单个自包含的 index.html（样式写在 <style>、脚本写在 <script>，不再拆分其他文件）；不要引用本地图片、字体等二进制资源，图标使用内联 SVG、CSS 或语义明确的 Unicode 符号。
- **完整性高于一切**：必须一次性完整输出全部代码并以闭合的代码围栏正常结束；主动合并重复 CSS、控制示例数量，不能因追求装饰而截断代码。
- 允许引用的外链仅限 CDN 白名单：cdn.jsdelivr.net、unpkg.com、cdnjs.cloudflare.com、fonts.googleapis.com、fonts.gstatic.com。除此之外不得出现任何外部 URL。
- 语言遵循用户需求；未指定时使用简体中文并设置 <html lang="zh-CN">。
- 移动优先：先保证手机端体验，再适配平板和桌面；必须包含 viewport meta，禁止横向溢出。
- 使用语义化 HTML 与基础无障碍：合理使用 header/nav/main/section/footer，为图像和图标提供替代文本，保证颜色对比和可见焦点。
- <head> 中包含 title、description、favicon 或内联图标、Open Graph 基础信息；不要编写后端逻辑或真实表单提交。
- 生成的网站必须轻量：不使用重量级框架，不阻塞首屏，避免不必要的网络请求、布局偏移和持续运行的定时器。`

export function buildSystemPrompt(mode: GenerationMode = DEFAULT_GENERATION_MODE): string {
  const profile = getGenerationModeProfile(mode)
  return `${BASE_SYSTEM_PROMPT}

## 当前生成策略：${profile.label}

- 输出目标：${profile.outputTarget}；${profile.sectionGuidance}。
${profile.promptDirectives.map((item) => `- ${item}`).join('\n')}`
}

/** 默认系统提示词保持向后兼容。 */
export const SYSTEM_PROMPT = buildSystemPrompt()
''')

write('packages/prompts/src/index.ts', r'''import {
  DEFAULT_GENERATION_MODE,
  getGenerationModeProfile,
  type GenerationMode,
} from 'shared'
import { SITE_TYPE_PROFILES, getProfile } from './profiles'
import { SYSTEM_PROMPT, buildSystemPrompt } from './system'
import type { SiteTypeProfile } from './profiles'

export { SITE_TYPE_PROFILES, getProfile, SYSTEM_PROMPT, buildSystemPrompt }
export { buildIterationPrompt } from './iterate'
export type { BuildIterationInput, BuiltIterationPrompt } from './iterate'
export type { SiteTypeProfile }

/** 一次迭代修改意见（SF-1-6 迭代会话将消费此结构）。 */
export interface IterationHistoryItem {
  artifactHtml?: string
  feedback: string
}

export interface BuildPromptInput {
  siteType: string
  requirement: string
  history?: IterationHistoryItem[]
  mode?: GenerationMode
}

export interface BuiltPrompt {
  system: string
  user: string
}

/** 组装生成提示词：通用系统提示词 + 站点类型画像 + 生成策略 + 用户需求。 */
export function buildGenerationPrompt(input: BuildPromptInput): BuiltPrompt {
  const profile = getProfile(input.siteType)
  if (!profile) {
    throw new Error(
      `未知站点类型:${input.siteType}。可用类型:${SITE_TYPE_PROFILES.map((p) => p.id).join(', ')}`,
    )
  }
  const mode = input.mode ?? DEFAULT_GENERATION_MODE
  const generation = getGenerationModeProfile(mode)

  const sections: string[] = [
    `【站点类型】${profile.name}(${profile.id})`,
    `【生成策略】${generation.label}；${generation.sectionGuidance}；${generation.outputTarget}`,
    `【结构骨架】请按以下结构组织页面:\n${profile.skeleton.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    `【必备要素】\n${profile.essentials.map((s) => `- ${s}`).join('\n')}`,
    `【设计倾向】${profile.design}`,
    `【负向约束】\n${profile.negative.map((s) => `- ${s}`).join('\n')}`,
    `【用户需求】\n${input.requirement}`,
  ]

  if (input.history && input.history.length > 0) {
    const historyText = input.history
      .map((h, i) => {
        const parts = [`第 ${i + 1} 轮修改意见:${h.feedback}`]
        if (h.artifactHtml) parts.push(`该轮产物 HTML:\n${h.artifactHtml}`)
        return parts.join('\n')
      })
      .join('\n\n')
    sections.push(`【上一版产物与修改意见】请在上一版基础上按意见修改，保持未提及的部分不变:\n${historyText}`)
  }

  return { system: buildSystemPrompt(mode), user: sections.join('\n\n') }
}
''')

write('packages/prompts/src/iterate.ts', r'''import {
  DEFAULT_GENERATION_MODE,
  getGenerationModeProfile,
  type GenerationMode,
} from 'shared'
import { getProfile } from './profiles'
import { buildSystemPrompt } from './system'

export interface BuildIterationInput {
  siteType: string
  currentArtifact: string
  instruction: string
  round: number
  mode?: GenerationMode
}

export interface BuiltIterationPrompt {
  system: string
  user: string
}

/** 迭代提示词：全量产物 + 修改要求 → 输出完整新产物。 */
export function buildIterationPrompt(input: BuildIterationInput): BuiltIterationPrompt {
  const profile = getProfile(input.siteType)
  const typeLabel = profile ? `${profile.name}(${profile.id})` : input.siteType
  const mode = input.mode ?? DEFAULT_GENERATION_MODE
  const generation = getGenerationModeProfile(mode)

  const user = [
    `【站点类型】${typeLabel}`,
    `【生成策略】${generation.label}；本轮仍需满足 ${generation.outputTarget} 与完整输出要求`,
    `【当前产物(第 ${input.round - 1} 轮)】以下是上一轮生成的完整单 HTML 产物:\n\`\`\`html\n${input.currentArtifact}\n\`\`\``,
    `【修改指令(第 ${input.round} 轮)】\n${input.instruction}`,
    [
      '【迭代要求】',
      '- 严格按照【修改指令】修改，未提及的部分必须与当前产物保持一致，不要自由重写',
      '- 输出完整的新产物，不是 diff、片段或修改说明',
      '- 输出协议不变：先文件清单 JSON 块，再带 path 标注的 fenced code 块',
      `- 按${generation.label}控制复杂度；完整闭合优先于装饰数量`,
    ].join('\n'),
  ].join('\n\n')

  return { system: buildSystemPrompt(mode), user }
}
''')

write('packages/prompts/test/prompts.test.ts', r'''import { describe, expect, it } from 'vitest'
import {
  SITE_TYPE_PROFILES,
  SYSTEM_PROMPT,
  buildGenerationPrompt,
  buildSystemPrompt,
  getProfile,
} from '../src/index'

describe('站点类型画像', () => {
  it('覆盖 14 类站点', () => {
    expect(SITE_TYPE_PROFILES).toHaveLength(14)
    const ids = SITE_TYPE_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(14)
  })

  it('每类画像字段完整', () => {
    for (const p of SITE_TYPE_PROFILES) {
      expect(p.skeleton.length).toBeGreaterThanOrEqual(4)
      expect(p.essentials.length).toBeGreaterThanOrEqual(2)
      expect(p.design.length).toBeGreaterThan(0)
      expect(p.negative.length).toBeGreaterThanOrEqual(1)
      expect(p.validationKeywords.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('buildGenerationPrompt', () => {
  it('14 类均可构建并默认使用平衡生成', () => {
    for (const p of SITE_TYPE_PROFILES) {
      const { system, user } = buildGenerationPrompt({ siteType: p.id, requirement: '测试需求' })
      expect(system).toBe(SYSTEM_PROMPT)
      expect(system).toContain('当前生成策略：平衡生成')
      expect(user).toContain(p.name)
      expect(user).toContain(p.skeleton[0])
      expect(user).toContain(p.negative[0])
      expect(user).toContain('测试需求')
    }
  })

  it('不同策略改变系统约束和用户策略段', () => {
    const fast = buildGenerationPrompt({ siteType: 'saas', requirement: '测试', mode: 'fast' })
    const quality = buildGenerationPrompt({ siteType: 'saas', requirement: '测试', mode: 'quality' })
    expect(fast.system).toContain('当前生成策略：极速草稿')
    expect(fast.user).toContain('【生成策略】极速草稿')
    expect(quality.system).toContain('当前生成策略：精致成品')
    expect(quality.system).toContain('静默自检')
    expect(quality.user).toContain('7–10 个高完成度区块')
  })

  it('system 包含输出协议与运行性能约束', () => {
    expect(SYSTEM_PROMPT).toContain('文件清单')
    expect(SYSTEM_PROMPT).toContain('path')
    expect(SYSTEM_PROMPT).toContain('fenced code 块')
    expect(buildSystemPrompt('quality')).toContain('不阻塞首屏')
  })

  it('未知站点类型抛出错误', () => {
    expect(() => buildGenerationPrompt({ siteType: 'nope', requirement: 'x' })).toThrow(/未知站点类型/)
  })

  it('history 生效:追加迭代段并包含反馈意见', () => {
    const { user } = buildGenerationPrompt({
      siteType: 'blog', requirement: '做一个博客',
      history: [{ artifactHtml: '<html>旧版</html>', feedback: '把主题色改成绿色' }],
    })
    expect(user).toContain('【上一版产物与修改意见】')
    expect(user).toContain('把主题色改成绿色')
    expect(user).toContain('<html>旧版</html>')
  })

  it('history 中 artifactHtml 可省略', () => {
    const { user } = buildGenerationPrompt({
      siteType: 'blog', requirement: '做一个博客', history: [{ feedback: '字体大一点' }],
    })
    expect(user).toContain('字体大一点')
    expect(user).not.toContain('该轮产物 HTML')
  })

  it('getProfile 按 id 查找', () => {
    expect(getProfile('saas')?.name).toBe('SaaS 产品页')
    expect(getProfile('unknown')).toBeUndefined()
  })
})
''')

# Server generation strategy and timing metadata.
replace(
    'apps/server/src/routes/generate.ts',
    "import { parseModelOutput } from 'shared'",
    "import {\n  DEFAULT_GENERATION_MODE,\n  getGenerationModeProfile,\n  parseModelOutput,\n} from 'shared'",
)
replace(
    'apps/server/src/routes/generate.ts',
    "  history: z.array(historyItemSchema).optional(),\n  maxTokens: z.number().int().positive().max(8192).optional(),",
    "  history: z.array(historyItemSchema).optional(),\n  mode: z.enum(['fast', 'balanced', 'quality']).default(DEFAULT_GENERATION_MODE),\n  maxTokens: z.number().int().positive().max(8192).optional(),",
)
replace(
    'apps/server/src/routes/generate.ts',
    "          round: lastHistory.round ?? 2,\n        })",
    "          round: lastHistory.round ?? 2,\n          mode: body.mode,\n        })",
)
replace(
    'apps/server/src/routes/generate.ts',
    "          history: body.history?.map((h) => ({ feedback: h.instruction, artifactHtml: h.artifact })),\n        })",
    "          history: body.history?.map((h) => ({ feedback: h.instruction, artifactHtml: h.artifact })),\n          mode: body.mode,\n        })",
)
replace(
    'apps/server/src/routes/generate.ts',
    "  const requestId = requestIdFromContext(c)\n  const startedAt = Date.now()\n  const mode = body.history?.length ? 'iterate' : 'generate'",
    "  const requestId = requestIdFromContext(c)\n  const startedAt = Date.now()\n  const generationProfile = getGenerationModeProfile(body.mode)\n  const mode = body.history?.length ? 'iterate' : 'generate'",
)
replace(
    'apps/server/src/routes/generate.ts',
    "    let fullText = ''\n    try {",
    "    let fullText = ''\n    let firstTokenAt: number | null = null\n    try {",
)
replace(
    'apps/server/src/routes/generate.ts',
    "        maxTokens: body.maxTokens,",
    "        maxTokens: body.maxTokens ?? generationProfile.maxTokens,",
)
replace(
    'apps/server/src/routes/generate.ts',
    "        if (ev.type === 'token') {\n          fullText += ev.delta",
    "        if (ev.type === 'token') {\n          if (firstTokenAt === null) firstTokenAt = Date.now()\n          fullText += ev.delta",
)
replace(
    'apps/server/src/routes/generate.ts',
    "          mode,\n          outputChars: fullText.length,",
    "          mode,\n          generationMode: body.mode,\n          firstTokenMs: firstTokenAt === null ? null : firstTokenAt - startedAt,\n          outputChars: fullText.length,",
    count=2,
)
replace(
    'apps/server/src/routes/generate.ts',
    "        parse: parsed\n          ? {",
    "        performance: {\n          firstTokenMs: firstTokenAt === null ? null : firstTokenAt - startedAt,\n          durationMs: Date.now() - startedAt,\n          outputChars: fullText.length,\n          generationMode: body.mode,\n          maxTokens: body.maxTokens ?? generationProfile.maxTokens,\n        },\n        parse: parsed\n          ? {",
)

# Server tests: mode budget, prompt and timing contract.
replace(
    'apps/server/test/generate.test.ts',
    "  requirement: '深色极简的个人主页',\n}",
    "  requirement: '深色极简的个人主页',\n  mode: 'balanced',\n}",
)
replace(
    'apps/server/test/generate.test.ts',
    "    expect(done.parse.entry).toBe('index.html')",
    "    expect(done.parse.entry).toBe('index.html')\n    expect(done.performance.generationMode).toBe('balanced')\n    expect(done.performance.maxTokens).toBe(4600)\n    expect(done.performance.outputChars).toBeGreaterThan(0)\n    expect(typeof done.performance.durationMs).toBe('number')",
)
insert_anchor = "  it('认证失败(401):error 事件,PROVIDER_AUTH', async () => {"
insert_test = r'''  it('精致成品模式使用更高预算并注入质量自检提示', async () => {
    const html = '<!DOCTYPE html><html><head></head><body>quality</body></html>'
    const fetchMock = vi.fn(async () => sseResponse([openaiChunk(````html\n${html}\n````), '[DONE]']))
    vi.stubGlobal('fetch', fetchMock)
    const res = await app.request('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validBody, mode: 'quality' }),
    })
    const events = await readEvents(res)
    expect(events.some((event) => event.event === 'done')).toBe(true)
    const sentBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(sentBody.max_tokens).toBe(7200)
    expect(sentBody.messages[0].content).toContain('当前生成策略：精致成品')
    expect(sentBody.messages[0].content).toContain('静默自检')
  })

'''
# Correct the template literal fence after insertion; using concatenation avoids Python quoting complexity.
insert_test = insert_test.replace("openaiChunk(````html\\n${html}\\n````)", "openaiChunk('```html\\n' + html + '\\n```')")
replace('apps/server/test/generate.test.ts', insert_anchor, insert_test + insert_anchor)
replace(
    'apps/server/test/generate.test.ts',
    "  it('未知站点类型返回 400', async () => {",
    "  it('未知生成策略返回 400', async () => {\n    const res = await app.request('/api/generate', {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ ...validBody, mode: 'ultra' }),\n    })\n    expect(res.status).toBe(400)\n    expect((await res.json()).error.code).toBe('BAD_REQUEST')\n  })\n\n  it('未知站点类型返回 400', async () => {",
)

write('apps/web/src/lib/stream-text-buffer.ts', r'''export interface StreamTextBuffer {
  push(delta: string): void
  flush(): void
  clear(): void
  dispose(): void
}

/** Batch provider token fragments so Vue and iframe preview are not updated for every token. */
export function createStreamTextBuffer(
  onFlush: (text: string, tokenCount: number) => void,
  delayMs = 40,
): StreamTextBuffer {
  let chunks: string[] = []
  let tokenCount = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelTimer() {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function flush() {
    cancelTimer()
    if (!chunks.length) return
    const text = chunks.join('')
    const count = tokenCount
    chunks = []
    tokenCount = 0
    onFlush(text, count)
  }

  function push(delta: string) {
    if (!delta) return
    chunks.push(delta)
    tokenCount += 1
    if (!timer) timer = setTimeout(flush, delayMs)
  }

  function clear() {
    cancelTimer()
    chunks = []
    tokenCount = 0
  }

  return { push, flush, clear, dispose: clear }
}
''')

write('apps/web/test/stream-text-buffer.test.ts', r'''import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStreamTextBuffer } from '../src/lib/stream-text-buffer'

afterEach(() => vi.useRealTimers())

describe('createStreamTextBuffer', () => {
  it('combines many token fragments into one scheduled UI commit', () => {
    vi.useFakeTimers()
    const commits: Array<[string, number]> = []
    const buffer = createStreamTextBuffer((text, count) => commits.push([text, count]), 40)
    buffer.push('a')
    buffer.push('b')
    buffer.push('c')
    expect(commits).toEqual([])
    vi.advanceTimersByTime(40)
    expect(commits).toEqual([['abc', 3]])
  })

  it('flushes immediately before done and clear discards stale fragments', () => {
    vi.useFakeTimers()
    const commits: Array<[string, number]> = []
    const buffer = createStreamTextBuffer((text, count) => commits.push([text, count]))
    buffer.push('first')
    buffer.flush()
    buffer.push('stale')
    buffer.clear()
    vi.runAllTimers()
    expect(commits).toEqual([['first', 1]])
  })
})
''')

write('apps/web/src/composables/useGenerateStream.ts', r'''import { computed, onBeforeUnmount, ref } from 'vue'
import {
  generateSite,
  GenerateHttpError,
  type GeneratePerformance,
  type GenerateRequest,
  type ParseSummary,
} from '../lib/generate'
import { createStreamTextBuffer } from '../lib/stream-text-buffer'

export type GeneratePhase = 'idle' | 'connecting' | 'streaming' | 'parsing' | 'done' | 'error'

export interface GenerateError {
  code: string
  message: string
  action?: 'openModelSettings'
  hint: string
}

const ERROR_HINTS: Record<string, { hint: string; action?: GenerateError['action'] }> = {
  PROVIDER_AUTH: { hint: '请检查模型设置中的 API Key 是否正确或已过期', action: 'openModelSettings' },
  PROVIDER_QUOTA: { hint: '请到对应厂商控制台查看额度并充值后重试' },
  QUOTA_EXCEEDED: { hint: '本月账号额度已用完，可在“额度与用量”中查看重置日期和明细' },
  PROVIDER_RATE_LIMIT: { hint: '请求过于频繁，稍等片刻再试；已生成内容会继续保留' },
  PROVIDER_NETWORK: { hint: '检查网络或 Base URL；可以基于已接收内容继续生成' },
  TIMEOUT: { hint: '生成超时，可保留部分结果继续；复杂需求建议拆分修改' },
  BAD_REQUEST: { hint: '请求参数有误，请调整需求描述后重试' },
  INTERNAL: { hint: '服务器内部错误，当前已接收内容不会丢失' },
}

export const GENERATE_STAGES = ['已连接', '首 token 到达', '流式生成中', '解析产物', '完成'] as const

export function useGenerateStream() {
  const phase = ref<GeneratePhase>('idle')
  const stageIndex = ref(-1)
  const tokenCount = ref(0)
  const text = ref('')
  const retainedPartial = ref('')
  const error = ref<GenerateError | null>(null)
  const parseSummary = ref<ParseSummary | null>(null)
  const performance = ref<GeneratePerformance | null>(null)
  const stopped = ref(false)
  const lastRequest = ref<GenerateRequest | null>(null)

  let controller: AbortController | null = null
  let startedAt = 0
  let firstTokenAt = 0

  const buffer = createStreamTextBuffer((delta, count) => {
    text.value += delta
    tokenCount.value += count
    performance.value = {
      ...(performance.value ?? { outputChars: 0 }),
      firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
      durationMs: startedAt ? Date.now() - startedAt : 0,
      outputChars: text.value.length,
    }
  })

  const charCount = computed(() => text.value.length)
  const isActive = computed(() => phase.value === 'connecting' || phase.value === 'streaming' || phase.value === 'parsing')
  const hasPartialOutput = computed(() => Boolean(text.value.trim() || retainedPartial.value.trim()))
  const canRetry = computed(() => Boolean(lastRequest.value) && !isActive.value)

  function toError(code: string, message: string): GenerateError {
    const meta = ERROR_HINTS[code] ?? ERROR_HINTS.INTERNAL
    return { code, message, hint: meta.hint, action: meta.action }
  }

  async function start(req: GenerateRequest): Promise<void> {
    controller?.abort()
    controller = new AbortController()
    buffer.clear()
    lastRequest.value = structuredClone(req)
    phase.value = 'connecting'
    stageIndex.value = -1
    tokenCount.value = 0
    text.value = ''
    error.value = null
    parseSummary.value = null
    performance.value = null
    stopped.value = false
    startedAt = Date.now()
    firstTokenAt = 0

    try {
      for await (const ev of generateSite(req, { signal: controller.signal })) {
        if (ev.type === 'token') {
          if (!firstTokenAt) firstTokenAt = Date.now()
          if (stageIndex.value < 0) stageIndex.value = 0
          if (stageIndex.value < 2) stageIndex.value = tokenCount.value === 0 ? 1 : 2
          phase.value = 'streaming'
          buffer.push(ev.delta)
        } else if (ev.type === 'done') {
          buffer.flush()
          phase.value = 'parsing'
          stageIndex.value = 3
          parseSummary.value = ev.parse
          performance.value = ev.performance ?? {
            firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
            durationMs: Date.now() - startedAt,
            outputChars: text.value.length,
          }
          retainedPartial.value = ''
          phase.value = 'done'
          stageIndex.value = 4
        } else if (ev.type === 'error') {
          buffer.flush()
          if (text.value.trim()) retainedPartial.value = text.value
          performance.value = {
            ...(performance.value ?? { outputChars: text.value.length }),
            firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
            durationMs: Date.now() - startedAt,
            outputChars: text.value.length,
          }
          error.value = toError(ev.code, ev.message)
          phase.value = 'error'
        }
      }
      if (phase.value === 'streaming' || phase.value === 'connecting') {
        buffer.flush()
        if (text.value.trim()) retainedPartial.value = text.value
        error.value = toError('PROVIDER_NETWORK', '生成过程中连接中断，未收到完成事件')
        phase.value = 'error'
      }
    } catch (err) {
      buffer.flush()
      if (err instanceof DOMException && err.name === 'AbortError') {
        stopped.value = true
        if (text.value.trim()) retainedPartial.value = text.value
        if (phase.value !== 'done') phase.value = text.value ? 'parsing' : 'idle'
        return
      }
      if (text.value.trim()) retainedPartial.value = text.value
      error.value = err instanceof GenerateHttpError
        ? toError(err.code, err.message)
        : toError('PROVIDER_NETWORK', err instanceof Error ? err.message : '网络请求失败')
      phase.value = 'error'
    }
  }

  async function retryLast(): Promise<void> {
    if (!lastRequest.value || isActive.value) return
    await start(structuredClone(lastRequest.value))
  }

  async function resumeFromPartial(instruction = '继续完成上次中断的页面，保留正确内容，补齐缺失部分并输出完整可运行产物'): Promise<void> {
    if (!lastRequest.value || isActive.value) return
    buffer.flush()
    const partial = retainedPartial.value || text.value
    if (!partial.trim()) return retryLast()
    const request = structuredClone(lastRequest.value)
    request.history = [
      ...(request.history ?? []),
      { instruction, artifact: partial, round: (request.history?.length ?? 0) + 1 },
    ]
    await start(request)
  }

  function stop() {
    buffer.flush()
    controller?.abort()
    controller = null
  }

  function reset(options: { keepPartial?: boolean } = {}) {
    controller?.abort()
    controller = null
    buffer.clear()
    if (!options.keepPartial) retainedPartial.value = ''
    phase.value = 'idle'
    stageIndex.value = -1
    tokenCount.value = 0
    text.value = ''
    error.value = null
    parseSummary.value = null
    performance.value = null
    stopped.value = false
  }

  onBeforeUnmount(() => {
    stop()
    buffer.dispose()
  })

  return {
    phase, stageIndex, tokenCount, charCount, text, retainedPartial, error, parseSummary,
    performance, stopped, lastRequest, isActive, hasPartialOutput, canRetry,
    start, retryLast, resumeFromPartial, stop, reset,
  }
}
''')

write('apps/web/src/lib/generate.ts', r'''import type { GenerationMode } from 'shared'
import { apiUrl } from './api'

export interface GenerateRequest {
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  siteType: string
  requirement: string
  history?: { instruction: string; artifact?: string; round?: number }[]
  mode?: GenerationMode
  maxTokens?: number
}

export interface ParseSummary {
  ok: boolean
  fileCount: number
  entry?: string
  warnings: string[]
}

export interface GeneratePerformance {
  firstTokenMs?: number | null
  durationMs: number
  outputChars: number
  generationMode?: GenerationMode
  maxTokens?: number
}

export type GenerateEvent =
  | { type: 'token'; delta: string }
  | { type: 'done'; parse: ParseSummary; performance?: GeneratePerformance }
  | { type: 'error'; code: string; message: string }

export class GenerateHttpError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'GenerateHttpError'
    this.status = status
    this.code = code
  }
}

export async function* readSseEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: string }, void, unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let sep: number
      while ((sep = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep).replace(/^(\r?\n){2}/, '')
        let event: string | undefined
        const dataLines: string[] = []
        for (const line of rawEvent.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).replace(/^ /, '')
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
        }
        if (event && dataLines.length > 0) yield { event, data: dataLines.join('\n') }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* generateSite(
  req: GenerateRequest,
  options: { signal?: AbortSignal; endpoint?: string } = {},
): AsyncGenerator<GenerateEvent, void, unknown> {
  const accessToken = typeof localStorage === 'undefined' ? null : localStorage.getItem('siteforge:access-token')
  const res = await fetch(options.endpoint ?? apiUrl('/api/generate'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(req),
    signal: options.signal ?? null,
  })
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    let message = `请求失败(HTTP ${res.status})`
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } }
      if (json.error?.code) code = json.error.code
      if (json.error?.message) message = json.error.message
    } catch {
      // Non-JSON error body.
    }
    throw new GenerateHttpError(res.status, code, message)
  }
  if (!res.body) throw new GenerateHttpError(res.status, 'INTERNAL', '响应没有内容流')

  for await (const ev of readSseEventStream(res.body)) {
    if (ev.event === 'token') {
      try {
        const parsed = JSON.parse(ev.data) as { delta?: string }
        if (parsed.delta) yield { type: 'token', delta: parsed.delta }
      } catch {
        // Skip malformed token events without terminating the stream.
      }
    } else if (ev.event === 'done') {
      try {
        const parsed = JSON.parse(ev.data) as { parse?: ParseSummary; performance?: GeneratePerformance }
        yield {
          type: 'done',
          parse: parsed.parse ?? { ok: false, fileCount: 0, warnings: ['done 事件缺少解析摘要'] },
          performance: parsed.performance,
        }
      } catch {
        yield { type: 'done', parse: { ok: false, fileCount: 0, warnings: ['done 事件解析失败'] } }
      }
    } else if (ev.event === 'error') {
      let code = 'INTERNAL'
      let message = '生成失败'
      try {
        const parsed = JSON.parse(ev.data) as { code?: string; message?: string }
        if (parsed.code) code = parsed.code
        if (parsed.message) message = parsed.message
      } catch {
        // Use defaults.
      }
      yield { type: 'error', code, message }
    }
  }
}

export function extractPartialHtml(text: string): string | null {
  const start = text.search(/<!doctype html|<html[\s>]/i)
  if (start < 0) return null
  let html = text.slice(start)
  html = html.replace(/\n?```[\s\S]*$/, '')
  return html
}
''')

# Update client test for done performance parsing.
replace(
    'apps/web/test/generate.test.ts',
    "{ event: 'done', data: '{\"parse\":{\"ok\":true,\"fileCount\":1,\"entry\":\"index.html\",\"warnings\":[]}}' },",
    "{ event: 'done', data: '{\"parse\":{\"ok\":true,\"fileCount\":1,\"entry\":\"index.html\",\"warnings\":[]},\"performance\":{\"firstTokenMs\":120,\"durationMs\":950,\"outputChars\":88,\"generationMode\":\"balanced\",\"maxTokens\":4600}}' },",
)
replace(
    'apps/web/test/generate.test.ts',
    "    expect(events[2]).toMatchObject({ type: 'done', parse: { ok: true, fileCount: 1 } })",
    "    expect(events[2]).toMatchObject({\n      type: 'done',\n      parse: { ok: true, fileCount: 1 },\n      performance: { firstTokenMs: 120, durationMs: 950, generationMode: 'balanced' },\n    })",
)

# Generator component: strategy UI, direct parent events and strategy-aware requests.
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "import { parseModelOutput, artifactToSingleHtml, type ArtifactMeta } from 'shared'",
    "import {\n  DEFAULT_GENERATION_MODE,\n  GENERATION_MODES,\n  artifactToSingleHtml,\n  getGenerationModeProfile,\n  parseModelOutput,\n  type ArtifactMeta,\n  type GenerationMode,\n} from 'shared'",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "const emit = defineEmits<{ (e: 'update:prompt', v: string): void }>()",
    "const emit = defineEmits<{\n  (e: 'update:prompt', v: string): void\n  (e: 'artifact', html: string): void\n  (e: 'site-type', value: string): void\n  (e: 'recovery', visible: boolean): void\n  (e: 'edit-artifact'): void\n}>()",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "const previewWidth = ref<'desktop' | 'mobile'>('desktop')",
    "const previewWidth = ref<'desktop' | 'mobile'>('desktop')\nconst GENERATION_MODE_STORAGE_KEY = 'siteforge:generation-mode-v1'\nconst savedGenerationMode = localStorage.getItem(GENERATION_MODE_STORAGE_KEY)\nconst generationMode = ref<GenerationMode>(\n  GENERATION_MODES.some((item) => item.id === savedGenerationMode)\n    ? savedGenerationMode as GenerationMode\n    : DEFAULT_GENERATION_MODE,\n)\nconst generationModeProfile = computed(() => getGenerationModeProfile(generationMode.value))\nwatch(generationMode, (value) => localStorage.setItem(GENERATION_MODE_STORAGE_KEY, value))",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "const logText = computed(() => {\n  if (isDemo.value) return null\n  const t = stream.text.value\n  return t.length > 2000 ? `……${t.slice(-2000)}` : t\n})",
    "const logText = computed(() => {\n  if (isDemo.value) return null\n  const t = stream.text.value\n  return t.length > 2000 ? `……${t.slice(-2000)}` : t\n})\n\nfunction formatDuration(value?: number | null): string {\n  if (value === undefined || value === null) return ''\n  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`\n}\n\nconst performanceSummary = computed(() => {\n  const value = stream.performance.value\n  if (!value) return ''\n  const parts = [\n    value.firstTokenMs === undefined || value.firstTokenMs === null ? '' : `首 token ${formatDuration(value.firstTokenMs)}`,\n    value.durationMs ? `总耗时 ${formatDuration(value.durationMs)}` : '',\n    value.outputChars ? `${(value.outputChars / 1024).toFixed(1)} KB` : '',\n  ]\n  return parts.filter(Boolean).join(' · ')\n})",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "const parseFailed = computed(\n  () =>\n    !isDemo.value &&\n    (stream.phase.value === 'done' || stream.stopped.value) &&\n    stream.text.value.length > 0 &&\n    !finalHtml.value &&\n    session.value.rounds.length === 0,\n)",
    "const parseFailed = computed(\n  () =>\n    !isDemo.value &&\n    (stream.phase.value === 'done' || stream.stopped.value) &&\n    stream.text.value.length > 0 &&\n    !finalHtml.value &&\n    session.value.rounds.length === 0,\n)\n\nwatch(previewHtml, (html) => emit('artifact', html ?? ''), { immediate: true })\nwatch(typeId, (value) => emit('site-type', value), { immediate: true })\nwatch([phase, stream.canRetry], () => {\n  emit('recovery', phase.value === 'error' && stream.canRetry.value)\n}, { immediate: true })",
)
# All generation calls receive mode and mode budget.
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "    siteType: SITE_TYPE_MAP[typeId.value] ?? typeId.value,\n    requirement: props.prompt.trim(),",
    "    siteType: SITE_TYPE_MAP[typeId.value] ?? typeId.value,\n    mode: generationMode.value,\n    maxTokens: generationModeProfile.value.maxTokens,\n    requirement: props.prompt.trim(),",
    count=3,
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "function regenerate() {\n  stream.reset()\n  start()\n}",
    "function regenerate() {\n  stream.reset()\n  start()\n}\n\nfunction retryGeneration() {\n  if (stream.canRetry.value) void stream.retryLast()\n  else regenerate()\n}\n\ndefineExpose({ retryGeneration })",
)
# Strategy selector below site type.
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "            </AppSelect>\n\n            <div class=\"mt-6 flex gap-2\">",
    "            </AppSelect>\n\n            <label class=\"mt-5 mb-2 block text-sm font-medium text-sub\">生成策略</label>\n            <div class=\"grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3\">\n              <button\n                v-for=\"item in GENERATION_MODES\"\n                :key=\"item.id\"\n                type=\"button\"\n                class=\"rounded-xl border px-3 py-3 text-left transition\"\n                :class=\"generationMode === item.id ? 'border-brand1/35 bg-brand1/[0.08] ring-2 ring-brand1/8' : 'border-line/10 bg-app/45 hover:border-brand1/20'\"\n                @click=\"generationMode = item.id\"\n              >\n                <span class=\"block text-xs font-semibold\" :class=\"generationMode === item.id ? 'text-brand1' : 'text-ink'\">{{ item.label }}</span>\n                <span class=\"mt-1 block text-[9px] leading-4 text-faint\">{{ item.description }}</span>\n              </button>\n            </div>\n            <p class=\"mt-2 text-[10px] leading-5 text-faint\">\n              {{ generationModeProfile.sectionGuidance }} · {{ generationModeProfile.outputTarget }} · 最大 {{ generationModeProfile.maxTokens }} tokens\n            </p>\n\n            <div class=\"mt-6 flex gap-2\">",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "                  <p v-if=\"!isDemo && stream.tokenCount.value > 0\" class=\"mt-2 text-[10px] text-faint\">\n                    已接收 {{ stream.tokenCount.value }} tokens / {{ stream.charCount.value }} 字符\n                  </p>",
    "                  <p v-if=\"!isDemo && stream.tokenCount.value > 0\" class=\"mt-2 text-[10px] leading-5 text-faint\">\n                    已接收 {{ stream.tokenCount.value }} 分片 / {{ stream.charCount.value }} 字符<br>\n                    {{ generationModeProfile.label }}<template v-if=\"stream.performance.value?.firstTokenMs != null\"> · 首 token {{ formatDuration(stream.performance.value.firstTokenMs) }}</template>\n                  </p>",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "                  <div class=\"flex flex-wrap gap-2\">",
    "                  <span v-if=\"!isDemo && performanceSummary\" class=\"text-[10px] text-faint\">{{ performanceSummary }}</span>\n                  <div class=\"flex flex-wrap gap-2\">",
)
replace(
    'apps/web/src/components/GeneratorDemo.vue',
    "@click=\"toast.info('编辑器即将上线', '在线编辑器属于 V1 计划(SF-2-4),当前可通过工具条复制或导出 HTML。')\"",
    "@click=\"emit('edit-artifact')\"",
)

write('apps/web/src/pages/GeneratorPage.vue', r'''<script setup lang="ts">
import { ref, watch } from 'vue'
import { AlertTriangle, PencilRuler, RotateCcw } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import GenerationBrief from '../components/GenerationBrief.vue'
import GeneratorDemo from '../components/GeneratorDemo.vue'
import GeneratorArtifactBar from '../components/GeneratorArtifactBar.vue'
import { SITE_TYPES } from '../data/siteTypes'

const route = useRoute()
const generatorRef = ref<{ retryGeneration: () => void }>()
const artifactBarRef = ref<{ openEditor: () => void }>()
const artifactHtml = ref('')
const siteType = ref('website')
const recoveryVisible = ref(false)
const prompt = ref(
  typeof route.query.q === 'string' && route.query.q
    ? route.query.q
    : SITE_TYPES.find((type) => type.id === 'dashboard')!.example,
)

function retryGeneration() {
  generatorRef.value?.retryGeneration()
}

function editRetainedArtifact() {
  artifactBarRef.value?.openEditor()
}

function applyEditedHtml(html: string) {
  artifactHtml.value = html
}

watch(() => route.query.q, (value) => {
  if (typeof value === 'string' && value) prompt.value = value
})
</script>

<template>
  <main class="pt-8">
    <GenerationBrief :prompt="prompt" @update:prompt="prompt = $event" />
    <div v-if="recoveryVisible" class="mx-auto mt-5 flex max-w-7xl flex-col gap-3 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
      <div class="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.055] p-4">
        <AlertTriangle class="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div><p class="text-xs font-semibold text-ink">生成没有完整结束，但已有内容不会丢失</p><p class="mt-1 text-[11px] leading-5 text-mut">可原样重试；已有页面内容时，也可以先进入编辑器继续完善，避免重新开始。</p></div>
      </div>
      <div class="flex shrink-0 gap-2">
        <button class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line/10 bg-soft/60 px-4 py-3 text-xs font-semibold text-sub lg:flex-none" @click="retryGeneration"><RotateCcw class="h-3.5 w-3.5" />重试生成</button>
        <button v-if="artifactHtml" class="bg-brand-gradient flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-xs font-semibold text-white lg:flex-none" @click="editRetainedArtifact"><PencilRuler class="h-3.5 w-3.5" />编辑已保留页面</button>
      </div>
    </div>
    <GeneratorDemo
      ref="generatorRef"
      v-model:prompt="prompt"
      @artifact="artifactHtml = $event"
      @site-type="siteType = $event"
      @recovery="recoveryVisible = $event"
      @edit-artifact="editRetainedArtifact"
    />
    <GeneratorArtifactBar ref="artifactBarRef" :html="artifactHtml" :prompt="prompt" :site-type="siteType" @update:html="applyEditedHtml" />
  </main>
</template>
''')

write('docs/GENERATION_QUALITY.md', r'''# 生成质量与速度策略

生成器提供三种策略，策略会同时影响 Prompt 质量约束、模型输出预算和界面展示：

| 策略 | 适用场景 | 模型预算 | 目标 |
| --- | --- | ---: | --- |
| 极速草稿 | 快速验证方向、准备继续编辑 | 2800 tokens | 4–6 个关键区块，优先完整与快速 |
| 平衡生成 | 默认的大多数网站 | 4600 tokens | 6–8 个完整区块，平衡内容、视觉和速度 |
| 精致成品 | 需要高完成度的对外页面 | 7200 tokens | 7–10 个高完成度区块，并执行无障碍与性能自检 |

## 质量约束

精致成品模式会明确要求模型在输出前静默检查：

- HTML、代码围栏和标签是否完整闭合
- 移动端横向溢出、触控尺寸与焦点样式
- 颜色对比、替代文本、无名称按钮和重复 ID
- 占位文案、失效链接和空泛 CTA
- 首屏阻塞、重量级依赖、图片尺寸和布局偏移

## 生成端性能

前端不再对每个 token 分片立即触发响应式渲染，而是把短时间内的分片合并后刷新日志和 iframe。这样可以显著减少长页面生成时的 HTML 提取、Vue 更新和 iframe `srcdoc` 重载次数。

生成页与产物工具栏通过组件事件直接同步，不再每 500ms 扫描 DOM。完成事件包含首 token、总耗时、输出字符数、策略和模型预算，便于后续建立真实模型性能趋势。
''')

replace(
    'README.md',
    "- 生成耗时、模型、站点类型、输出长度、解析结果与错误分类可观测事件",
    "- 极速草稿、平衡生成、精致成品三档策略，可配置质量约束与输出预算\n- token 分片批量刷新，降低流式预览期间的主线程与 iframe 更新成本\n- 生成耗时、首 token、模型、站点类型、输出长度、解析结果与错误分类可观测事件",
)

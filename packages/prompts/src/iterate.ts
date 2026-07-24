import {
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
      `- 完整性高于一切：按${generation.label}控制复杂度，完整闭合优先于装饰数量`,
    ].join('\n'),
  ].join('\n\n')

  return { system: buildSystemPrompt(mode), user }
}

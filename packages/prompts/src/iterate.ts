import { getProfile } from './profiles'
import { SYSTEM_PROMPT } from './system'

export interface BuildIterationInput {
  /** 站点类型 id */
  siteType: string
  /** 当前产物(单 HTML) */
  currentArtifact: string
  /** 本轮修改指令 */
  instruction: string
  /** 迭代轮次(从 2 起;1 为初次生成) */
  round: number
}

export interface BuiltIterationPrompt {
  system: string
  user: string
}

/**
 * 迭代提示词(SF-1-6):全量产物 + 修改要求 → 输出完整新产物。
 * 输出协议与初次生成完全一致(文件清单 + path 标注 fenced code),
 * 下游 parseModelOutput 无需任何分支。
 */
export function buildIterationPrompt(input: BuildIterationInput): BuiltIterationPrompt {
  const profile = getProfile(input.siteType)
  const typeLabel = profile ? `${profile.name}(${profile.id})` : input.siteType

  const user = [
    `【站点类型】${typeLabel}`,
    `【当前产物(第 ${input.round - 1} 轮)】以下是上一轮生成的完整单 HTML 产物:\n\`\`\`html\n${input.currentArtifact}\n\`\`\``,
    `【修改指令(第 ${input.round} 轮)】\n${input.instruction}`,
    [
      '【迭代要求】',
      '- 严格按照【修改指令】修改,未提及的部分必须与当前产物保持一致,不要自由发挥',
      '- 输出的是**完整的新产物**,不是 diff、不是片段、不是修改说明',
      '- 输出协议不变:先文件清单 JSON 块,再带 path 标注的 fenced code 块',
      '- 完整性高于一切:控制在 2500 tokens 以内,宁可简化未提及的部分也要保证代码完整闭合',
    ].join('\n'),
  ].join('\n\n')

  return { system: SYSTEM_PROMPT, user }
}

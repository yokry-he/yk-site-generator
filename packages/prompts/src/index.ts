import {
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

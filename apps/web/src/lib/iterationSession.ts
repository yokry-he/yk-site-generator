/** 迭代会话状态(SF-1-6):纯函数,便于单测;组件只负责渲染与调用 */

export interface IterationRound {
  /** 轮次,从 1 起(1 = 初次生成) */
  round: number
  /** 本轮指令(第 1 轮为初始需求) */
  instruction: string
  /** 本轮产物(单 HTML) */
  html: string
  /** ISO 时间 */
  time: string
  /** 使用的模型(如 deepseek-chat) */
  model: string
  /** 服务端解析摘要(可选) */
  fileCount?: number
  /** 是否为中途停止后保留的部分产物 */
  stopped?: boolean
}

export interface IterationSession {
  rounds: IterationRound[]
  /** 正在查看的轮(索引) */
  viewing: number
  /** 作为下一轮迭代基底的轮(索引) */
  current: number
}

export function createSession(): IterationSession {
  return { rounds: [], viewing: -1, current: -1 }
}

/** 追加一轮产物,并把查看/基底都切到最新轮 */
export function addRound(s: IterationSession, r: Omit<IterationRound, 'round'>): IterationSession {
  const round: IterationRound = { ...r, round: s.rounds.length + 1 }
  const rounds = [...s.rounds, round]
  return { rounds, viewing: rounds.length - 1, current: rounds.length - 1 }
}

export function viewingRound(s: IterationSession): IterationRound | null {
  return s.viewing >= 0 && s.viewing < s.rounds.length ? s.rounds[s.viewing] : null
}

/** 下一轮迭代所用的基底产物 */
export function currentRound(s: IterationSession): IterationRound | null {
  return s.current >= 0 && s.current < s.rounds.length ? s.rounds[s.current] : null
}

export function nextRoundNumber(s: IterationSession): number {
  return s.rounds.length + 1
}

export function canViewPrev(s: IterationSession): boolean {
  return s.viewing > 0
}

export function canViewNext(s: IterationSession): boolean {
  return s.viewing >= 0 && s.viewing < s.rounds.length - 1
}

export function viewPrev(s: IterationSession): IterationSession {
  return canViewPrev(s) ? { ...s, viewing: s.viewing - 1 } : s
}

export function viewNext(s: IterationSession): IterationSession {
  return canViewNext(s) ? { ...s, viewing: s.viewing + 1 } : s
}

/** 「回到此轮」:把正在查看的轮设为迭代基底 */
export function backToRound(s: IterationSession): IterationSession {
  return s.viewing >= 0 ? { ...s, current: s.viewing } : s
}

/** 查看轮是否就是迭代基底轮 */
export function isViewingCurrent(s: IterationSession): boolean {
  return s.viewing === s.current
}

/** 产物过大警告阈值(字符):粗估 token ≈ 字符/2,接近 maxTokens 时提醒 */
export const LARGE_ARTIFACT_CHARS = 6000

export function isLargeArtifact(html: string): boolean {
  return html.length > LARGE_ARTIFACT_CHARS
}

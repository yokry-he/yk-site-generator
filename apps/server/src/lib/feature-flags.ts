import { createHash } from 'node:crypto'
import type { AppData, FeatureFlagRecord, UserRole } from './data-store'

export interface FeatureFlagDefinition {
  key: string
  name: string
  description: string
  defaultEnabled: boolean
  category: 'experience' | 'creation' | 'publishing' | 'operations'
}

export const FEATURE_FLAG_DEFINITIONS: FeatureFlagDefinition[] = [
  {
    key: 'official-templates',
    name: '官方模板中心',
    description: '控制模板目录、模板预览和模板创建项目能力。',
    defaultEnabled: true,
    category: 'creation',
  },
  {
    key: 'brand-kits',
    name: '品牌套件',
    description: '控制品牌套件工作台和项目应用品牌能力。',
    defaultEnabled: true,
    category: 'creation',
  },
  {
    key: 'visual-editor',
    name: '可视化编辑器',
    description: '控制项目版本的可视化编辑入口。',
    defaultEnabled: true,
    category: 'creation',
  },
  {
    key: 'onboarding-guide',
    name: '新手引导',
    description: '控制首次登录引导和启动清单。',
    defaultEnabled: true,
    category: 'experience',
  },
  {
    key: 'quality-feedback',
    name: '质量反馈',
    description: '控制项目版本满意度反馈与问题分类。',
    defaultEnabled: true,
    category: 'operations',
  },
  {
    key: 'site-publishing',
    name: '一键发布',
    description: '控制发布、重新发布和恢复上线能力。',
    defaultEnabled: true,
    category: 'publishing',
  },
]

export interface FeatureContext {
  userId?: string
  email?: string
  role?: UserRole
  anonymousId?: string
  now?: number
}

export interface ResolvedFeatureFlag extends FeatureFlagDefinition {
  enabled: boolean
  rolloutPercent: number
  rules: FeatureFlagRecord['rules']
  startsAt?: string
  expiresAt?: string
  version: number
  updatedAt?: string
  updatedBy?: string
}

function stableBucket(seed: string): number {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 8)
  return Number.parseInt(hex, 16) % 100
}

export function resolveFeatureFlags(data: AppData): ResolvedFeatureFlag[] {
  return FEATURE_FLAG_DEFINITIONS.map((definition) => {
    const record = data.featureFlags.find((item) => item.key === definition.key)
    return {
      ...definition,
      enabled: record?.enabled ?? definition.defaultEnabled,
      rolloutPercent: record?.rolloutPercent ?? 100,
      rules: record?.rules ?? {},
      startsAt: record?.startsAt,
      expiresAt: record?.expiresAt,
      version: record?.version ?? 0,
      updatedAt: record?.updatedAt,
      updatedBy: record?.updatedBy,
      description: record?.description || definition.description,
    }
  })
}

export function evaluateFeatureFlag(data: AppData, key: string, context: FeatureContext = {}): boolean {
  const flag = resolveFeatureFlags(data).find((item) => item.key === key)
  if (!flag || !flag.enabled) return false

  const now = context.now ?? Date.now()
  if (flag.startsAt && Date.parse(flag.startsAt) > now) return false
  if (flag.expiresAt && Date.parse(flag.expiresAt) <= now) return false

  const rules = flag.rules ?? {}
  if (context.userId && rules.userIds?.includes(context.userId)) return true
  if (context.email && rules.emails?.map((item) => item.toLowerCase()).includes(context.email.toLowerCase())) return true
  if (context.role && rules.roles?.includes(context.role)) return true

  if (flag.rolloutPercent >= 100) return true
  if (flag.rolloutPercent <= 0) return false
  const identity = context.userId || context.email || context.anonymousId
  if (!identity) return false
  return stableBucket(`${flag.key}:${identity}`) < flag.rolloutPercent
}

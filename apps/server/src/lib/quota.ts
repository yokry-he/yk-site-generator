import { randomUUID } from 'node:crypto'
import { env } from '../env'
import { mutateData, readData, type UsageRecord } from './data-store'

export class QuotaExceededError extends Error {
  readonly limit: number
  readonly used: number

  constructor(limit: number, used: number) {
    super('MONTHLY_QUOTA_EXCEEDED')
    this.name = 'QuotaExceededError'
    this.limit = limit
    this.used = used
  }
}

function monthRange(now = new Date()): { start: number; end: number; key: string } {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return {
    start,
    end,
    key: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
  }
}

function monthlyUsage(rows: UsageRecord[], userId: string, now = new Date()): number {
  const range = monthRange(now)
  return rows
    .filter(
      (item) =>
        item.userId === userId &&
        (item.action === 'generate' || item.action === 'iterate') &&
        Date.parse(item.createdAt) >= range.start &&
        Date.parse(item.createdAt) < range.end,
    )
    .reduce((sum, item) => sum + item.units, 0)
}

export async function reserveGenerationUsage(input: {
  userId: string
  action: 'generate' | 'iterate'
  siteType?: string
  model?: string
  now?: Date
}): Promise<UsageRecord> {
  const now = input.now ?? new Date()
  return mutateData((data) => {
    const used = monthlyUsage(data.usage, input.userId, now)
    if (used >= env.MONTHLY_GENERATION_LIMIT) {
      throw new QuotaExceededError(env.MONTHLY_GENERATION_LIMIT, used)
    }
    const row: UsageRecord = {
      id: randomUUID(),
      userId: input.userId,
      action: input.action,
      units: 1,
      siteType: input.siteType,
      model: input.model,
      createdAt: now.toISOString(),
    }
    data.usage.push(row)
    return structuredClone(row)
  })
}

export async function recordPublishUsage(input: {
  userId: string
  siteType?: string
  now?: Date
}): Promise<UsageRecord> {
  const row: UsageRecord = {
    id: randomUUID(),
    userId: input.userId,
    action: 'publish',
    units: 1,
    siteType: input.siteType,
    createdAt: (input.now ?? new Date()).toISOString(),
  }
  await mutateData((data) => data.usage.push(row))
  return row
}

export async function refundUsage(id: string, userId: string): Promise<void> {
  await mutateData((data) => {
    data.usage = data.usage.filter((item) => item.id !== id || item.userId !== userId)
  })
}

export async function getQuotaSummary(userId: string, now = new Date()) {
  const data = await readData()
  const range = monthRange(now)
  const used = monthlyUsage(data.usage, userId, now)
  const byAction = data.usage
    .filter(
      (item) => item.userId === userId && Date.parse(item.createdAt) >= range.start && Date.parse(item.createdAt) < range.end,
    )
    .reduce<Record<string, number>>((result, item) => {
      result[item.action] = (result[item.action] ?? 0) + item.units
      return result
    }, {})
  return {
    period: range.key,
    limit: env.MONTHLY_GENERATION_LIMIT,
    used,
    remaining: Math.max(0, env.MONTHLY_GENERATION_LIMIT - used),
    byAction,
    resetsAt: new Date(range.end).toISOString(),
  }
}

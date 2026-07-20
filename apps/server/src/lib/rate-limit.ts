/** 内存令牌桶限流:按 IP 计,默认 10 req/min(RATE_LIMIT_PER_MIN 可配) */

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

function limitPerMin(): number {
  const n = Number(process.env.RATE_LIMIT_PER_MIN ?? 10)
  return Number.isFinite(n) && n > 0 ? n : 10
}

/** 尝试取走一个令牌;返回 true 表示放行 */
export function takeToken(ip: string): boolean {
  const limit = limitPerMin()
  const now = Date.now()
  let b = buckets.get(ip)
  if (!b) {
    b = { tokens: limit, lastRefill: now }
    buckets.set(ip, b)
  }
  // 按速率补充令牌
  const refill = ((now - b.lastRefill) / 60_000) * limit
  if (refill > 0) {
    b.tokens = Math.min(limit, b.tokens + refill)
    b.lastRefill = now
  }
  if (b.tokens < 1) return false
  b.tokens -= 1
  return true
}

/** 测试辅助:清空所有桶 */
export function resetRateLimit(): void {
  buckets.clear()
}

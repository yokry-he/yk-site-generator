/** 运行时数字配置:每次调用读取 process.env,便于测试注入 */

export function connectTimeoutMs(): number {
  const n = Number(process.env.PROVIDER_CONNECT_TIMEOUT_MS ?? 10_000)
  return Number.isFinite(n) && n > 0 ? n : 10_000
}

export function totalTimeoutMs(): number {
  const n = Number(process.env.PROVIDER_TOTAL_TIMEOUT_MS ?? 120_000)
  return Number.isFinite(n) && n > 0 ? n : 120_000
}

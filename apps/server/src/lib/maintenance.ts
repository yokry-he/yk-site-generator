import { cleanupExpiredShares } from './share-store'
import { mutateData } from './data-store'

export interface MaintenanceResult {
  shares: number
  verificationCodes: number
  sessions: number
}

/** 清理过期临时数据;已撤销会话保留 30 天便于安全审计后再删除。 */
export async function runMaintenance(now = Date.now()): Promise<MaintenanceResult> {
  const shares = await cleanupExpiredShares(now)
  const cleaned = await mutateData((data) => {
    const codeCount = data.verificationCodes.length
    const sessionCount = data.sessions.length
    data.verificationCodes = data.verificationCodes.filter((item) => Date.parse(item.expiresAt) > now)
    data.sessions = data.sessions.filter((item) => {
      if (Date.parse(item.expiresAt) <= now) return false
      if (item.revokedAt && Date.parse(item.revokedAt) <= now - 30 * 86_400_000) return false
      return true
    })
    return {
      verificationCodes: codeCount - data.verificationCodes.length,
      sessions: sessionCount - data.sessions.length,
    }
  })
  return { shares, ...cleaned }
}

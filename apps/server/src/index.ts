import { serve } from '@hono/node-server'
import { createApp } from './app'
import { env } from './env'
import { runMaintenance } from './lib/maintenance'

const app = createApp()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[server] yk-site-generator 已启动: http://localhost:${info.port} (env: ${env.NODE_ENV})`)
})

// 启动时立即清理一次,之后每 6 小时执行;unref 避免阻止进程退出。
void runMaintenance().then((result) => {
  if (result.shares + result.verificationCodes + result.sessions > 0) {
    console.log('[maintenance] 已清理过期数据:', result)
  }
}).catch((err) => console.error('[maintenance] 启动清理失败:', err))

const maintenanceTimer = setInterval(() => {
  void runMaintenance().catch((err) => console.error('[maintenance] 周期清理失败:', err))
}, 6 * 60 * 60 * 1000)
maintenanceTimer.unref()

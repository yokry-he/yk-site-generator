import { serve } from '@hono/node-server'
import { createApp } from './app'
import { env } from './env'
import { closeDataStore, initializeDataStore } from './lib/data-store'
import { runMaintenance } from './lib/maintenance'

await initializeDataStore()

const app = createApp()
const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    `[server] yk-site-generator 已启动: http://localhost:${info.port} (env: ${env.NODE_ENV}, data: ${env.DATA_STORAGE_DRIVER})`,
  )
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

let shuttingDown = false
async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[server] 收到 ${signal},开始优雅关闭`)
  clearInterval(maintenanceTimer)
  server.close(async () => {
    try {
      await closeDataStore()
      process.exit(0)
    } catch (error) {
      console.error('[server] 数据连接关闭失败:', error)
      process.exit(1)
    }
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))

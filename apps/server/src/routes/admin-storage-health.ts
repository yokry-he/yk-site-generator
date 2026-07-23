import { Hono } from 'hono'
import { env } from '../env'
import { adminMiddleware, type AuthEnv } from '../lib/auth'
import { getDataStoreHealth } from '../lib/data-store'

const adminStorageHealth = new Hono<AuthEnv>()
adminStorageHealth.use('*', adminMiddleware)

adminStorageHealth.get('/', async (c) => {
  const dataStore = await getDataStoreHealth()
  const storageStatus = dataStore.status === 'operational' ? 'operational' : 'degraded'
  return c.json({
    health: {
      status: storageStatus,
      checkedAt: new Date().toISOString(),
      components: [
        { id: 'api', name: 'API 服务', status: 'operational', detail: 'Hono 服务正常响应' },
        {
          id: 'data',
          name: '业务数据存储',
          status: storageStatus,
          detail: `${dataStore.driver.toUpperCase()} · Schema v${dataStore.schemaVersion}${dataStore.revision !== undefined ? ` · revision ${dataStore.revision}` : ''}${dataStore.latencyMs !== undefined ? ` · ${dataStore.latencyMs}ms` : ''}`,
        },
        {
          id: 'email',
          name: '邮件服务',
          status: env.EMAIL_WEBHOOK_URL ? 'operational' : 'not_configured',
          detail: env.EMAIL_WEBHOOK_URL ? 'Webhook 已配置' : '尚未配置生产邮件 Webhook',
        },
        {
          id: 'object-storage',
          name: '对象存储',
          status: env.s3Enabled ? 'operational' : 'fallback',
          detail: env.s3Enabled ? 'S3 兼容存储已启用' : '当前使用本地发布目录',
        },
        {
          id: 'mysql',
          name: 'MySQL',
          status: dataStore.driver === 'mysql' ? storageStatus : 'not_configured',
          detail: dataStore.driver === 'mysql'
            ? `${dataStore.message}${dataStore.updatedAt ? ` · 更新于 ${dataStore.updatedAt}` : ''}`
            : '事务适配器已就绪，当前运行环境仍使用文件驱动',
        },
      ],
    },
  })
})

export default adminStorageHealth

import { z } from 'zod'

const DEV_JWT_SECRET = 'siteforge-development-secret-change-before-production-2026'

/** 环境变量 schema:启动时校验,非法即拒绝启动 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 允许的前端来源,逗号分隔 */
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
  /** 临时分享文件目录;生产环境应挂载持久卷 */
  SHARE_STORAGE_DIR: z.string().min(1).default('.data/shares'),
  /** 临时分享有效期,MVP 固定默认 7 天 */
  SHARE_TTL_DAYS: z.coerce.number().int().min(1).max(7).default(7),
  /** 单个分享产物字节上限 */
  MAX_SHARE_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  /** 对外可访问的服务根地址;为空时前端使用当前 origin */
  PUBLIC_BASE_URL: z.string().url().or(z.literal('')).default(''),
  /** V1 账号、项目、额度和发布元数据文件;生产环境应替换为共享数据库适配器 */
  DATA_STORAGE_FILE: z.string().min(1).default('.data/siteforge.json'),
  AUTH_JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().min(5).max(120).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  VERIFICATION_CODE_TTL_MIN: z.coerce.number().int().min(3).max(30).default(10),
  EMAIL_WEBHOOK_URL: z.string().url().or(z.literal('')).default(''),
  EMAIL_WEBHOOK_TOKEN: z.string().default(''),
  MONTHLY_GENERATION_LIMIT: z.coerce.number().int().positive().default(100),
  MAX_PROJECT_BYTES: z.coerce.number().int().positive().default(2 * 1024 * 1024),
  PUBLISH_STORAGE_DIR: z.string().min(1).default('.data/published'),
  PUBLISH_BASE_DOMAIN: z.string().min(1).default('siteforge.local'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[env] 环境变量校验失败:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.AUTH_JWT_SECRET === DEV_JWT_SECRET) {
  console.error('[env] 生产环境必须配置独立的 AUTH_JWT_SECRET(至少 32 字符)')
  process.exit(1)
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
}

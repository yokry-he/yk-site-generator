import { z } from 'zod'

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
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[env] 环境变量校验失败:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
}

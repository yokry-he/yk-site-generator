import { z } from 'zod'

/** 环境变量 schema:启动时校验,非法即拒绝启动 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** 允许的前端来源,逗号分隔 */
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
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

import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'

const app = createApp()

describe('GET /api/health', () => {
  it('返回服务健康信息', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.service).toBe('yk-site-generator')
    expect(typeof body.time).toBe('string')
  })
})

describe('统一错误格式', () => {
  it('未知路径返回 404 与 { error: { code, message } }', async () => {
    const res = await app.request('/api/no-such-route')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(typeof body.error.message).toBe('string')
  })
})

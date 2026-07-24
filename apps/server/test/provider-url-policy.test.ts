import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import {
  isPrivateOrReservedProviderHost,
  validateProviderBaseUrl,
  validateProviderBaseUrlForRequest,
} from '../src/lib/provider-url-policy'

const app = createApp()

function jsonHeaders(ip: string) {
  return { 'content-type': 'application/json', 'x-forwarded-for': ip }
}

describe('自定义模型 Base URL 安全策略', () => {
  it.each([
    'localhost',
    'api.localhost',
    'metadata.google.internal',
    '127.0.0.1',
    '10.0.0.8',
    '100.64.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '192.0.2.1',
    '198.51.100.2',
    '203.0.113.3',
    '::1',
    'fd00::1',
    'fe80::1',
    'fec0::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '2002:7f00:1::',
  ])('阻断本机、内网、链路本地或保留主机 %s', (hostname) => {
    expect(isPrivateOrReservedProviderHost(hostname)).toBe(true)
  })

  it.each(['api.openai.com', 'api.deepseek.com', '8.8.8.8', '2001:4860:4860::8888'])(
    '允许公开主机 %s',
    (hostname) => {
      expect(isPrivateOrReservedProviderHost(hostname)).toBe(false)
    },
  )

  it('规范化公开 Base URL，并拒绝凭据、查询参数和危险协议', () => {
    expect(validateProviderBaseUrl('https://api.example.com/v1/')).toBe(
      'https://api.example.com/v1',
    )
    expect(() => validateProviderBaseUrl('https://user:pass@api.example.com/v1')).toThrow(
      '不允许包含用户名或密码',
    )
    expect(() => validateProviderBaseUrl('https://api.example.com/v1?token=secret')).toThrow(
      '不允许包含查询参数或片段',
    )
    expect(() => validateProviderBaseUrl('file:///etc/passwd')).toThrow(
      '仅允许 http 或 https 协议',
    )
  })

  it.each([
    'http://2130706433/v1',
    'http://0x7f000001/v1',
    'http://127.1/v1',
    'http://[::ffff:7f00:1]/v1',
    'http://[2002:7f00:1::]/v1',
  ])('阻断 URL 解析器可接受的地址绕过形式 %s', (baseUrl) => {
    expect(() => validateProviderBaseUrl(baseUrl)).toThrow('不允许指向本机')
  })

  it('DNS 任一记录为私网时拒绝整个自定义端点', async () => {
    await expect(
      validateProviderBaseUrlForRequest('https://api.example.com/v1', async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '10.10.0.5', family: 4 },
      ]),
    ).rejects.toThrow('域名解析到本机')
  })

  it('DNS 全部记录为公网时返回规范化地址', async () => {
    await expect(
      validateProviderBaseUrlForRequest('https://api.example.com/v1/', async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '2001:4860:4860::8888', family: 6 },
      ]),
    ).resolves.toBe('https://api.example.com/v1')
  })

  it('DNS 失败和空记录使用不泄露网络细节的错误', async () => {
    await expect(
      validateProviderBaseUrlForRequest('https://api.example.com/v1', async () => {
        throw new Error('resolver internal detail')
      }),
    ).rejects.toThrow('域名解析失败')
    await expect(
      validateProviderBaseUrlForRequest('https://api.example.com/v1', async () => []),
    ).rejects.toThrow('没有可用的 DNS 记录')
  })

  it('测连接口在发起网络请求前拒绝内网地址', async () => {
    const response = await app.request('/api/providers/test', {
      method: 'POST',
      headers: jsonHeaders('198.18.1.1'),
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-test',
        apiKey: 'not-a-real-key',
        baseUrl: 'http://127.0.0.1:8787/v1',
      }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('BAD_REQUEST')
    expect(body.error.message).toContain('不允许指向本机')
  })

  it('生成接口在预占额度或连接厂商前拒绝云元数据地址', async () => {
    const response = await app.request('/api/generate', {
      method: 'POST',
      headers: jsonHeaders('198.18.1.2'),
      body: JSON.stringify({
        provider: 'openai',
        model: 'gpt-test',
        apiKey: 'not-a-real-key',
        baseUrl: 'http://169.254.169.254/latest/meta-data',
        siteType: 'personal',
        requirement: '生成一个个人主页',
      }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('BAD_REQUEST')
    expect(body.error.message).toContain('不允许指向本机')
  })
})

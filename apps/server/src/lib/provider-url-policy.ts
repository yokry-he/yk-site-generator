import { env } from '../env'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
])

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.home.arpa']

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null
  const values = parts.map(Number)
  return values.every((value) => value >= 0 && value <= 255) ? values : null
}

function isBlockedIpv4(parts: number[]): boolean {
  const [a, b, c] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!normalized.includes(':')) return false
  if (normalized === '::' || normalized === '::1') return true
  if (/^(fc|fd)/.test(normalized)) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('ff')) return true

  const mappedIpv4 = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  return mappedIpv4 ? isBlockedIpv4(parseIpv4(mappedIpv4) ?? []) : false
}

export function isPrivateOrReservedProviderHost(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase()
  if (!normalized) return true
  if (BLOCKED_HOSTNAMES.has(normalized)) return true
  if (BLOCKED_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) return true

  const ipv4 = parseIpv4(normalized)
  if (ipv4 && isBlockedIpv4(ipv4)) return true
  return isBlockedIpv6(normalized)
}

/**
 * 校验用户自定义模型 Base URL，阻断直接访问本机、内网、链路本地及云元数据地址。
 * 默认厂商地址由代码维护，不经过此策略；开发者如确需连接本地模型，必须显式开启环境变量。
 */
export function validateProviderBaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('自定义 Base URL 不是合法 URL')
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('自定义 Base URL 仅允许 http 或 https 协议')
  }
  if (url.username || url.password) {
    throw new Error('自定义 Base URL 不允许包含用户名或密码')
  }
  if (url.search || url.hash) {
    throw new Error('自定义 Base URL 不允许包含查询参数或片段')
  }
  if (env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('生产环境的自定义 Base URL 必须使用 https')
  }
  if (!env.ALLOW_PRIVATE_PROVIDER_BASE_URLS && isPrivateOrReservedProviderHost(url.hostname)) {
    throw new Error('自定义 Base URL 不允许指向本机、内网、链路本地或保留地址')
  }

  return url.toString().replace(/\/$/, '')
}

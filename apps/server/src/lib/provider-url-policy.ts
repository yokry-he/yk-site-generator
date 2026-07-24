import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { env } from '../env'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
])

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.home.arpa']

export interface ProviderResolvedAddress {
  address: string
  family: number
}

export type ProviderHostResolver = (
  hostname: string,
) => Promise<readonly ProviderResolvedAddress[]>

const defaultResolver: ProviderHostResolver = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true })

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null
  const values = parts.map(Number)
  return values.every((value) => value >= 0 && value <= 255) ? values : null
}

function isBlockedIpv4(parts: number[]): boolean {
  if (parts.length !== 4) return true
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

function ipv6ToHextets(hostname: string): number[] | null {
  let normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (normalized.includes('%')) return null

  const ipv4Tail = normalized.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  let ipv4Hextets: number[] = []
  if (ipv4Tail) {
    const ipv4 = parseIpv4(ipv4Tail)
    if (!ipv4) return null
    ipv4Hextets = [(ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]]
    normalized = normalized.slice(0, normalized.length - ipv4Tail.length).replace(/:$/, '')
  }

  if ((normalized.match(/::/g) ?? []).length > 1) return null
  const [leftRaw, rightRaw] = normalized.split('::')
  const left = leftRaw ? leftRaw.split(':').filter(Boolean) : []
  const right = rightRaw ? rightRaw.split(':').filter(Boolean) : []
  const explicit = left.length + right.length + ipv4Hextets.length
  const fill = normalized.includes('::') ? 8 - explicit : 0
  if (fill < 0 || (!normalized.includes('::') && explicit !== 8)) return null

  const tokens = [...left, ...Array.from({ length: fill }, () => '0'), ...right]
  const parsed = tokens.map((token) => Number.parseInt(token, 16))
  if (
    parsed.some((value, index) =>
      !Number.isInteger(value) || value < 0 || value > 0xffff || !/^[0-9a-f]{1,4}$/.test(tokens[index]),
    )
  ) {
    return null
  }
  const result = [...parsed, ...ipv4Hextets]
  return result.length === 8 ? result : null
}

function embeddedIpv4(hextets: number[], index: number): number[] {
  return [
    hextets[index] >> 8,
    hextets[index] & 0xff,
    hextets[index + 1] >> 8,
    hextets[index + 1] & 0xff,
  ]
}

function isBlockedIpv6(hostname: string): boolean {
  const hextets = ipv6ToHextets(hostname)
  if (!hextets) return hostname.includes(':')

  const [first, second] = hextets
  const allZero = hextets.every((value) => value === 0)
  const loopback = hextets.slice(0, 7).every((value) => value === 0) && hextets[7] === 1
  if (allZero || loopback) return true
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true // fec0::/10 deprecated site-local
  if ((first & 0xff00) === 0xff00) return true // multicast
  if (first === 0x0100 && second === 0) return true // 100::/64 discard-only
  if (first === 0x2001 && second === 0) return true // Teredo / special-use
  if (first === 0x2001 && second === 0x0002) return true // benchmarking
  if (first === 0x2001 && second === 0x0db8) return true // documentation

  const isMapped = hextets.slice(0, 5).every((value) => value === 0) && hextets[5] === 0xffff
  const isCompatible = hextets.slice(0, 6).every((value) => value === 0)
  if ((isMapped || isCompatible) && isBlockedIpv4(embeddedIpv4(hextets, 6))) return true

  if (first === 0x2002 && isBlockedIpv4(embeddedIpv4(hextets, 1))) return true // 6to4
  return false
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
 * 先做纯 URL/字面地址校验。默认厂商地址由代码维护，不经过自定义地址策略。
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

/**
 * 请求前解析自定义域名，任一 A/AAAA 记录落入非公网地址即拒绝。
 * 解析器可注入，便于测试 DNS rebinding 与混合公网/私网结果。
 */
export async function validateProviderBaseUrlForRequest(
  raw: string | undefined,
  resolver: ProviderHostResolver = defaultResolver,
): Promise<string | undefined> {
  const normalized = validateProviderBaseUrl(raw)
  if (!normalized || env.ALLOW_PRIVATE_PROVIDER_BASE_URLS) return normalized

  const url = new URL(normalized)
  if (isIP(url.hostname.replace(/^\[|\]$/g, ''))) return normalized

  let addresses: readonly ProviderResolvedAddress[]
  try {
    addresses = await resolver(url.hostname)
  } catch {
    throw new Error('自定义 Base URL 域名解析失败')
  }
  if (!addresses.length) throw new Error('自定义 Base URL 域名没有可用的 DNS 记录')
  if (addresses.some(({ address }) => isPrivateOrReservedProviderHost(address))) {
    throw new Error('自定义 Base URL 域名解析到本机、内网、链路本地或保留地址')
  }
  return normalized
}

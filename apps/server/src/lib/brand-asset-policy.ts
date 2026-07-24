const MAX_BRAND_ASSET_BYTES = 2_000_000
export const MAX_BRAND_ASSET_DATA_URL_CHARS = 2_700_000

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const DOCUMENT_MIMES = new Set(['text/plain', 'application/pdf'])

export type BrandAssetKind = 'logo' | 'image' | 'icon' | 'background' | 'document'

export interface ValidatedBrandAssetData {
  mime: string
  bytes: number
}

function hasPrefix(bytes: Uint8Array, expected: number[]): boolean {
  return expected.every((value, index) => bytes[index] === value)
}

function decodeBase64(payload: string): Buffer {
  if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) {
    throw new Error('品牌资源不是合法 Base64 数据')
  }
  const decoded = Buffer.from(payload, 'base64')
  const normalizedInput = payload.replace(/=+$/, '')
  const normalizedOutput = decoded.toString('base64').replace(/=+$/, '')
  if (normalizedInput !== normalizedOutput) throw new Error('品牌资源不是合法 Base64 数据')
  if (decoded.byteLength > MAX_BRAND_ASSET_BYTES) throw new Error('品牌资源解码后超过 2MB 上限')
  return decoded
}

function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`${label} 必须是合法 UTF-8 文本`)
  }
}

function validateSvg(bytes: Uint8Array): void {
  const source = decodeUtf8(bytes, 'SVG')
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source)) {
    throw new Error('SVG 内容缺少合法的根元素')
  }
  const forbidden = [
    /<\s*(?:script|foreignObject|iframe|object|embed|audio|video|link|style|animate|set|discard)\b/i,
    /\bon[a-z0-9_-]+\s*=/i,
    /<\s*!\s*(?:doctype|entity)\b/i,
    /<\?xml-stylesheet\b/i,
    /@import\b/i,
    /url\s*\(\s*['"]?\s*(?:javascript:|https?:|data:text\/html)/i,
    /\b(?:href|xlink:href)\s*=\s*['"]\s*(?!#)[^'"]+/i,
  ]
  if (forbidden.some((pattern) => pattern.test(source))) {
    throw new Error('SVG 包含脚本、事件、外部引用或其他主动内容')
  }
}

function validateText(bytes: Uint8Array): void {
  const source = decodeUtf8(bytes, '文本资源')
  if (/\u0000/.test(source)) throw new Error('文本资源包含不允许的二进制空字符')
}

function validateSignature(mime: string, bytes: Uint8Array): void {
  if (mime === 'image/png' && !hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    throw new Error('PNG 文件签名无效')
  }
  if (mime === 'image/jpeg' && !hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    throw new Error('JPEG 文件签名无效')
  }
  if (
    mime === 'image/webp' &&
    !(Buffer.from(bytes.subarray(0, 4)).toString('ascii') === 'RIFF' &&
      Buffer.from(bytes.subarray(8, 12)).toString('ascii') === 'WEBP')
  ) {
    throw new Error('WebP 文件签名无效')
  }
  if (mime === 'application/pdf' && Buffer.from(bytes.subarray(0, 5)).toString('ascii') !== '%PDF-') {
    throw new Error('PDF 文件签名无效')
  }
  if (mime === 'image/svg+xml') validateSvg(bytes)
  if (mime === 'text/plain') validateText(bytes)
}

export function validateBrandAssetDataUrl(
  dataUrl: string,
  kind: BrandAssetKind,
): ValidatedBrandAssetData {
  if (dataUrl.length > MAX_BRAND_ASSET_DATA_URL_CHARS) {
    throw new Error('品牌资源 Data URL 超过允许长度')
  }
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/i.exec(dataUrl)
  if (!match) throw new Error('品牌资源必须是带明确 MIME 的 Base64 Data URL')

  const mime = match[1].toLowerCase()
  const isImageKind = kind !== 'document'
  if (isImageKind && !IMAGE_MIMES.has(mime)) {
    throw new Error('Logo、图片、图标和背景仅支持 PNG、JPG、WebP 或安全 SVG')
  }
  if (!isImageKind && !DOCUMENT_MIMES.has(mime)) {
    throw new Error('文档资源仅支持纯文本或 PDF')
  }

  const bytes = decodeBase64(match[2])
  validateSignature(mime, bytes)
  return { mime, bytes: bytes.byteLength }
}

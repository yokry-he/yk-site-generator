import { API_BASE_URL, apiUrl } from './api'

export interface TemporaryShare {
  id: string
  title: string
  siteType: string
  createdAt: string
  expiresAt: string
  sizeBytes: number
  path: string
  url: string
}

interface ShareResponse {
  share: TemporaryShare
  deleteToken: string
}

export class ShareHttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ShareHttpError'
    this.status = status
    this.code = code
  }
}

async function parseError(response: Response): Promise<ShareHttpError> {
  let code = `HTTP_${response.status}`
  let message = `分享请求失败(HTTP ${response.status})`
  try {
    const data = (await response.json()) as { error?: { code?: string; message?: string } }
    code = data.error?.code ?? code
    message = data.error?.message ?? message
  } catch {
    // 使用默认错误信息
  }
  return new ShareHttpError(response.status, code, message)
}

export async function createTemporaryShare(input: {
  html: string
  title: string
  siteType: string
}): Promise<TemporaryShare> {
  const response = await fetch(apiUrl('/api/shares'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw await parseError(response)
  const data = (await response.json()) as ShareResponse
  const shareBase = API_BASE_URL || window.location.origin
  const absoluteUrl = /^https?:\/\//i.test(data.share.url)
    ? data.share.url
    : new URL(data.share.url, shareBase).toString()
  const share = { ...data.share, url: absoluteUrl }
  try {
    localStorage.setItem(`siteforge:share-token:${share.id}`, data.deleteToken)
  } catch {
    // 隐私模式或存储空间不足不影响分享创建
  }
  return share
}

export async function deleteTemporaryShare(id: string): Promise<void> {
  const key = `siteforge:share-token:${id}`
  const token = localStorage.getItem(key)
  if (!token) throw new ShareHttpError(401, 'SHARE_TOKEN_REQUIRED', '当前浏览器没有保存该分享的删除凭证')
  const response = await fetch(apiUrl(`/api/shares/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: { 'x-share-delete-token': token },
  })
  if (!response.ok) throw await parseError(response)
  localStorage.removeItem(key)
}

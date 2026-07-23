const rawBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
export const API_BASE_URL = rawBase.replace(/\/$/, '')

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized
}

export async function readApiError(response: Response): Promise<{ code: string; message: string }> {
  let code = `HTTP_${response.status}`
  let message = `请求失败(HTTP ${response.status})`
  try {
    const data = (await response.json()) as { error?: { code?: string; message?: string } }
    code = data.error?.code ?? code
    message = data.error?.message ?? message
  } catch {
    // 非 JSON 错误响应使用默认信息
  }
  return { code, message }
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) return response
  const error = await readApiError(response)
  throw new ApiError(response.status, error.code, error.message)
}

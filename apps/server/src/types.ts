import { Hono } from 'hono'

/** 统一错误响应体 */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

export function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } }
}

export type ApiApp = Hono

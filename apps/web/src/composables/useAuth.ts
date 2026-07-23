import { computed, readonly, ref } from 'vue'
import { apiUrl, ApiError, ensureOk } from '../lib/api'

export interface AuthUser {
  id: string
  email: string
  createdAt: string
}

interface AuthResponse {
  user: AuthUser
  accessToken: string
  accessTokenExpiresAt: string
}

const TOKEN_KEY = 'siteforge:access-token'
const EXPIRES_KEY = 'siteforge:access-token-expires'
const user = ref<AuthUser | null>(null)
const accessToken = ref<string | null>(null)
const accessTokenExpiresAt = ref<string | null>(null)
const loading = ref(false)
const initialized = ref(false)
let refreshPromise: Promise<boolean> | null = null

function persistToken(token: string | null, expiresAt: string | null): void {
  accessToken.value = token
  accessTokenExpiresAt.value = expiresAt
  if (token && expiresAt) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(EXPIRES_KEY, expiresAt)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EXPIRES_KEY)
  }
}

function applyAuth(data: AuthResponse): void {
  user.value = data.user
  persistToken(data.accessToken, data.accessTokenExpiresAt)
}

function clearAuth(): void {
  user.value = null
  persistToken(null, null)
}

export async function requestLoginCode(email: string): Promise<{ debugCode?: string; expiresInSeconds: number }> {
  const response = await ensureOk(
    await fetch(apiUrl('/api/auth/request-code'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  )
  return response.json() as Promise<{ debugCode?: string; expiresInSeconds: number }>
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthUser> {
  const response = await ensureOk(
    await fetch(apiUrl('/api/auth/verify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, code }),
    }),
  )
  const data = (await response.json()) as AuthResponse
  applyAuth(data)
  return data.user
}

export async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) {
        clearAuth()
        return false
      }
      applyAuth((await response.json()) as AuthResponse)
      return true
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function authFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers)
  if (accessToken.value) headers.set('authorization', `Bearer ${accessToken.value}`)
  const response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' })
  if (response.status === 401 && retry && (await refreshSession())) {
    return authFetch(path, init, false)
  }
  return response
}

export async function loadAuthSession(): Promise<void> {
  if (initialized.value || loading.value) return
  loading.value = true
  try {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedExpires = localStorage.getItem(EXPIRES_KEY)
    if (storedToken && storedExpires && Date.parse(storedExpires) > Date.now() + 15_000) {
      accessToken.value = storedToken
      accessTokenExpiresAt.value = storedExpires
      const response = await authFetch('/api/auth/me', {}, false)
      if (response.ok) {
        user.value = ((await response.json()) as { user: AuthUser }).user
        return
      }
    }
    await refreshSession()
  } finally {
    loading.value = false
    initialized.value = true
  }
}

export async function logout(): Promise<void> {
  try {
    if (accessToken.value) {
      await authFetch('/api/auth/logout', { method: 'POST' }, false)
    }
  } finally {
    clearAuth()
  }
}

export function requireAuth(): AuthUser {
  if (!user.value) throw new ApiError(401, 'UNAUTHORIZED', '请先登录后继续')
  return user.value
}

export function useAuth() {
  return {
    user: readonly(user),
    accessToken: readonly(accessToken),
    loading: readonly(loading),
    initialized: readonly(initialized),
    isAuthenticated: computed(() => Boolean(user.value)),
    requestLoginCode,
    verifyLoginCode,
    loadAuthSession,
    refreshSession,
    logout,
    authFetch,
  }
}

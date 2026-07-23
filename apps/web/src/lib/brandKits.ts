import type { BrandKit, BrandKitTokens } from 'shared'
import { authFetch } from '../composables/useAuth'
import { ensureOk } from './api'

export type BrandKitInput = BrandKitTokens & {
  name: string
  description: string
  logoDataUrl?: string
  logoDarkDataUrl?: string
  logoVerticalDataUrl?: string
  logoMarkDataUrl?: string
  faviconDataUrl?: string
  ogImageDataUrl?: string
  companyName?: string
  companyDescription?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  socialLinks?: Record<string, string>
  isDefault?: boolean
}

function jsonHeaders(): HeadersInit { return { 'content-type': 'application/json' } }
export async function listBrandKits(): Promise<BrandKit[]> {
  const response = await ensureOk(await authFetch('/api/brand-kits'))
  return ((await response.json()) as { brandKits: BrandKit[] }).brandKits
}
export async function getBrandKit(id: string): Promise<BrandKit> {
  const response = await ensureOk(await authFetch(`/api/brand-kits/${encodeURIComponent(id)}`))
  return ((await response.json()) as { brandKit: BrandKit }).brandKit
}
export async function createBrandKit(input: BrandKitInput): Promise<BrandKit> {
  const response = await ensureOk(await authFetch('/api/brand-kits', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(input) }))
  return ((await response.json()) as { brandKit: BrandKit }).brandKit
}
export async function updateBrandKit(id: string, input: Partial<BrandKitInput>): Promise<BrandKit> {
  const response = await ensureOk(await authFetch(`/api/brand-kits/${encodeURIComponent(id)}`, { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify(input) }))
  return ((await response.json()) as { brandKit: BrandKit }).brandKit
}
export async function setDefaultBrandKit(id: string): Promise<BrandKit> {
  const response = await ensureOk(await authFetch(`/api/brand-kits/${encodeURIComponent(id)}/default`, { method: 'POST' }))
  return ((await response.json()) as { brandKit: BrandKit }).brandKit
}
export async function deleteBrandKit(id: string): Promise<void> {
  await ensureOk(await authFetch(`/api/brand-kits/${encodeURIComponent(id)}`, { method: 'DELETE' }))
}

import { authFetch } from '../composables/useAuth'
import { ensureOk } from './api'

export type BrandAssetKind = 'logo' | 'image' | 'icon' | 'background' | 'document'

export interface BrandAsset {
  id: string
  userId: string
  brandKitId?: string
  kind: BrandAssetKind
  name: string
  dataUrl: string
  alt?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface BrandAssetInput {
  brandKitId?: string
  kind: BrandAssetKind
  name: string
  dataUrl: string
  alt?: string
  tags: string[]
}

export type BrandAssetUpdate = Partial<Omit<BrandAssetInput, 'brandKitId' | 'alt'>> & {
  brandKitId?: string | null
  alt?: string | null
}

function jsonHeaders(): HeadersInit {
  return { 'content-type': 'application/json' }
}

export async function listBrandAssets(input: { kind?: BrandAssetKind | 'all'; brandKitId?: string } = {}): Promise<BrandAsset[]> {
  const params = new URLSearchParams()
  if (input.kind) params.set('kind', input.kind)
  if (input.brandKitId) params.set('brandKitId', input.brandKitId)
  const response = await ensureOk(await authFetch(`/api/brand-assets?${params}`))
  return ((await response.json()) as { assets: BrandAsset[] }).assets
}

export async function createBrandAsset(input: BrandAssetInput): Promise<BrandAsset> {
  const response = await ensureOk(await authFetch('/api/brand-assets', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  }))
  return ((await response.json()) as { asset: BrandAsset }).asset
}

export async function updateBrandAsset(id: string, input: BrandAssetUpdate): Promise<BrandAsset> {
  const response = await ensureOk(await authFetch(`/api/brand-assets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  }))
  return ((await response.json()) as { asset: BrandAsset }).asset
}

export async function deleteBrandAsset(id: string): Promise<void> {
  await ensureOk(await authFetch(`/api/brand-assets/${encodeURIComponent(id)}`, { method: 'DELETE' }))
}

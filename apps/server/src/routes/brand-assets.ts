import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  MAX_BRAND_ASSET_DATA_URL_CHARS,
  validateBrandAssetDataUrl,
  type BrandAssetKind,
} from '../lib/brand-asset-policy'
import { mutateData, readData, type BrandAssetRecord } from '../lib/data-store'
import { featureFlagMiddleware } from '../lib/feature-flags'
import { errorBody } from '../types'

const dataUrlSchema = z.string().min(20).max(MAX_BRAND_ASSET_DATA_URL_CHARS)
const kindSchema = z.enum(['logo', 'image', 'icon', 'background', 'document'])
const createSchema = z.object({
  brandKitId: z.string().uuid().optional(),
  kind: kindSchema,
  name: z.string().trim().min(1).max(100),
  dataUrl: dataUrlSchema,
  alt: z.string().trim().max(240).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
})
const updateSchema = z.object({
  brandKitId: z.string().uuid().nullable().optional(),
  kind: kindSchema.optional(),
  name: z.string().trim().min(1).max(100).optional(),
  dataUrl: dataUrlSchema.optional(),
  alt: z.string().trim().max(240).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
}).refine((input) => Object.keys(input).length > 0, '至少提交一个修改字段')
const querySchema = z.object({
  kind: z.enum(['all', 'logo', 'image', 'icon', 'background', 'document']).default('all'),
  brandKitId: z.string().uuid().optional(),
})

type AssetMutationResult =
  | BrandAssetRecord
  | { error: 'BRAND_KIT_NOT_FOUND' | 'INVALID_ASSET'; message?: string }
  | null

function validationMessage(error: unknown): string {
  return error instanceof Error ? error.message : '品牌资源内容无效'
}

const brandAssets = new Hono<AuthEnv>()
brandAssets.use('*', authMiddleware)
brandAssets.use('*', featureFlagMiddleware('brand-kits'))

brandAssets.get('/', async (c) => {
  let query: z.infer<typeof querySchema>
  try {
    query = querySchema.parse(c.req.query())
  } catch {
    return c.json(errorBody('BAD_REQUEST', '品牌资源筛选参数无效'), 400)
  }
  const userId = c.get('auth').sub
  const data = await readData()
  const assets = data.brandAssets
    .filter((asset) => asset.userId === userId)
    .filter((asset) => query.kind === 'all' || asset.kind === query.kind)
    .filter((asset) => !query.brandKitId || asset.brandKitId === query.brandKitId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  return c.json({ assets })
})

brandAssets.post('/', async (c) => {
  let input: z.infer<typeof createSchema>
  try {
    input = createSchema.parse(await c.req.json())
    validateBrandAssetDataUrl(input.dataUrl, input.kind as BrandAssetKind)
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? '参数错误'
        : validationMessage(error)
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const asset = await mutateData<AssetMutationResult>((data) => {
    if (
      input.brandKitId &&
      !data.brandKits.some((kit) => kit.id === input.brandKitId && kit.userId === userId)
    ) {
      return { error: 'BRAND_KIT_NOT_FOUND' }
    }
    const row: BrandAssetRecord = {
      id: randomUUID(),
      userId,
      brandKitId: input.brandKitId,
      kind: input.kind,
      name: input.name,
      dataUrl: input.dataUrl,
      alt: input.alt || undefined,
      tags: [...new Set(input.tags.map((tag) => tag.toLowerCase()))],
      createdAt: now,
      updatedAt: now,
    }
    data.brandAssets.push(row)
    return structuredClone(row)
  })
  if (asset && 'error' in asset) {
    return c.json(errorBody(asset.error, '品牌套件不存在'), 404)
  }
  return c.json({ asset }, 201)
})

brandAssets.patch('/:id', async (c) => {
  let input: z.infer<typeof updateSchema>
  try {
    input = updateSchema.parse(await c.req.json())
  } catch (error) {
    const message =
      error instanceof z.ZodError ? error.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const result = await mutateData<AssetMutationResult>((data) => {
    const row = data.brandAssets.find(
      (asset) => asset.id === c.req.param('id') && asset.userId === userId,
    )
    if (!row) return null
    if (
      input.brandKitId &&
      !data.brandKits.some((kit) => kit.id === input.brandKitId && kit.userId === userId)
    ) {
      return { error: 'BRAND_KIT_NOT_FOUND' }
    }

    const nextKind = (input.kind ?? row.kind) as BrandAssetKind
    const nextDataUrl = input.dataUrl ?? row.dataUrl
    try {
      validateBrandAssetDataUrl(nextDataUrl, nextKind)
    } catch (error) {
      return { error: 'INVALID_ASSET', message: validationMessage(error) }
    }

    if (input.brandKitId !== undefined) row.brandKitId = input.brandKitId ?? undefined
    if (input.kind !== undefined) row.kind = input.kind
    if (input.name !== undefined) row.name = input.name
    if (input.dataUrl !== undefined) row.dataUrl = input.dataUrl
    if (input.alt !== undefined) row.alt = input.alt || undefined
    if (input.tags !== undefined) {
      row.tags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))]
    }
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  if (result && 'error' in result) {
    if (result.error === 'INVALID_ASSET') {
      return c.json(errorBody('BAD_REQUEST', result.message ?? '品牌资源内容无效'), 400)
    }
    return c.json(errorBody(result.error, '品牌套件不存在'), 404)
  }
  if (!result) return c.json(errorBody('BRAND_ASSET_NOT_FOUND', '品牌资源不存在'), 404)
  return c.json({ asset: result })
})

brandAssets.delete('/:id', async (c) => {
  const userId = c.get('auth').sub
  const removed = await mutateData((data) => {
    const before = data.brandAssets.length
    data.brandAssets = data.brandAssets.filter(
      (asset) => asset.id !== c.req.param('id') || asset.userId !== userId,
    )
    return data.brandAssets.length < before
  })
  if (!removed) return c.json(errorBody('BRAND_ASSET_NOT_FOUND', '品牌资源不存在'), 404)
  return c.json({ ok: true })
})

export default brandAssets

import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import { validateBrandAssetDataUrl, type BrandAssetKind } from '../lib/brand-asset-policy'
import { mutateData, readData, type BrandKitRecord } from '../lib/data-store'
import { featureFlagMiddleware } from '../lib/feature-flags'
import { errorBody } from '../types'

const color = z.string().regex(/^#[0-9a-f]{6}$/i, '颜色必须是 6 位十六进制值')
const optionalImage = z.string().max(700_000, '图片数据过大').optional()
const optionalText = (max: number) => z.string().trim().max(max).optional()
const socialLinks = z.record(z.string().trim().min(1).max(40), z.string().url().max(500)).refine((value) => Object.keys(value).length <= 12, '社交链接最多 12 项').optional()

const tokenSchema = z.object({
  primary: color,
  secondary: color,
  accent: color,
  background: color,
  surface: color,
  text: color,
  muted: color,
  headingFont: z.enum(['modern-sans', 'humanist-sans', 'editorial-serif', 'geometric-sans', 'mono']),
  bodyFont: z.enum(['modern-sans', 'humanist-sans', 'editorial-serif', 'geometric-sans', 'mono']),
  radius: z.number().int().min(0).max(32),
  buttonStyle: z.enum(['solid', 'soft', 'outline']),
  shadow: z.enum(['none', 'soft', 'medium', 'dramatic']),
  headingScale: z.number().min(0.8).max(1.35).optional(),
  spacingDensity: z.enum(['compact', 'comfortable', 'spacious']).optional(),
  contentWidth: z.number().int().min(720).max(1600).optional(),
  navigationStyle: z.enum(['minimal', 'pill', 'bordered']).optional(),
  inputStyle: z.enum(['soft', 'outline', 'underline']).optional(),
  imageStyle: z.enum(['square', 'rounded', 'organic']).optional(),
  iconStyle: z.enum(['outline', 'solid', 'duotone']).optional(),
})

const identitySchema = z.object({
  logoDataUrl: optionalImage,
  logoDarkDataUrl: optionalImage,
  logoVerticalDataUrl: optionalImage,
  logoMarkDataUrl: optionalImage,
  faviconDataUrl: optionalImage,
  ogImageDataUrl: optionalImage,
  companyName: optionalText(120),
  companyDescription: optionalText(800),
  contactEmail: z.string().trim().email().max(320).or(z.literal('')).optional(),
  contactPhone: optionalText(60),
  address: optionalText(300),
  socialLinks,
})

const nameSchema = z.string().trim().min(1, '请输入品牌套件名称').max(80)
const descriptionSchema = z.string().trim().max(240)
const createSchema = tokenSchema.merge(identitySchema).extend({ name: nameSchema, description: descriptionSchema.default(''), isDefault: z.boolean().default(false) })
const updateSchema = tokenSchema.partial().merge(identitySchema).extend({ name: nameSchema.optional(), description: descriptionSchema.optional(), isDefault: z.boolean().optional() })

const imageFields = ['logoDataUrl', 'logoDarkDataUrl', 'logoVerticalDataUrl', 'logoMarkDataUrl', 'faviconDataUrl', 'ogImageDataUrl'] as const
type ImageField = (typeof imageFields)[number]
const imageKinds: Record<ImageField, BrandAssetKind> = {
  logoDataUrl: 'logo',
  logoDarkDataUrl: 'logo',
  logoVerticalDataUrl: 'logo',
  logoMarkDataUrl: 'icon',
  faviconDataUrl: 'icon',
  ogImageDataUrl: 'image',
}

const brandKits = new Hono<AuthEnv>()
brandKits.use('*', authMiddleware)
brandKits.use('*', featureFlagMiddleware('brand-kits'))

function sorted(rows: BrandKitRecord[]): BrandKitRecord[] {
  return [...rows].sort((a, b) => a.isDefault !== b.isDefault ? (a.isDefault ? -1 : 1) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
function zodMessage(error: unknown): string { return error instanceof z.ZodError ? error.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON' }
function optionalValue(value: string | undefined): string | undefined { return value?.trim() || undefined }
function validateIdentityImages(input: Partial<Record<ImageField, string | undefined>>): string | null {
  for (const field of imageFields) {
    const value = input[field]
    if (!value) continue
    try {
      validateBrandAssetDataUrl(value, imageKinds[field])
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片内容不安全'
      return `${field}: ${message}`
    }
  }
  return null
}

brandKits.get('/', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  return c.json({ brandKits: sorted(data.brandKits.filter((item) => item.userId === userId)) })
})
brandKits.get('/:id', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const brandKit = data.brandKits.find((item) => item.id === c.req.param('id') && item.userId === userId)
  return brandKit ? c.json({ brandKit }) : c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
})

brandKits.post('/', async (c) => {
  let input: z.infer<typeof createSchema>
  try { input = createSchema.parse(await c.req.json()) }
  catch (error) { return c.json(errorBody('BAD_REQUEST', zodMessage(error)), 400) }
  const imageError = validateIdentityImages(input)
  if (imageError) return c.json(errorBody('BAD_REQUEST', imageError), 400)
  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const brandKit = await mutateData((data) => {
    const userRows = data.brandKits.filter((item) => item.userId === userId)
    const shouldDefault = input.isDefault || userRows.length === 0
    if (shouldDefault) for (const item of userRows) item.isDefault = false
    const row: BrandKitRecord = {
      id: randomUUID(), userId, name: input.name, description: input.description,
      logoDataUrl: optionalValue(input.logoDataUrl), logoDarkDataUrl: optionalValue(input.logoDarkDataUrl), logoVerticalDataUrl: optionalValue(input.logoVerticalDataUrl), logoMarkDataUrl: optionalValue(input.logoMarkDataUrl), faviconDataUrl: optionalValue(input.faviconDataUrl), ogImageDataUrl: optionalValue(input.ogImageDataUrl),
      companyName: optionalValue(input.companyName), companyDescription: optionalValue(input.companyDescription), contactEmail: optionalValue(input.contactEmail), contactPhone: optionalValue(input.contactPhone), address: optionalValue(input.address), socialLinks: input.socialLinks,
      isDefault: shouldDefault,
      primary: input.primary.toLowerCase(), secondary: input.secondary.toLowerCase(), accent: input.accent.toLowerCase(), background: input.background.toLowerCase(), surface: input.surface.toLowerCase(), text: input.text.toLowerCase(), muted: input.muted.toLowerCase(),
      headingFont: input.headingFont, bodyFont: input.bodyFont, radius: input.radius, buttonStyle: input.buttonStyle, shadow: input.shadow,
      headingScale: input.headingScale, spacingDensity: input.spacingDensity, contentWidth: input.contentWidth, navigationStyle: input.navigationStyle, inputStyle: input.inputStyle, imageStyle: input.imageStyle, iconStyle: input.iconStyle,
      createdAt: now, updatedAt: now,
    }
    data.brandKits.push(row)
    return structuredClone(row)
  })
  return c.json({ brandKit }, 201)
})

brandKits.patch('/:id', async (c) => {
  let input: z.infer<typeof updateSchema>
  try { input = updateSchema.parse(await c.req.json()) }
  catch (error) { return c.json(errorBody('BAD_REQUEST', zodMessage(error)), 400) }
  const imageError = validateIdentityImages(input)
  if (imageError) return c.json(errorBody('BAD_REQUEST', imageError), 400)
  const userId = c.get('auth').sub
  const brandKit = await mutateData<BrandKitRecord | null>((data) => {
    const row = data.brandKits.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!row) return null
    if (input.isDefault) for (const item of data.brandKits) if (item.userId === userId) item.isDefault = item.id === row.id
    for (const field of imageFields) if (input[field] !== undefined) row[field] = optionalValue(input[field])
    const textFields = ['name', 'description', 'companyName', 'companyDescription', 'contactEmail', 'contactPhone', 'address'] as const
    for (const field of textFields) if (input[field] !== undefined) Object.assign(row, { [field]: optionalValue(input[field]) })
    const colorFields = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted'] as const
    for (const field of colorFields) if (input[field] !== undefined) row[field] = input[field].toLowerCase()
    const tokenFields = ['headingFont', 'bodyFont', 'buttonStyle', 'shadow', 'spacingDensity', 'navigationStyle', 'inputStyle', 'imageStyle', 'iconStyle'] as const
    for (const field of tokenFields) if (input[field] !== undefined) Object.assign(row, { [field]: input[field] })
    if (input.radius !== undefined) row.radius = input.radius
    if (input.headingScale !== undefined) row.headingScale = input.headingScale
    if (input.contentWidth !== undefined) row.contentWidth = input.contentWidth
    if (input.socialLinks !== undefined) row.socialLinks = input.socialLinks
    if (input.isDefault === false && row.isDefault) {
      const replacement = data.brandKits.find((item) => item.userId === userId && item.id !== row.id)
      row.isDefault = !replacement
      if (replacement) replacement.isDefault = true
    }
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  return brandKit ? c.json({ brandKit }) : c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
})

brandKits.post('/:id/default', async (c) => {
  const userId = c.get('auth').sub
  const brandKit = await mutateData<BrandKitRecord | null>((data) => {
    const row = data.brandKits.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!row) return null
    for (const item of data.brandKits) if (item.userId === userId) item.isDefault = item.id === row.id
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  return brandKit ? c.json({ brandKit }) : c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
})

brandKits.delete('/:id', async (c) => {
  const userId = c.get('auth').sub
  const deleted = await mutateData((data) => {
    const index = data.brandKits.findIndex((item) => item.id === c.req.param('id') && item.userId === userId)
    if (index < 0) return false
    const [removed] = data.brandKits.splice(index, 1)
    if (removed.isDefault) { const replacement = sorted(data.brandKits.filter((item) => item.userId === userId))[0]; if (replacement) replacement.isDefault = true }
    return true
  })
  return deleted ? c.json({ ok: true }) : c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
})

export default brandKits

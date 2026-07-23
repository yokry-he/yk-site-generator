import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import { mutateData, readData, type BrandKitRecord } from '../lib/data-store'
import { errorBody } from '../types'

const color = z.string().regex(/^#[0-9a-f]{6}$/i, '颜色必须是 6 位十六进制值')
const optionalImage = z
  .string()
  .max(700_000, '图片数据过大')
  .refine((value) => value === '' || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(value), '图片格式不受支持')
  .optional()

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
})

const nameSchema = z.string().trim().min(1, '请输入品牌套件名称').max(80)
const descriptionSchema = z.string().trim().max(240)

const createSchema = tokenSchema.extend({
  name: nameSchema,
  description: descriptionSchema.default(''),
  logoDataUrl: optionalImage,
  faviconDataUrl: optionalImage,
  isDefault: z.boolean().default(false),
})

/** PATCH 不能继承 create 的默认值，否则未提交字段会被误判为显式 false/空值。 */
const updateSchema = tokenSchema.partial().extend({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  logoDataUrl: optionalImage,
  faviconDataUrl: optionalImage,
  isDefault: z.boolean().optional(),
})

const brandKits = new Hono<AuthEnv>()
brandKits.use('*', authMiddleware)

function sorted(rows: BrandKitRecord[]): BrandKitRecord[] {
  return [...rows].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  })
}

function zodMessage(err: unknown): string {
  return err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
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
  if (!brandKit) return c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
  return c.json({ brandKit })
})

brandKits.post('/', async (c) => {
  let input: z.infer<typeof createSchema>
  try {
    input = createSchema.parse(await c.req.json())
  } catch (err) {
    return c.json(errorBody('BAD_REQUEST', zodMessage(err)), 400)
  }

  const userId = c.get('auth').sub
  const now = new Date().toISOString()
  const brandKit = await mutateData((data) => {
    const userRows = data.brandKits.filter((item) => item.userId === userId)
    const shouldDefault = input.isDefault || userRows.length === 0
    if (shouldDefault) {
      for (const item of userRows) item.isDefault = false
    }
    const row: BrandKitRecord = {
      id: randomUUID(),
      userId,
      name: input.name,
      description: input.description,
      logoDataUrl: input.logoDataUrl || undefined,
      faviconDataUrl: input.faviconDataUrl || undefined,
      isDefault: shouldDefault,
      primary: input.primary.toLowerCase(),
      secondary: input.secondary.toLowerCase(),
      accent: input.accent.toLowerCase(),
      background: input.background.toLowerCase(),
      surface: input.surface.toLowerCase(),
      text: input.text.toLowerCase(),
      muted: input.muted.toLowerCase(),
      headingFont: input.headingFont,
      bodyFont: input.bodyFont,
      radius: input.radius,
      buttonStyle: input.buttonStyle,
      shadow: input.shadow,
      createdAt: now,
      updatedAt: now,
    }
    data.brandKits.push(row)
    return structuredClone(row)
  })
  return c.json({ brandKit }, 201)
})

brandKits.patch('/:id', async (c) => {
  let input: z.infer<typeof updateSchema>
  try {
    input = updateSchema.parse(await c.req.json())
  } catch (err) {
    return c.json(errorBody('BAD_REQUEST', zodMessage(err)), 400)
  }
  const userId = c.get('auth').sub
  const brandKit = await mutateData<BrandKitRecord | null>((data) => {
    const row = data.brandKits.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!row) return null
    if (input.isDefault) {
      for (const item of data.brandKits) {
        if (item.userId === userId) item.isDefault = item.id === row.id
      }
    }
    const stringFields = [
      'name', 'description', 'logoDataUrl', 'faviconDataUrl', 'primary', 'secondary', 'accent',
      'background', 'surface', 'text', 'muted', 'headingFont', 'bodyFont', 'buttonStyle', 'shadow',
    ] as const
    for (const field of stringFields) {
      const value = input[field]
      if (value !== undefined) {
        if (field === 'logoDataUrl' || field === 'faviconDataUrl') row[field] = value || undefined
        else if (field === 'primary' || field === 'secondary' || field === 'accent' || field === 'background' || field === 'surface' || field === 'text' || field === 'muted') row[field] = value.toLowerCase()
        else Object.assign(row, { [field]: value })
      }
    }
    if (input.radius !== undefined) row.radius = input.radius
    if (input.isDefault === false && row.isDefault) {
      const replacement = data.brandKits.find((item) => item.userId === userId && item.id !== row.id)
      row.isDefault = !replacement
      if (replacement) replacement.isDefault = true
    }
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  if (!brandKit) return c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
  return c.json({ brandKit })
})

brandKits.post('/:id/default', async (c) => {
  const userId = c.get('auth').sub
  const brandKit = await mutateData<BrandKitRecord | null>((data) => {
    const row = data.brandKits.find((item) => item.id === c.req.param('id') && item.userId === userId)
    if (!row) return null
    for (const item of data.brandKits) {
      if (item.userId === userId) item.isDefault = item.id === row.id
    }
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  if (!brandKit) return c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
  return c.json({ brandKit })
})

brandKits.delete('/:id', async (c) => {
  const userId = c.get('auth').sub
  const deleted = await mutateData((data) => {
    const index = data.brandKits.findIndex((item) => item.id === c.req.param('id') && item.userId === userId)
    if (index < 0) return false
    const [removed] = data.brandKits.splice(index, 1)
    if (removed.isDefault) {
      const replacement = sorted(data.brandKits.filter((item) => item.userId === userId))[0]
      if (replacement) replacement.isDefault = true
    }
    return true
  })
  if (!deleted) return c.json(errorBody('BRAND_KIT_NOT_FOUND', '品牌套件不存在'), 404)
  return c.json({ ok: true })
})

export default brandKits

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthEnv } from '../lib/auth'
import {
  mutateData,
  readData,
  type OnboardingContext,
  type OnboardingProgressRecord,
} from '../lib/data-store'
import { errorBody } from '../types'

const stepSchema = z.enum(['welcome', 'goal', 'starter', 'brand', 'ready'])
const contextSchema = z.object({
  goal: z.enum(['personal', 'business', 'content', 'data']).optional(),
  siteType: z.string().trim().max(40).optional(),
  starter: z.enum(['template', 'ai']).optional(),
  brandIntent: z.enum(['create', 'later']).optional(),
}).partial()

const updateSchema = z.object({
  currentStep: stepSchema.optional(),
  completedSteps: z.array(z.string().trim().min(1).max(48)).max(20).optional(),
  context: contextSchema.optional(),
})

const onboarding = new Hono<AuthEnv>()
onboarding.use('*', authMiddleware)

function emptyProgress(userId: string): OnboardingProgressRecord {
  return {
    userId,
    currentStep: 'welcome',
    completedSteps: [],
    context: {},
    updatedAt: new Date().toISOString(),
  }
}

function checklist(data: Awaited<ReturnType<typeof readData>>, userId: string) {
  return [
    { id: 'account', label: '创建账号', completed: true, route: '/projects' },
    {
      id: 'brand',
      label: '建立品牌套件',
      completed: data.brandKits.some((item) => item.userId === userId),
      route: '/brand',
    },
    {
      id: 'project',
      label: '创建第一个项目',
      completed: data.projects.some((item) => item.userId === userId),
      route: '/templates',
    },
    {
      id: 'publish',
      label: '发布第一个网站',
      completed: data.publications.some((item) => item.userId === userId && item.status === 'published'),
      route: '/projects',
    },
  ]
}

onboarding.get('/', async (c) => {
  const userId = c.get('auth').sub
  const data = await readData()
  const progress = data.onboardingProgress.find((item) => item.userId === userId) ?? emptyProgress(userId)
  const tasks = checklist(data, userId)
  return c.json({
    progress,
    checklist: tasks,
    completionPercent: Math.round((tasks.filter((item) => item.completed).length / tasks.length) * 100),
  })
})

onboarding.patch('/', async (c) => {
  let input: z.infer<typeof updateSchema>
  try {
    input = updateSchema.parse(await c.req.json())
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? '参数错误' : '请求体不是合法 JSON'
    return c.json(errorBody('BAD_REQUEST', message), 400)
  }
  const userId = c.get('auth').sub
  const progress = await mutateData((data) => {
    let row = data.onboardingProgress.find((item) => item.userId === userId)
    if (!row) {
      row = emptyProgress(userId)
      data.onboardingProgress.push(row)
    }
    if (input.currentStep !== undefined) row.currentStep = input.currentStep
    if (input.completedSteps !== undefined) {
      row.completedSteps = [...new Set([...row.completedSteps, ...input.completedSteps])]
    }
    if (input.context !== undefined) {
      row.context = { ...row.context, ...input.context } as OnboardingContext
    }
    row.dismissedAt = undefined
    row.updatedAt = new Date().toISOString()
    return structuredClone(row)
  })
  return c.json({ progress })
})

onboarding.post('/complete', async (c) => {
  const userId = c.get('auth').sub
  const progress = await mutateData((data) => {
    let row = data.onboardingProgress.find((item) => item.userId === userId)
    if (!row) {
      row = emptyProgress(userId)
      data.onboardingProgress.push(row)
    }
    const now = new Date().toISOString()
    row.currentStep = 'ready'
    row.completedSteps = [...new Set([...row.completedSteps, 'welcome', 'goal', 'starter', 'brand', 'ready'])]
    row.completedAt = now
    row.dismissedAt = undefined
    row.updatedAt = now
    return structuredClone(row)
  })
  return c.json({ progress })
})

onboarding.post('/dismiss', async (c) => {
  const userId = c.get('auth').sub
  const progress = await mutateData((data) => {
    let row = data.onboardingProgress.find((item) => item.userId === userId)
    if (!row) {
      row = emptyProgress(userId)
      data.onboardingProgress.push(row)
    }
    const now = new Date().toISOString()
    row.dismissedAt = now
    row.updatedAt = now
    return structuredClone(row)
  })
  return c.json({ progress })
})

onboarding.post('/reset', async (c) => {
  const userId = c.get('auth').sub
  const progress = await mutateData((data) => {
    data.onboardingProgress = data.onboardingProgress.filter((item) => item.userId !== userId)
    const row = emptyProgress(userId)
    data.onboardingProgress.push(row)
    return structuredClone(row)
  })
  return c.json({ progress })
})

export default onboarding

import { authFetch } from '../composables/useAuth'
import { ensureOk } from './api'

export interface OnboardingContext {
  goal?: 'personal' | 'business' | 'content' | 'data'
  siteType?: string
  starter?: 'template' | 'ai'
  brandIntent?: 'create' | 'later'
}

export interface OnboardingProgress {
  userId: string
  currentStep: 'welcome' | 'goal' | 'starter' | 'brand' | 'ready'
  completedSteps: string[]
  context: OnboardingContext
  completedAt?: string
  dismissedAt?: string
  updatedAt: string
}

export interface OnboardingChecklistItem {
  id: string
  label: string
  completed: boolean
  route: string
}

export async function getOnboarding(): Promise<{
  progress: OnboardingProgress
  checklist: OnboardingChecklistItem[]
  completionPercent: number
}> {
  const response = await ensureOk(await authFetch('/api/onboarding'))
  return response.json() as Promise<{
    progress: OnboardingProgress
    checklist: OnboardingChecklistItem[]
    completionPercent: number
  }>
}

export async function updateOnboarding(input: {
  currentStep?: OnboardingProgress['currentStep']
  completedSteps?: string[]
  context?: OnboardingContext
}): Promise<OnboardingProgress> {
  const response = await ensureOk(
    await authFetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { progress: OnboardingProgress }).progress
}

export async function completeOnboarding(): Promise<OnboardingProgress> {
  const response = await ensureOk(await authFetch('/api/onboarding/complete', { method: 'POST' }))
  return ((await response.json()) as { progress: OnboardingProgress }).progress
}

export async function dismissOnboarding(): Promise<OnboardingProgress> {
  const response = await ensureOk(await authFetch('/api/onboarding/dismiss', { method: 'POST' }))
  return ((await response.json()) as { progress: OnboardingProgress }).progress
}

export async function resetOnboarding(): Promise<OnboardingProgress> {
  const response = await ensureOk(await authFetch('/api/onboarding/reset', { method: 'POST' }))
  return ((await response.json()) as { progress: OnboardingProgress }).progress
}

export type FeedbackCategory =
  | 'layout'
  | 'copy'
  | 'colors'
  | 'images'
  | 'mobile'
  | 'interaction'
  | 'missing'
  | 'error'
  | 'other'

export interface QualityFeedback {
  id: string
  userId: string
  projectId: string
  versionId: string
  sentiment: 'positive' | 'negative'
  categories: FeedbackCategory[]
  message?: string
  siteType: string
  model?: string
  promptVersion?: string
  metadata?: Record<string, unknown>
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed'
  createdAt: string
  updatedAt: string
}

export async function getMyFeedback(projectId: string, versionId: string): Promise<QualityFeedback | null> {
  const params = new URLSearchParams({ projectId, versionId })
  const response = await ensureOk(await authFetch(`/api/feedback/mine?${params.toString()}`))
  return ((await response.json()) as { feedback: QualityFeedback | null }).feedback
}

export async function submitQualityFeedback(input: {
  projectId: string
  versionId: string
  sentiment: QualityFeedback['sentiment']
  categories: FeedbackCategory[]
  message?: string
  promptVersion?: string
  metadata?: Record<string, string | number | boolean | null>
}): Promise<QualityFeedback> {
  const response = await ensureOk(
    await authFetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  return ((await response.json()) as { feedback: QualityFeedback }).feedback
}

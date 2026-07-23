import { readonly, ref } from 'vue'
import { authFetch } from './useAuth'

export type FeatureKey =
  | 'official-templates'
  | 'brand-kits'
  | 'visual-editor'
  | 'onboarding-guide'
  | 'quality-feedback'
  | 'site-publishing'

export type FeatureState = Record<FeatureKey, boolean>

const DEFAULTS: FeatureState = {
  'official-templates': true,
  'brand-kits': true,
  'visual-editor': true,
  'onboarding-guide': true,
  'quality-feedback': true,
  'site-publishing': true,
}

const features = ref<FeatureState>({ ...DEFAULTS })
const loading = ref(false)
const initialized = ref(false)
let loadPromise: Promise<void> | null = null

function anonymousId(): string {
  const key = 'siteforge:anonymous-id'
  const stored = localStorage.getItem(key)
  if (stored) return stored
  const value = crypto.randomUUID()
  localStorage.setItem(key, value)
  return value
}

export async function loadFeatures(): Promise<void> {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    loading.value = true
    try {
      const response = await authFetch('/api/features', {
        headers: { 'x-anonymous-id': anonymousId() },
      })
      if (!response.ok) return
      const body = (await response.json()) as { features?: Partial<FeatureState> }
      features.value = { ...DEFAULTS, ...(body.features ?? {}) }
      initialized.value = true
    } catch {
      // 能力配置加载失败时保留安全默认值，服务端仍执行最终访问裁决。
    } finally {
      loading.value = false
      loadPromise = null
    }
  })()
  return loadPromise
}

export function useFeatures() {
  return {
    features: readonly(features),
    loading: readonly(loading),
    initialized: readonly(initialized),
    enabled: (key: FeatureKey) => features.value[key],
    loadFeatures,
  }
}

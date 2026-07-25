import { computed, reactive, watch } from 'vue'
import { providerById } from '../data/providers'

export interface ModelConnection {
  apiKey: string
  baseUrl: string
  model: string
  /** Models returned by the provider for this API key during the latest test. */
  availableModels?: string[]
  /** Successful provider test time. Absence means configured but not verified. */
  verifiedAt?: string
  latencyMs?: number
}

interface ModelStore {
  connections: Record<string, ModelConnection>
  active: string | null
}

const STORAGE_KEY = 'siteforge.models.v1'

function normalizeConnection(value: unknown): ModelConnection | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ModelConnection>
  if (typeof candidate.apiKey !== 'string' || typeof candidate.baseUrl !== 'string' || typeof candidate.model !== 'string') return null
  return {
    apiKey: candidate.apiKey,
    baseUrl: candidate.baseUrl,
    model: candidate.model,
    availableModels: Array.isArray(candidate.availableModels)
      ? candidate.availableModels.filter((item): item is string => typeof item === 'string').slice(0, 120)
      : undefined,
    verifiedAt: typeof candidate.verifiedAt === 'string' ? candidate.verifiedAt : undefined,
    latencyMs: typeof candidate.latencyMs === 'number' && Number.isFinite(candidate.latencyMs) ? candidate.latencyMs : undefined,
  }
}

function loadStore(): ModelStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ModelStore>
      const connections: Record<string, ModelConnection> = {}
      if (parsed.connections && typeof parsed.connections === 'object') {
        for (const [providerId, value] of Object.entries(parsed.connections)) {
          const connection = normalizeConnection(value)
          if (connection) connections[providerId] = connection
        }
      }
      const active = typeof parsed.active === 'string' && connections[parsed.active] ? parsed.active : null
      return { connections, active }
    }
  } catch {
    /* Ignore invalid browser storage and start with a clean store. */
  }
  return { connections: {}, active: null }
}

// Module-level singleton shared across the application.
const store = reactive<ModelStore>(loadStore())

watch(
  store,
  (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      /* Browser storage may be unavailable or full. */
    }
  },
  { deep: true },
)

export function useModelConfig() {
  const activeProvider = computed(() => (store.active ? providerById(store.active) : undefined))
  const activeConnection = computed(() => (store.active ? store.connections[store.active] : undefined))
  const isConfigured = computed(() => Boolean(activeProvider.value && activeConnection.value?.apiKey && activeConnection.value.model))
  const isVerified = computed(() => Boolean(isConfigured.value && activeConnection.value?.verifiedAt))

  function save(providerId: string, connection: ModelConnection) {
    store.connections[providerId] = {
      ...connection,
      availableModels: connection.availableModels ? [...new Set(connection.availableModels)].slice(0, 120) : undefined,
    }
    store.active = providerId
  }

  function remove(providerId: string) {
    delete store.connections[providerId]
    if (store.active === providerId) {
      store.active = Object.keys(store.connections)[0] ?? null
    }
  }

  function setActive(providerId: string) {
    if (store.connections[providerId]) store.active = providerId
  }

  return {
    connections: computed(() => store.connections),
    activeId: computed(() => store.active),
    activeProvider,
    activeConnection,
    isConfigured,
    isVerified,
    save,
    remove,
    setActive,
  }
}

export type ModelConfig = ReturnType<typeof useModelConfig>

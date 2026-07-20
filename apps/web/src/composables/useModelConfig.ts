import { computed, reactive, watch } from 'vue'
import { providerById } from '../data/providers'

export interface ModelConnection {
  apiKey: string
  baseUrl: string
  model: string
}

interface ModelStore {
  connections: Record<string, ModelConnection>
  active: string | null
}

const STORAGE_KEY = 'siteforge.models.v1'

function loadStore(): ModelStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ModelStore
      return { connections: parsed.connections ?? {}, active: parsed.active ?? null }
    }
  } catch {
    /* ignore */
  }
  return { connections: {}, active: null }
}

// 模块级单例,全站共享
const store = reactive<ModelStore>(loadStore())

watch(
  store,
  (s) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

export function useModelConfig() {
  const activeProvider = computed(() => (store.active ? providerById(store.active) : undefined))
  const activeConnection = computed(() => (store.active ? store.connections[store.active] : undefined))

  function save(providerId: string, conn: ModelConnection) {
    store.connections[providerId] = conn
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
    save,
    remove,
    setActive,
  }
}

export type ModelConfig = ReturnType<typeof useModelConfig>

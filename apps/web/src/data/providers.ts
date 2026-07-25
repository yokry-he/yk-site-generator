export interface ModelProvider {
  id: string
  name: string
  /** Brand color used by the provider badge. */
  color: string
  /** Console or product domain shown as a hint. */
  domain: string
  defaultBaseUrl: string
  /** Curated current text-generation models, ordered by recommendation. */
  models: string[]
  /** Older aliases retained only for existing saved configurations. */
  legacyModels?: string[]
  defaultModel: string
  /** Date of the last curated catalog review. Live provider sync is newer authority. */
  catalogUpdatedAt: string
  /** API key format hint and minimum client-side length check. */
  keyHint: string
  keyMinLength: number
}

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#10a37f',
    domain: 'platform.openai.com',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: ['gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1'],
    legacyModels: ['gpt-4o', 'gpt-4o-mini', 'o4-mini'],
    defaultModel: 'gpt-5.1',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97757',
    domain: 'console.anthropic.com',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5', 'claude-sonnet-4', 'claude-opus-4'],
    defaultModel: 'claude-sonnet-4-5',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '以 sk-ant- 开头',
    keyMinLength: 20,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    color: '#4285f4',
    domain: 'aistudio.google.com',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    legacyModels: ['gemini-2.5-flash-lite', 'gemini-2.0-flash'],
    defaultModel: 'gemini-3.6-flash',
    catalogUpdatedAt: '2026-07-25',
    keyHint: 'AI Studio 生成的密钥',
    keyMinLength: 20,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    domain: 'platform.deepseek.com',
    defaultBaseUrl: 'https://api.deepseek.com',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    legacyModels: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-v4-pro',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'kimi',
    name: 'Moonshot Kimi',
    color: '#111111',
    domain: 'platform.moonshot.cn',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'kimi-k2-0905-preview', 'kimi-k2-thinking'],
    legacyModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'kimi-k2.5',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    color: '#3867f0',
    domain: 'open.bigmodel.cn',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-5.2', 'glm-5.1', 'glm-5', 'glm-4.7'],
    legacyModels: ['glm-4.6', 'glm-4.5', 'glm-4.5-air'],
    defaultModel: 'glm-5.2',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '形如 xxxx.xxxx 的密钥',
    keyMinLength: 16,
  },
  {
    id: 'qwen',
    name: '通义千问',
    color: '#7b5cf0',
    domain: 'dashscope.aliyun.com',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-flash', 'qwen3.7-max-preview'],
    legacyModels: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    defaultModel: 'qwen3.7-max',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'doubao',
    name: '字节豆包',
    color: '#325bf0',
    domain: 'volcengine.com',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260215',
      'doubao-seed-2-0-mini-260428',
      'doubao-seed-2-0-code-preview-260215',
    ],
    legacyModels: ['doubao-seed-1-6', 'doubao-pro-32k', 'doubao-lite-32k'],
    defaultModel: 'doubao-seed-2-0-pro-260215',
    catalogUpdatedAt: '2026-07-25',
    keyHint: '火山引擎 API Key',
    keyMinLength: 16,
  },
]

export const providerById = (id: string) => MODEL_PROVIDERS.find((provider) => provider.id === id)

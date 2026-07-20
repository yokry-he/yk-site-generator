export interface ModelProvider {
  id: string
  name: string
  /** logo 色块颜色 */
  color: string
  /** 官网域名提示 */
  domain: string
  defaultBaseUrl: string
  models: string[]
  defaultModel: string
  /** key 格式提示与最小长度(用于演示校验) */
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
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
    defaultModel: 'gpt-4o-mini',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#d97757',
    domain: 'console.anthropic.com',
    defaultBaseUrl: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-5',
    keyHint: '以 sk-ant- 开头',
    keyMinLength: 20,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    color: '#4285f4',
    domain: 'aistudio.google.com',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    defaultModel: 'gemini-2.5-flash',
    keyHint: 'AI Studio 生成的密钥',
    keyMinLength: 20,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#4d6bfe',
    domain: 'platform.deepseek.com',
    defaultBaseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'kimi',
    name: 'Moonshot Kimi',
    color: '#111111',
    domain: 'platform.moonshot.cn',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2-0905-preview'],
    defaultModel: 'moonshot-v1-8k',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    color: '#3867f0',
    domain: 'open.bigmodel.cn',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.6', 'glm-4.5', 'glm-4.5-air'],
    defaultModel: 'glm-4.6',
    keyHint: '形如 xxxx.xxxx 的密钥',
    keyMinLength: 16,
  },
  {
    id: 'qwen',
    name: '通义千问',
    color: '#7b5cf0',
    domain: 'dashscope.aliyun.com',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    defaultModel: 'qwen-plus',
    keyHint: '以 sk- 开头',
    keyMinLength: 20,
  },
  {
    id: 'doubao',
    name: '字节豆包',
    color: '#325bf0',
    domain: 'volcengine.com',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-lite-32k', 'doubao-seed-1-6'],
    defaultModel: 'doubao-pro-32k',
    keyHint: '火山引擎 API Key',
    keyMinLength: 16,
  },
]

export const providerById = (id: string) => MODEL_PROVIDERS.find((p) => p.id === id)

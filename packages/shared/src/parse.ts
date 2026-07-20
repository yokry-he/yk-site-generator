import type { ArtifactFile, ArtifactFileTree } from './types'

/* ============ 模型输出解析器(SF-1-3 / SF-1-5 的关键依赖)============ */

/** 输出协议中的文件清单(模型在 fenced json 块中给出) */
export interface ModelManifest {
  files: { path: string; description?: string }[]
}

export interface ParseResult {
  tree: ArtifactFileTree
  /** 解析到的文件清单(没有则为 undefined,即降级模式) */
  manifest?: ModelManifest
  /** 解析过程中的容错记录 */
  warnings: string[]
}

interface FencedBlock {
  info: string
  body: string
}

/** 常见的语言 info 串(不是文件路径) */
const LANG_TOKENS = new Set([
  'html', 'css', 'js', 'javascript', 'ts', 'typescript', 'json', 'xml', 'svg',
  'vue', 'jsx', 'tsx', 'md', 'markdown', 'txt', 'text', 'bash', 'sh',
])

const LANG_FALLBACK_PATH: Record<string, string> = {
  html: 'index.html',
  css: 'styles.css',
  js: 'main.js',
  javascript: 'main.js',
}

function extractFencedBlocks(text: string, warnings?: string[]): FencedBlock[] {
  const blocks: FencedBlock[] = []
  const re = /```([^\n`]*)\n([\s\S]*?)```/g
  let lastEnd = 0
  for (const m of text.matchAll(re)) {
    blocks.push({ info: m[1].trim(), body: m[2] })
    lastEnd = (m.index ?? 0) + m[0].length
  }
  // 容错:模型输出被 max_tokens 截断时,最后一个 fence 未闭合——按 EOF 闭合抢救
  const tail = text.slice(lastEnd)
  const open = tail.match(/```([^\n`]*)\n([\s\S]+)$/)
  if (open && open[2].trim()) {
    blocks.push({ info: (open[1] ?? '').trim(), body: open[2] })
    warnings?.push('最后一个代码块未闭合(疑似输出截断),已按 EOF 抢救')
  }
  return blocks
}

function tryParseManifest(body: string): ModelManifest | undefined {
  try {
    const parsed = JSON.parse(body) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as ModelManifest).files) &&
      (parsed as ModelManifest).files.every(
        (f) => f && typeof f === 'object' && typeof (f as { path?: unknown }).path === 'string',
      )
    ) {
      return parsed as ModelManifest
    }
  } catch {
    /* 不是合法 JSON,按普通文件块处理 */
  }
  return undefined
}

/** 从 info 串提取文件路径:`html path="index.html"` 或 `index.html` */
function pathFromInfo(info: string): string | undefined {
  const m = info.match(/path\s*=\s*["']([^"']+)["']/i)
  if (m) return m[1]
  const token = info.split(/\s+/)[0]
  if (token && /^[\w\-./]+\.[a-z0-9]+$/i.test(token) && !LANG_TOKENS.has(token.toLowerCase())) {
    return token
  }
  return undefined
}

function langOf(info: string): string {
  return (info.split(/\s+/)[0] ?? '').toLowerCase()
}

/**
 * 解析 LLM 输出为文件树。
 * 协议:先一个 ```json 文件清单块,再逐个带路径标注的 fenced code 块。
 * 容错:
 * - 无清单 → 按块语言/顺序推断路径(降级)
 * - 多余散文 → 忽略
 * - 完全无代码块但含 <html> → 整体按单 HTML 处理
 * - 以上都不行 → 返回 null
 */
export function parseModelOutput(text: string): ParseResult | null {
  const warnings: string[] = []
  const blocks = extractFencedBlocks(text, warnings)

  if (blocks.length === 0) {
    if (/<html[\s>]/i.test(text)) {
      warnings.push('无 fenced code 块,整体按单 HTML 处理')
      return {
        tree: { files: [{ path: 'index.html', content: text.trim() }], entry: 'index.html' },
        warnings,
      }
    }
    return null
  }

  // 1. 找文件清单(第一个能解析为 { files: [...] } 的 json 块)
  let manifest: ModelManifest | undefined
  const fileBlocks: FencedBlock[] = []
  for (const b of blocks) {
    if (!manifest && (langOf(b.info) === 'json' || langOf(b.info) === '')) {
      const m = tryParseManifest(b.body)
      if (m) {
        manifest = m
        continue
      }
    }
    fileBlocks.push(b)
  }
  if (!manifest) warnings.push('未找到文件清单,按降级模式推断文件路径')

  // 2. 逐个文件块确定路径
  const files: ArtifactFile[] = []
  const used = new Set<string>()
  const dedupe = (p: string) => {
    let candidate = p
    let n = 2
    while (used.has(candidate)) {
      const dot = p.lastIndexOf('.')
      candidate = dot > 0 ? `${p.slice(0, dot)}-${n}${p.slice(dot)}` : `${p}-${n}`
      n += 1
    }
    used.add(candidate)
    return candidate
  }

  let fallbackN = 0
  for (const b of fileBlocks) {
    const lang = langOf(b.info)
    if (lang === 'json' && !manifest) {
      // 清单解析失败的 json 块,作为数据文件保留
    }
    let path = pathFromInfo(b.info)
    if (!path && manifest) {
      // 用清单按语言匹配第一个未使用的候选路径
      const ext = lang === 'javascript' ? 'js' : lang
      const hit = manifest.files.find((f) => !used.has(f.path) && f.path.endsWith(`.${ext}`))
      if (hit) path = hit.path
    }
    if (!path) {
      path = LANG_FALLBACK_PATH[lang] ?? `assets/file-${++fallbackN}.${lang || 'txt'}`
    }
    files.push({ path: dedupe(path), content: b.body.replace(/^\n|\n$/g, '') })
  }

  if (files.length === 0) return null

  // 3. 入口:优先 index.html,其次任意 .html,否则第一个文件
  const entry =
    files.find((f) => f.path === 'index.html')?.path ??
    files.find((f) => f.path.endsWith('.html'))?.path ??
    files[0].path
  if (entry !== 'index.html') warnings.push(`入口文件为 ${entry}(未找到 index.html)`)

  return { tree: { files, entry }, manifest, warnings }
}

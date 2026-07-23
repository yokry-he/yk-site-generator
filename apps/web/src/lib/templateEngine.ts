import JSZip from 'jszip'

/** 变量语法:$M{xxx.yyy} */
export const VAR_RE = /\$M\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}/g
export const IF_RE = /\$M\{if\s+([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}/g
const CONTROL_RE = /\$M\{if\s+([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}|\$M\{else\}|\$M\{endif\}/g

export type TemplateValue = string | boolean
export type TemplateVariableKind = 'text' | 'boolean'

const TEXT_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'scss', 'less', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'json', 'md', 'markdown', 'txt', 'svg', 'xml', 'yml', 'yaml', 'vue', 'svelte',
  'py', 'java', 'go', 'rs', 'c', 'h', 'cpp', 'cs', 'rb', 'php', 'sh', 'bash',
  'toml', 'ini', 'cfg', 'conf', 'env', 'gitignore', 'editorconfig', 'csv', 'sql',
])

export interface TemplateFileEntry {
  path: string
  isText: boolean
  /** 命中的普通变量 → 出现次数 */
  varHits: Record<string, number>
  /** 命中的条件变量 → 出现次数 */
  conditionHits: Record<string, number>
  /** 文本内容(仅文本文件) */
  content?: string
  /** 原始二进制(仅二进制文件) */
  binary?: Uint8Array
}

export interface TemplateVariableMeta {
  files: string[]
  count: number
  kind: TemplateVariableKind
}

export interface ParsedTemplate {
  files: TemplateFileEntry[]
  /** 变量名 → 文件、次数和表单类型 */
  variables: Record<string, TemplateVariableMeta>
}

function isProbablyText(path: string, bytes: Uint8Array): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXTENSIONS.has(ext)) return true
  const probe = bytes.slice(0, 4096)
  for (let i = 0; i < probe.length; i += 1) {
    if (probe[i] === 0) return false
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(probe)
    return true
  } catch {
    return false
  }
}

function recordVariable(
  variables: ParsedTemplate['variables'],
  name: string,
  path: string,
  count: number,
  kind: TemplateVariableKind,
): void {
  const current = variables[name]
  if (!current) {
    variables[name] = { files: [path], count, kind }
    return
  }
  if (!current.files.includes(path)) current.files.push(path)
  current.count += count
  // 条件变量优先作为开关展示;同名普通变量仍可在内容里替换为 true/false。
  if (kind === 'boolean') current.kind = 'boolean'
}

/** 解析 JSZip 对象为模板结构 */
export async function parseZip(zip: JSZip): Promise<ParsedTemplate> {
  const files: TemplateFileEntry[] = []
  const variables: ParsedTemplate['variables'] = {}

  const entries = Object.values(zip.files).filter((file) => !file.dir)
  for (const entry of entries) {
    const bytes = await entry.async('uint8array')
    if (!isProbablyText(entry.name, bytes)) {
      files.push({ path: entry.name, isText: false, varHits: {}, conditionHits: {}, binary: bytes })
      continue
    }
    const content = new TextDecoder('utf-8').decode(bytes)
    const varHits: Record<string, number> = {}
    const conditionHits: Record<string, number> = {}
    for (const match of content.matchAll(VAR_RE)) {
      const name = match[1]
      varHits[name] = (varHits[name] ?? 0) + 1
    }
    for (const match of content.matchAll(IF_RE)) {
      const name = match[1]
      conditionHits[name] = (conditionHits[name] ?? 0) + 1
    }
    for (const [name, count] of Object.entries(varHits)) {
      recordVariable(variables, name, entry.name, count, 'text')
    }
    for (const [name, count] of Object.entries(conditionHits)) {
      recordVariable(variables, name, entry.name, count, 'boolean')
    }
    files.push({ path: entry.name, isText: true, varHits, conditionHits, content })
  }

  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, variables }
}

export async function parseZipFile(file: File | Blob): Promise<ParsedTemplate> {
  const zip = await JSZip.loadAsync(file)
  return parseZip(zip)
}

/** 变量按点号前缀分组 */
export function groupVariables(variables: ParsedTemplate['variables']) {
  const groups: Record<string, string[]> = {}
  for (const name of Object.keys(variables).sort()) {
    const prefix = name.includes('.') ? name.split('.')[0] : '通用'
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push(name)
  }
  return groups
}

const SAMPLE_VALUE_MAP: Record<string, string> = {
  'site.title': '林小满的个人主页',
  'site.description': '前端工程师 / 摄影爱好者,记录代码与光。',
  'site.author': '林小满',
  'site.url': 'https://linxiaoman.example.com',
  'site.year': '2026',
  'user.name': '林小满',
  'user.bio': '白天写前端,晚上拍星空。相信好的产品和好的照片一样,都需要耐心打磨。',
  'user.email': 'hello@linxiaoman.example.com',
  'user.github': 'linxiaoman',
  'user.location': '杭州',
  'nav.home': '首页',
  'nav.about': '关于',
  'nav.blog': '博客',
}

export function sampleValueFor(name: string): string {
  if (SAMPLE_VALUE_MAP[name]) return SAMPLE_VALUE_MAP[name]
  const leaf = name.split('.').pop() ?? name
  return `示例${leaf}`
}

export function truthyTemplateValue(value: TemplateValue | undefined): boolean {
  if (typeof value === 'boolean') return value
  if (value === undefined) return false
  return ['1', 'true', 'yes', 'on', '是', '显示', '启用'].includes(value.trim().toLowerCase())
}

export interface RenderTextResult {
  content: string
  replacedCount: number
  evaluatedConditions: number
  warnings: string[]
}

/**
 * 渲染单个文本文件。条件块支持嵌套和 else;语法错误时保留可见内容并返回警告。
 */
export function renderTemplateText(
  source: string,
  values: Record<string, TemplateValue>,
  keepUnfilled: boolean,
): RenderTextResult {
  interface Frame {
    parentActive: boolean
    condition: boolean
    active: boolean
    elseSeen: boolean
  }
  const frames: Frame[] = []
  const warnings: string[] = []
  let cursor = 0
  let output = ''
  let evaluatedConditions = 0
  const isActive = () => frames.every((frame) => frame.active)

  CONTROL_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = CONTROL_RE.exec(source))) {
    if (isActive()) output += source.slice(cursor, match.index)
    const token = match[0]
    const conditionName = match[1]
    if (conditionName) {
      const parentActive = isActive()
      const condition = truthyTemplateValue(values[conditionName])
      frames.push({ parentActive, condition, active: parentActive && condition, elseSeen: false })
      evaluatedConditions += 1
    } else if (token === '$M{else}') {
      const frame = frames[frames.length - 1]
      if (!frame) {
        warnings.push('发现没有对应 if 的 else')
        if (isActive()) output += token
      } else if (frame.elseSeen) {
        warnings.push('同一条件块出现多个 else')
      } else {
        frame.elseSeen = true
        frame.active = frame.parentActive && !frame.condition
      }
    } else {
      const frame = frames.pop()
      if (!frame) {
        warnings.push('发现没有对应 if 的 endif')
        if (isActive()) output += token
      }
    }
    cursor = match.index + token.length
  }
  if (isActive()) output += source.slice(cursor)
  if (frames.length > 0) warnings.push(`有 ${frames.length} 个条件块缺少 endif`)

  let replacedCount = 0
  const content = output.replace(VAR_RE, (raw, name: string) => {
    const value = values[name]
    if (typeof value === 'boolean') {
      replacedCount += 1
      return value ? 'true' : 'false'
    }
    if (value !== undefined && value.trim() !== '') {
      replacedCount += 1
      return value
    }
    return keepUnfilled ? raw : ''
  })

  return { content, replacedCount, evaluatedConditions, warnings }
}

export interface GenerateResult {
  blob: Blob
  replacedCount: number
  affectedFiles: number
  evaluatedConditions: number
  warnings: string[]
}

/** 执行条件渲染与变量替换并重新打包 */
export async function generateZip(
  parsed: ParsedTemplate,
  values: Record<string, TemplateValue>,
  keepUnfilled: boolean,
): Promise<GenerateResult> {
  const out = new JSZip()
  let replacedCount = 0
  let affectedFiles = 0
  let evaluatedConditions = 0
  const warnings: string[] = []

  for (const file of parsed.files) {
    if (!file.isText || file.content === undefined) {
      out.file(file.path, file.binary ?? new Uint8Array())
      continue
    }
    const result = renderTemplateText(file.content, values, keepUnfilled)
    if (result.replacedCount > 0 || result.evaluatedConditions > 0) affectedFiles += 1
    replacedCount += result.replacedCount
    evaluatedConditions += result.evaluatedConditions
    warnings.push(...result.warnings.map((warning) => `${file.path}: ${warning}`))
    out.file(file.path, result.content)
  }

  const blob = await out.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return { blob, replacedCount, affectedFiles, evaluatedConditions, warnings }
}

function findTextFile(parsed: ParsedTemplate, path: string): TemplateFileEntry | undefined {
  const normalized = path.replace(/^\.\//, '')
  return parsed.files.find((file) => file.isText && file.path.replace(/^\.\//, '') === normalized)
}

/** 将模板入口 HTML 的本地 CSS/JS 内联,供变量修改时实时 iframe 预览。 */
export function renderTemplatePreview(
  parsed: ParsedTemplate,
  values: Record<string, TemplateValue>,
  keepUnfilled: boolean,
): string | null {
  const entry =
    findTextFile(parsed, 'index.html') ??
    parsed.files.find((file) => file.isText && /\.html?$/i.test(file.path))
  if (!entry?.content) return null
  let html = renderTemplateText(entry.content, values, keepUnfilled).content

  html = html.replace(/<link\b([^>]*?)href=["']([^"']+)["']([^>]*)>/gi, (raw, before: string, href: string, after: string) => {
    if (!/\brel=["']stylesheet["']/i.test(`${before} ${after}`)) return raw
    const file = findTextFile(parsed, href)
    if (!file?.content) return raw
    const css = renderTemplateText(file.content, values, keepUnfilled).content
    return `<style data-sf-preview-src="${href}">\n${css}\n</style>`
  })
  html = html.replace(/<script\b([^>]*?)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (_raw, _before: string, src: string) => {
    const file = findTextFile(parsed, src)
    if (!file?.content) return _raw
    const script = renderTemplateText(file.content, values, keepUnfilled).content
    return `<script data-sf-preview-src="${src}">\n${script}\n<\/script>`
  })
  return html
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/* ============ 内置示例模板:个人主页 ============ */

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const SAMPLE_TEXT_FILES: Record<string, string> = {
  'index.html': `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>$M{site.title}</title>
  <meta name="description" content="$M{site.description}" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <nav>
    <strong>$M{site.title}</strong>
    <div>
      <a href="#">$M{nav.home}</a>
      <a href="#about">$M{nav.about}</a>
      $M{if features.showBlog}<a href="#blog">$M{nav.blog}</a>$M{endif}
    </div>
  </nav>
  <header class="hero">
    <h1>你好,我是 $M{user.name}</h1>
    <p>$M{user.bio}</p>
    $M{if features.showLocation}<p class="location">📍 $M{user.location}</p>$M{endif}
  </header>
  $M{if features.showBlog}
  <section id="blog" class="blog"><h2>最近文章</h2><p>这里展示你的最新内容。</p></section>
  $M{else}
  <section class="contact"><h2>保持联系</h2><p>$M{user.email}</p></section>
  $M{endif}
  <footer>
    <p>© $M{site.year} $M{site.author} · $M{user.email}</p>
  </footer>
</body>
</html>
`,
  'styles.css': `:root {
  --bg: #0b0b10;
  --text: #f4f4f5;
  --accent: #8b5cf6;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: 'PingFang SC', sans-serif; }
nav { display: flex; justify-content: space-between; padding: 20px 32px; }
nav a { color: #c4b5fd; margin-left: 16px; text-decoration: none; }
.hero { text-align: center; padding: 96px 24px; }
.hero h1 { font-size: clamp(36px, 6vw, 64px); margin-bottom: 16px; }
.hero p { color: #a1a1aa; max-width: 680px; margin: 10px auto; line-height: 1.8; }
.blog,.contact { max-width: 760px; margin: 0 auto; padding: 48px 24px; text-align:center; border-top:1px solid #ffffff14; }
footer { padding: 32px; text-align:center; color:#71717a; }
`,
  'about.md': `# 关于 $M{user.name}

$M{user.bio}

$M{if features.showLocation}- 坐标:$M{user.location}$M{endif}
- 邮箱:$M{user.email}
- GitHub:https://github.com/$M{user.github}

> 本站由 SiteForge 模板生成器构建,© $M{site.year} $M{site.author}
`,
  'site.config.json': `{
  "title": "$M{site.title}",
  "description": "$M{site.description}",
  "author": "$M{site.author}",
  "url": "$M{site.url}",
  "showBlog": "$M{features.showBlog}"
}
`,
}

export const SAMPLE_TEMPLATE_NAME = 'personal-homepage'

export async function loadSampleTemplate(): Promise<ParsedTemplate> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(SAMPLE_TEXT_FILES)) zip.file(path, content)
  zip.file('assets/favicon.png', base64ToBytes(TINY_PNG_BASE64))
  return parseZip(zip)
}

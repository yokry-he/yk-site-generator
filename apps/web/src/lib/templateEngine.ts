import JSZip from 'jszip'

/** 变量语法:$M{xxx.yyy} */
export const VAR_RE = /\$M\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}/g

const TEXT_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'scss', 'less', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx',
  'json', 'md', 'markdown', 'txt', 'svg', 'xml', 'yml', 'yaml', 'vue', 'svelte',
  'py', 'java', 'go', 'rs', 'c', 'h', 'cpp', 'cs', 'rb', 'php', 'sh', 'bash',
  'toml', 'ini', 'cfg', 'conf', 'env', 'gitignore', 'editorconfig', 'csv', 'sql',
])

export interface TemplateFileEntry {
  path: string
  isText: boolean
  /** 命中的变量 → 出现次数 */
  varHits: Record<string, number>
  /** 文本内容(仅文本文件) */
  content?: string
  /** 原始二进制(仅二进制文件) */
  binary?: Uint8Array
}

export interface ParsedTemplate {
  files: TemplateFileEntry[]
  /** 变量名 → { files: 出现的文件列表, count: 总命中数 } */
  variables: Record<string, { files: string[]; count: number }>
}

function isProbablyText(path: string, bytes: Uint8Array): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (TEXT_EXTENSIONS.has(ext)) return true
  // 无扩展名或未知扩展名:检查前 4KB 是否含 NUL 字节
  const probe = bytes.slice(0, 4096)
  for (let i = 0; i < probe.length; i++) {
    if (probe[i] === 0) return false
  }
  // 尝试 UTF-8 解码
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(probe)
    return true
  } catch {
    return false
  }
}

/** 解析 JSZip 对象为模板结构 */
export async function parseZip(zip: JSZip): Promise<ParsedTemplate> {
  const files: TemplateFileEntry[] = []
  const variables: ParsedTemplate['variables'] = {}

  const entries = Object.values(zip.files).filter((f) => !f.dir)
  for (const entry of entries) {
    const bytes = await entry.async('uint8array')
    if (!isProbablyText(entry.name, bytes)) {
      files.push({ path: entry.name, isText: false, varHits: {}, binary: bytes })
      continue
    }
    const content = new TextDecoder('utf-8').decode(bytes)
    const varHits: Record<string, number> = {}
    for (const match of content.matchAll(VAR_RE)) {
      const name = match[1]
      varHits[name] = (varHits[name] ?? 0) + 1
    }
    for (const [name, count] of Object.entries(varHits)) {
      if (!variables[name]) variables[name] = { files: [], count: 0 }
      variables[name].files.push(entry.name)
      variables[name].count += count
    }
    files.push({ path: entry.name, isText: true, varHits, content })
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
  'site.year': '2025',
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

export interface GenerateResult {
  blob: Blob
  replacedCount: number
  affectedFiles: number
}

/** 执行变量替换并重新打包 */
export async function generateZip(
  parsed: ParsedTemplate,
  values: Record<string, string>,
  keepUnfilled: boolean,
): Promise<GenerateResult> {
  const out = new JSZip()
  let replacedCount = 0
  let affectedFiles = 0

  for (const file of parsed.files) {
    if (!file.isText || file.content === undefined) {
      out.file(file.path, file.binary ?? new Uint8Array())
      continue
    }
    let fileReplaced = 0
    const next = file.content.replace(VAR_RE, (raw, name: string) => {
      const value = values[name]
      if (value && value.trim() !== '') {
        fileReplaced += 1
        return value
      }
      return keepUnfilled ? raw : ''
    })
    if (fileReplaced > 0) {
      replacedCount += fileReplaced
      affectedFiles += 1
    }
    out.file(file.path, next)
  }

  const blob = await out.generateAsync({ type: 'blob' })
  return { blob, replacedCount, affectedFiles }
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ============ 内置示例模板:个人主页 ============ */

// 1x1 透明 PNG,用于演示二进制文件原样拷贝
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
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
      <a href="#blog">$M{nav.blog}</a>
    </div>
  </nav>
  <header class="hero">
    <h1>你好,我是 $M{user.name}</h1>
    <p>$M{user.bio}</p>
    <p class="location">📍 $M{user.location}</p>
  </header>
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
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'PingFang SC', sans-serif;
}
nav {
  display: flex;
  justify-content: space-between;
  padding: 20px 32px;
}
.hero {
  text-align: center;
  padding: 96px 24px;
}
.hero h1 { font-size: 40px; }
.hero p { color: #a1a1aa; }
`,
  'about.md': `# 关于 $M{user.name}

$M{user.bio}

- 坐标:$M{user.location}
- 邮箱:$M{user.email}
- GitHub:https://github.com/$M{user.github}

> 本站由 SiteForge 模板生成器构建,© $M{site.year} $M{site.author}
`,
  'site.config.json': `{
  "title": "$M{site.title}",
  "description": "$M{site.description}",
  "author": "$M{site.author}",
  "url": "$M{site.url}",
  "nav": ["$M{nav.home}", "$M{nav.about}", "$M{nav.blog}"]
}
`,
}

export const SAMPLE_TEMPLATE_NAME = 'personal-homepage'

export async function loadSampleTemplate(): Promise<ParsedTemplate> {
  const zip = new JSZip()
  for (const [path, content] of Object.entries(SAMPLE_TEXT_FILES)) {
    zip.file(path, content)
  }
  zip.file('assets/favicon.png', base64ToBytes(TINY_PNG_BASE64))
  return parseZip(zip)
}

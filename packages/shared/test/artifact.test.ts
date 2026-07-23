import { describe, expect, it } from 'vitest'
import {
  HEAD_SLOT_NAMES,
  analyzeHeadCompleteness,
  artifactToSingleHtml,
  defaultHeadSlots,
  deriveSeoDescription,
  deriveSeoTitle,
  injectHeadSlots,
  injectSeoHead,
  singleHtmlToArtifact,
  type ArtifactMeta,
  type ArtifactFileTree,
} from '../src/index'

const meta: ArtifactMeta = {
  id: 't1',
  siteType: 'personal',
  title: '测试站',
  requirement: '一个测试',
  createdAt: '2026-01-01T00:00:00Z',
  iteration: 1,
}

function makeTree(): ArtifactFileTree {
  const indexHtml = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8">',
    '<link rel="stylesheet" href="styles.css">',
    '</head>',
    '<body>',
    '<h1>你好</h1>',
    '<script src="main.js"></script>',
    '</body>',
    '</html>',
  ].join('\n')
  return {
    entry: 'index.html',
    files: [
      { path: 'index.html', content: indexHtml },
      { path: 'styles.css', content: 'body { color: #333; }' },
      { path: 'main.js', content: "console.log('hi');" },
    ],
  }
}

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length
}

describe('artifactToSingleHtml', () => {
  it('包含全部标准 head 槽位标记', () => {
    const html = artifactToSingleHtml(makeTree(), meta)
    for (const name of HEAD_SLOT_NAMES) {
      expect(html).toContain(`<!-- @sf:slot:${name} -->`)
      expect(html).toContain('<!-- /@sf:slot -->')
    }
  })

  it('内联 CSS/JS 并带 data-sf-src 标注', () => {
    const html = artifactToSingleHtml(makeTree(), meta)
    expect(html).toContain('<style data-sf-src="styles.css">')
    expect(html).toContain('<script data-sf-src="main.js">')
    expect(html).toContain('body { color: #333; }')
    expect(html).toContain("console.log('hi');")
    expect(html).not.toContain('<link rel="stylesheet" href="styles.css">')
    expect(html).not.toContain('<script src="main.js"></script>')
  })

  it('从正文推导 title,并写入完整 SEO/OG/Twitter 标签', () => {
    const tree = makeTree()
    const entry = tree.files.find((f) => f.path === tree.entry)?.content ?? ''
    const html = artifactToSingleHtml(tree, meta)
    const slots = defaultHeadSlots(meta, entry)
    expect(deriveSeoTitle(meta, entry)).toBe('你好')
    expect(deriveSeoDescription(meta, entry)).toBe('一个测试')
    expect(html).toContain(slots.title)
    expect(html).toContain(slots.og.split('\n')[0])
    expect(html).toContain(slots.twitter.split('\n')[0])
    expect(analyzeHeadCompleteness(html).complete).toBe(true)
  })

  it('清理模型原有同类标签,避免重复 title/meta', () => {
    const tree = makeTree()
    const entry = tree.files.find((f) => f.path === tree.entry)!
    entry.content = entry.content.replace(
      '<meta charset="UTF-8">',
      [
        '<meta charset="GBK">',
        '<meta name="viewport" content="width=320">',
        '<meta name="description" content="旧摘要">',
        '<meta property="og:title" content="旧标题">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<title>内容标题</title>',
      ].join('\n'),
    )
    const html = artifactToSingleHtml(tree, meta)
    expect(count(html, /<title\b/gi)).toBe(1)
    expect(count(html, /<meta\b[^>]*\bcharset\s*=/gi)).toBe(1)
    expect(count(html, /<meta\b[^>]*name="viewport"/gi)).toBe(1)
    expect(count(html, /<meta\b[^>]*name="description"/gi)).toBe(1)
    expect(count(html, /<meta\b[^>]*property="og:title"/gi)).toBe(1)
    expect(count(html, /<meta\b[^>]*name="twitter:card"/gi)).toBe(1)
    expect(html).toContain('<title>内容标题</title>')
    expect(html).not.toContain('content="旧摘要"')
  })

  it('二进制文件以注释标注而非内联', () => {
    const tree = makeTree()
    tree.files.push({ path: 'assets/logo.png', content: '', binary: true })
    const html = artifactToSingleHtml(tree, meta)
    expect(html).toContain('assets/logo.png')
  })
})

describe('round-trip 稳定性', () => {
  it('tree -> html -> tree -> html 完全相等,路径集合一致', () => {
    const tree = makeTree()
    const html1 = artifactToSingleHtml(tree, meta)
    const tree2 = singleHtmlToArtifact(html1)
    expect(tree2.entry).toBe('index.html')
    expect(tree2.files.map((f) => f.path).sort()).toEqual(
      ['index.html', 'main.js', 'styles.css'].sort(),
    )
    const html2 = artifactToSingleHtml(tree2, meta)
    expect(html2).toBe(html1)
  })

  it('再次往返依然稳定(幂等)', () => {
    const html1 = artifactToSingleHtml(makeTree(), meta)
    const html2 = artifactToSingleHtml(singleHtmlToArtifact(html1), meta)
    const html3 = artifactToSingleHtml(singleHtmlToArtifact(html2), meta)
    expect(html3).toBe(html2)
  })
})

describe('singleHtmlToArtifact 容错', () => {
  it('未标注的内联 style/script 归入 styles/ 与 scripts/', () => {
    const html = [
      '<!DOCTYPE html>',
      '<html><head>',
      '<style>body { margin: 0; }</style>',
      '</head><body>',
      '<script>var a = 1;</script>',
      '</body></html>',
    ].join('\n')
    const tree = singleHtmlToArtifact(html)
    const paths = tree.files.map((f) => f.path)
    expect(paths).toContain('index.html')
    expect(paths).toContain('styles/inline-1.css')
    expect(paths).toContain('scripts/inline-1.js')
  })
})

describe('injectSeoHead', () => {
  it('无 head 时自动创建并通过完整性检查', () => {
    const html = injectSeoHead('<html><body><h1>无 head 页面</h1><p>页面摘要</p></body></html>', meta)
    expect(html).toContain('<head>')
    expect(html).toContain('<title>无 head 页面</title>')
    expect(analyzeHeadCompleteness(html)).toMatchObject({ complete: true, missing: [] })
  })

  it('保留不属于 SEO 管理范围的 head 标签', () => {
    const raw = '<html><head><link rel="icon" href="/favicon.svg"><meta name="robots" content="index"></head><body></body></html>'
    const html = injectSeoHead(raw, meta)
    expect(html).toContain('<link rel="icon" href="/favicon.svg">')
    expect(html).toContain('<meta name="robots" content="index">')
  })
})

describe('injectHeadSlots', () => {
  it('替换已有槽位内容', () => {
    const html = artifactToSingleHtml(makeTree(), meta)
    const updated = injectHeadSlots(html, { title: '<title>新标题</title>' })
    expect(updated).toContain('<title>新标题</title>')
    expect(updated).not.toContain('<title>你好</title>')
  })

  it('对不存在槽位标记的 HTML 不新增槽位', () => {
    const raw = '<html><head></head><body></body></html>'
    const updated = injectHeadSlots(raw, { title: 'X' })
    expect(updated).toBe(raw)
  })
})

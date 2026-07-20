import { describe, expect, it } from 'vitest'
import { parseModelOutput } from '../src/index'

const sampleHtml = '<!DOCTYPE html><html><head><title>示例</title></head><body><h1>你好</h1></body></html>'

describe('parseModelOutput：正常路径（清单 + path 标注）', () => {
  const output = [
    '好的，下面是为你生成的站点文件。',
    '',
    '```json',
    JSON.stringify({
      files: [
        { path: 'index.html', description: '入口页' },
        { path: 'styles.css', description: '全局样式' },
      ],
    }),
    '```',
    '',
    '```html path="index.html"',
    sampleHtml,
    '```',
    '',
    '```css path="styles.css"',
    'body { color: #111; }',
    '```',
  ].join('\n')

  it('解析出清单、文件树与入口', () => {
    const result = parseModelOutput(output)
    expect(result).not.toBeNull()
    expect(result!.manifest).toBeDefined()
    expect(result!.manifest!.files).toHaveLength(2)
    expect(result!.tree.entry).toBe('index.html')
    const paths = result!.tree.files.map((f) => f.path).sort()
    expect(paths).toEqual(['index.html', 'styles.css'])
    expect(result!.tree.files.find((f) => f.path === 'styles.css')!.content).toBe(
      'body { color: #111; }',
    )
  })

  it('清单之外的散文被忽略，不产生额外文件', () => {
    expect(result_file_count(output)).toBe(2)
  })
})

function result_file_count(output: string): number {
  const r = parseModelOutput(output)
  return r ? r.tree.files.length : -1
}

describe('parseModelOutput：降级路径（无清单）', () => {
  it('单个 html fenced 块降级为 index.html 并给出警告', () => {
    const output = ['这是你的网站：', '', '```html', sampleHtml, '```'].join('\n')
    const result = parseModelOutput(output)
    expect(result).not.toBeNull()
    expect(result!.manifest).toBeUndefined()
    expect(result!.tree.entry).toBe('index.html')
    expect(result!.tree.files).toHaveLength(1)
    expect(result!.tree.files[0].path).toBe('index.html')
    expect(result!.warnings.length).toBeGreaterThan(0)
  })

  it('多个无 path 标注块按语言 fallback 命名', () => {
    const output = [
      '```html',
      sampleHtml,
      '```',
      '```css',
      'a { color: red; }',
      '```',
      '```javascript',
      'console.log(1);',
      '```',
    ].join('\n')
    const result = parseModelOutput(output)!
    const paths = result.tree.files.map((f) => f.path).sort()
    expect(paths).toEqual(['index.html', 'main.js', 'styles.css'])
  })

  it('散文中混入未闭合 html（无 fence）时按整体单文件处理', () => {
    const output = `为你生成了页面：\n${sampleHtml}\n希望你喜欢。`
    const result = parseModelOutput(output)
    expect(result).not.toBeNull()
    expect(result!.tree.files).toHaveLength(1)
    expect(result!.tree.files[0].path).toBe('index.html')
  })
})

describe('parseModelOutput：畸形输入', () => {
  it('纯散文（无 fence、无 html）返回 null', () => {
    expect(parseModelOutput('抱歉，我无法完成这个请求，请换个说法。')).toBeNull()
  })

  it('空字符串返回 null', () => {
    expect(parseModelOutput('')).toBeNull()
  })

  it('清单 JSON 畸形时降级而不崩溃', () => {
    const output = [
      '```json',
      '{ files: [oops',
      '```',
      '',
      '```html path="index.html"',
      sampleHtml,
      '```',
    ].join('\n')
    const result = parseModelOutput(output)
    expect(result).not.toBeNull()
    expect(result!.manifest).toBeUndefined()
    expect(result!.tree.entry).toBe('index.html')
  })

  it('path 标注重复时自动去重加后缀', () => {
    const output = [
      '```css path="styles.css"',
      'a { color: red; }',
      '```',
      '```css path="styles.css"',
      'b { color: blue; }',
      '```',
    ].join('\n')
    const result = parseModelOutput(output)!
    const paths = result.tree.files.map((f) => f.path).sort()
    expect(paths).toEqual(['styles-2.css', 'styles.css'])
  })

  it('末尾 fence 未闭合(输出截断)时按 EOF 抢救', () => {
    const output = [
      '```json',
      JSON.stringify({ files: [{ path: 'index.html' }] }),
      '```',
      '',
      '```html path="index.html"',
      sampleHtml,
      '<p>被截断的内容',
    ].join('\n')
    const result = parseModelOutput(output)
    expect(result).not.toBeNull()
    expect(result!.manifest).toBeDefined()
    expect(result!.tree.entry).toBe('index.html')
    expect(result!.tree.files[0].content).toContain('被截断的内容')
    expect(result!.warnings.some((w) => w.includes('未闭合'))).toBe(true)
  })
})

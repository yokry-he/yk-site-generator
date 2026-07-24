import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  generateZip,
  parseZip,
  renderTemplatePreview,
  renderTemplateText,
  truthyTemplateValue,
} from '../src/lib/templateEngine'

describe('模板条件引擎', () => {
  it('支持 if/else、嵌套条件与普通变量替换', () => {
    const source = [
      '<h1>$M{site.title}</h1>',
      '$M{if features.hero}<section>Hero',
      '$M{if features.cta}<button>$M{cta.label}</button>$M{endif}',
      '</section>$M{else}<p>Fallback</p>$M{endif}',
    ].join('')
    const enabled = renderTemplateText(
      source,
      {
        'site.title': '测试站',
        'features.hero': true,
        'features.cta': 'yes',
        'cta.label': '立即开始',
      },
      true,
    )
    expect(enabled.content).toContain('<h1>测试站</h1>')
    expect(enabled.content).toContain('<section>Hero')
    expect(enabled.content).toContain('<button>立即开始</button>')
    expect(enabled.content).not.toContain('Fallback')
    expect(enabled.evaluatedConditions).toBe(2)

    const disabled = renderTemplateText(source, { 'site.title': '测试站' }, true)
    expect(disabled.content).toContain('<p>Fallback</p>')
    expect(disabled.content).not.toContain('<section>')
  })

  it('兼容旧变量语法并可删除未填写值', () => {
    const source = '$M{a} / $M{b}'
    expect(renderTemplateText(source, { a: 'A' }, true).content).toBe('A / $M{b}')
    expect(renderTemplateText(source, { a: 'A' }, false).content).toBe('A / ')
  })

  it('对控制块语法错误返回警告而非崩溃', () => {
    const result = renderTemplateText('$M{else}x$M{if feature}y', { feature: true }, true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('布尔值解析覆盖表单常见输入', () => {
    expect(truthyTemplateValue(true)).toBe(true)
    expect(truthyTemplateValue('ON')).toBe(true)
    expect(truthyTemplateValue('是')).toBe(true)
    expect(truthyTemplateValue('false')).toBe(false)
  })
})

describe('模板 ZIP 与实时预览', () => {
  it('解析条件变量为 boolean,并在预览中内联本地 CSS', async () => {
    const zip = new JSZip()
    zip.file(
      'index.html',
      '<html><head><link rel="stylesheet" href="style.css"></head><body>$M{if show.hero}<h1>$M{title}</h1>$M{endif}</body></html>',
    )
    zip.file('style.css', 'h1{color:red}')
    const parsed = await parseZip(zip)
    expect(parsed.variables['show.hero'].kind).toBe('boolean')
    expect(parsed.variables.title.kind).toBe('text')
    const preview = renderTemplatePreview(parsed, { 'show.hero': true, title: '你好' }, true)
    expect(preview).toContain('<style data-sf-preview-src="style.css">')
    expect(preview).toContain('<h1>你好</h1>')
  })

  it('生成 ZIP 时计算条件并保留二进制文件', async () => {
    const zip = new JSZip()
    zip.file('index.html', '$M{if enabled}YES$M{else}NO$M{endif} $M{name}')
    zip.file('logo.bin', new Uint8Array([1, 2, 3]))
    const parsed = await parseZip(zip)
    const result = await generateZip(parsed, { enabled: true, name: 'SiteForge' }, true)
    expect(result.evaluatedConditions).toBe(1)
    expect(result.replacedCount).toBe(1)
    const output = await JSZip.loadAsync(await result.blob.arrayBuffer())
    expect(await output.file('index.html')!.async('string')).toBe('YES SiteForge')
    expect(Array.from(await output.file('logo.bin')!.async('uint8array'))).toEqual([1, 2, 3])
  })
})

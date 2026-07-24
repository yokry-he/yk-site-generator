import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildSiteZip } from '../src/lib/exportArtifact'

const html = '<!DOCTYPE html><html><head><style data-sf-src="styles.css">body{color:red}</style></head><body><h1>你好</h1><script data-sf-src="main.js">console.log(1)</script></body></html>'

describe('真实产物 ZIP 导出', () => {
  it('恢复文件树并写入元数据与使用说明', async () => {
    const blob = await buildSiteZip({
      html,
      title: '测试网站',
      siteType: 'personal',
      requirement: '一个测试网站',
      model: 'test-model',
      generatedAt: '2026-07-23T00:00:00.000Z',
    })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('index.html')).toBeTruthy()
    expect(await zip.file('styles.css')!.async('string')).toContain('color:red')
    expect(await zip.file('main.js')!.async('string')).toContain('console.log(1)')
    const meta = JSON.parse(await zip.file('siteforge.json')!.async('string'))
    expect(meta).toMatchObject({
      format: 'siteforge-export-v1',
      title: '测试网站',
      siteType: 'personal',
      entry: 'index.html',
    })
    expect(await zip.file('README.txt')!.async('string')).toContain('静态托管')
  })
})

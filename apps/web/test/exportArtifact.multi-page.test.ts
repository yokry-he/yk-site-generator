import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildSiteZip } from '../src/lib/exportArtifact'

const home = '<!doctype html><html><body>Home</body></html>'
const about = '<!doctype html><html><body>About</body></html>'

describe('multi-page export', () => {
  it('writes every route and a v2 manifest', async () => {
    const blob = await buildSiteZip({
      title: 'Multi page',
      siteType: 'business',
      homePageId: 'home',
      pages: [
        { id: 'home', title: 'Home', path: '/', html: home },
        { id: 'about', title: 'About', path: '/about', html: about },
      ],
    })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(await zip.file('index.html')?.async('string')).toBe(home)
    expect(await zip.file('about/index.html')?.async('string')).toBe(about)
    const manifest = JSON.parse(await zip.file('siteforge.json')!.async('string')) as { format: string; pages: Array<{ path: string; file: string }> }
    expect(manifest.format).toBe('siteforge-export-v2')
    expect(manifest.pages).toEqual([
      expect.objectContaining({ path: '/', file: 'index.html' }),
      expect.objectContaining({ path: '/about', file: 'about/index.html' }),
    ])
  })
})

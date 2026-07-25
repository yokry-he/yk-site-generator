import { describe, expect, it } from 'vitest'
import {
  canonicalSiteRequestPath,
  legacyHtmlSiteProject,
  normalizeSitePath,
  normalizeSiteProject,
  sitePageOutputPath,
  siteProjectHomePage,
  siteProjectPageForPath,
} from '../src/index'

describe('site project protocol', () => {
  it('migrates legacy html into a one-page project', () => {
    const document = legacyHtmlSiteProject('<!doctype html><html><body>home</body></html>')
    expect(document.homePageId).toBe('home')
    expect(document.pages).toEqual([
      expect.objectContaining({ id: 'home', title: '首页', path: '/' }),
    ])
    expect(siteProjectHomePage(document).html).toContain('home')
  })

  it('normalizes duplicate ids and paths while preserving a requested home page', () => {
    const document = normalizeSiteProject({
      homePageId: 'about',
      pages: [
        { id: 'home', title: '首页', path: '/', html: '<html>home</html>' },
        { id: 'about', title: '关于', path: '/about', html: '<html>about</html>' },
        { id: 'about', title: '团队', path: '/about', html: '<html>team</html>' },
      ],
    })

    expect(document.pages).toHaveLength(3)
    expect(new Set(document.pages.map((page) => page.id)).size).toBe(3)
    expect(new Set(document.pages.map((page) => page.path)).size).toBe(3)
    expect(siteProjectHomePage(document).title).toBe('关于')
    expect(siteProjectHomePage(document).path).toBe('/')
  })

  it('maps canonical public paths to static output files', () => {
    expect(normalizeSitePath(' /About/Team/ ')).toBe('/about/team')
    expect(sitePageOutputPath({ path: '/' })).toBe('index.html')
    expect(sitePageOutputPath({ path: '/about/team' })).toBe('about/team/index.html')
    expect(canonicalSiteRequestPath('/about/team/index.html')).toBe('/about/team')
    expect(canonicalSiteRequestPath('/../secret')).toBeNull()
  })

  it('finds a page by a request path', () => {
    const document = normalizeSiteProject({
      pages: [
        { id: 'home', title: 'Home', path: '/', html: '<html>home</html>' },
        { id: 'pricing', title: 'Pricing', path: '/pricing', html: '<html>pricing</html>' },
      ],
    })
    expect(siteProjectPageForPath(document, '/pricing/')?.id).toBe('pricing')
    expect(siteProjectPageForPath(document, '/missing')).toBeUndefined()
  })
})

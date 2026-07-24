import { describe, expect, it } from 'vitest'
import {
  STARTER_PROJECTS,
  getOfficialTemplate,
  getStarterProject,
  renderStarterProject,
} from '../src'

describe('built-in starter projects', () => {
  it('ships a curated, unique ready-to-use catalog', () => {
    expect(STARTER_PROJECTS.length).toBeGreaterThanOrEqual(6)
    expect(new Set(STARTER_PROJECTS.map((project) => project.id)).size).toBe(STARTER_PROJECTS.length)
    expect(new Set(STARTER_PROJECTS.map((project) => project.slug)).size).toBe(STARTER_PROJECTS.length)
    expect(STARTER_PROJECTS.some((project) => project.featured)).toBe(true)
  })

  it('every project references a real official template and renders complete HTML', () => {
    for (const project of STARTER_PROJECTS) {
      expect(getOfficialTemplate(project.templateId)).toBeDefined()
      const html = renderStarterProject(project)
      expect(html).toMatch(/^<!doctype html>/i)
      expect(html).toContain('<meta name="viewport"')
      expect(html).toContain('<title>')
      expect(html).toContain('</html>')
      expect(html.toLowerCase()).not.toContain('lorem ipsum')
      expect(html).not.toContain('{{')
    }
  })

  it('looks up a project by id or slug and renders deterministically', () => {
    const first = STARTER_PROJECTS[0]
    expect(getStarterProject(first.id)).toEqual(first)
    expect(getStarterProject(first.slug)).toEqual(first)
    expect(renderStarterProject(first)).toBe(renderStarterProject(first))
    expect(getStarterProject('missing-project')).toBeUndefined()
  })
})

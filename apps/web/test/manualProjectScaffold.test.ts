import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { BACKEND_STACK_PROFILES } from 'shared'
import { buildManualProjectZip, createManualProjectScaffold } from '../src/lib/manualProjectScaffold'

describe('manual full-stack project scaffolds', () => {
  it('generates a runnable file baseline for every backend profile', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const scaffold = createManualProjectScaffold({
        name: `Example ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: true,
        includeGithubActions: true,
      })
      const paths = new Set(scaffold.files.map((file) => file.path))
      expect(scaffold.manifest.backend).toBe(profile.id)
      expect(scaffold.manifest.database).toBe(profile.recommendedDatabase)
      expect(paths).toContain('apps/web/package.json')
      expect(paths).toContain('apps/web/src/App.vue')
      expect(paths).toContain('apps/api/Dockerfile')
      expect(paths).toContain('docker-compose.yml')
      expect(paths).toContain('.github/workflows/ci.yml')
      expect(paths).toContain('siteforge.json')
      expect(scaffold.files.find((file) => file.path.includes('api'))?.content.length).toBeGreaterThan(20)
    }
  })

  it('rejects database combinations not supported by the selected stack', () => {
    expect(() => createManualProjectScaffold({
      name: 'Invalid Spring SQLite',
      backendStack: 'spring-boot-jpa',
      database: 'sqlite',
    })).toThrow(/暂不支持 SQLite/)
  })

  it('builds a ZIP containing the manifest and both services', async () => {
    const blob = await buildManualProjectZip({
      name: 'Task Studio',
      description: 'Manual project test',
      backendStack: 'fastapi-sqlalchemy',
      database: 'postgresql',
      includeDocker: true,
      includeGithubActions: false,
    })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('siteforge.json')).toBeTruthy()
    expect(zip.file('apps/web/src/App.vue')).toBeTruthy()
    expect(zip.file('apps/api/app/main.py')).toBeTruthy()
    expect(zip.file('docker-compose.yml')).toBeTruthy()
    expect(zip.file('.github/workflows/ci.yml')).toBeNull()
    const manifest = JSON.parse(await zip.file('siteforge.json')!.async('string'))
    expect(manifest).toMatchObject({
      projectKind: 'fullstack-app',
      backend: 'fastapi-sqlalchemy',
      database: 'postgresql',
    })
  })
})

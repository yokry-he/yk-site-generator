import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { BACKEND_STACK_PROFILES, type ManualEntityDefinition } from 'shared'
import { buildManualProjectZip, createManualProjectScaffold } from '../src/lib/manualProjectScaffold'

const articleEntity: ManualEntityDefinition = {
  name: 'Article',
  label: '文章',
  pluralLabel: '内容管理',
  route: '/articles',
  fields: [
    { name: 'title', label: '标题', type: 'text', required: true, unique: true, showInList: true, showInForm: true },
    { name: 'body', label: '正文', type: 'long-text', required: false, showInList: false, showInForm: true },
    { name: 'status', label: '状态', type: 'enum', required: true, enumValues: ['draft', 'published'], showInList: true, showInForm: true },
    { name: 'publishedAt', label: '发布时间', type: 'datetime', required: false, showInList: true, showInForm: true },
  ],
}

describe('manual full-stack project scaffolds', () => {
  it('generates frontend, CRUD, OpenAPI and database files for every backend profile', () => {
    for (const profile of BACKEND_STACK_PROFILES) {
      const scaffold = createManualProjectScaffold({
        name: `Example ${profile.shortName}`,
        backendStack: profile.id,
        database: profile.recommendedDatabase,
        includeDocker: true,
        includeGithubActions: true,
        entities: [articleEntity],
      })
      const paths = new Set(scaffold.files.map((file) => file.path))
      expect(scaffold.manifest.schemaVersion).toBe(2)
      expect(scaffold.manifest.backend).toBe(profile.id)
      expect(scaffold.manifest.database).toBe(profile.recommendedDatabase)
      expect(scaffold.manifest.entities).toHaveLength(1)
      expect(scaffold.manifest.entities[0]).toMatchObject(articleEntity)
      expect(paths.size).toBe(scaffold.files.length)
      expect(paths).toContain('apps/web/package.json')
      expect(paths).toContain('apps/web/src/App.vue')
      expect(paths).toContain('apps/web/src/resources.ts')
      expect(paths).toContain('apps/api/Dockerfile')
      expect(paths).toContain('docker-compose.yml')
      expect(paths).toContain('.github/workflows/ci.yml')
      expect(paths).toContain('siteforge.json')
      expect(paths).toContain('openapi.yaml')

      const combined = scaffold.files.map((file) => file.content).join('\n')
      expect(combined).toContain('/api/articles')
      expect(combined).toContain('Article')
      expect(combined).toContain('publishedAt')
    }
  })

  it('keeps generated migration versions and selected Go database drivers consistent', () => {
    const spring = createManualProjectScaffold({
      name: 'Spring Content',
      backendStack: 'spring-boot-jpa',
      database: 'postgresql',
      entities: [articleEntity],
    })
    const springMigrations = spring.files.filter((file) => file.path.includes('/db/migration/V1__'))
    expect(springMigrations).toHaveLength(1)
    expect(springMigrations[0].content).toContain('CREATE TABLE articles')
    expect(springMigrations[0].content).not.toContain('CREATE TABLE tasks')

    for (const database of ['sqlite', 'postgresql'] as const) {
      const gin = createManualProjectScaffold({
        name: `Gin ${database}`,
        backendStack: 'gin-gorm',
        database,
        entities: [articleEntity],
      })
      const databaseFile = gin.files.find((file) => file.path === 'apps/api/internal/database/database.go')!.content
      const goMod = gin.files.find((file) => file.path === 'apps/api/go.mod')!.content
      const migration = gin.files.find((file) => file.path === 'apps/api/migrations/00001_create_tasks.sql')!.content
      expect(databaseFile).toContain(`gorm.io/driver/${database === 'sqlite' ? 'sqlite' : 'postgres'}`)
      expect(databaseFile).not.toContain(`gorm.io/driver/${database === 'sqlite' ? 'postgres' : 'sqlite'}`)
      expect(goMod).toContain(`gorm.io/driver/${database === 'sqlite' ? 'sqlite' : 'postgres'}`)
      expect(migration).toContain('CREATE TABLE articles')
      expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS tasks')
    }
  })

  it('rejects invalid models and unsupported database combinations', () => {
    expect(() => createManualProjectScaffold({
      name: 'Invalid Spring SQLite',
      backendStack: 'spring-boot-jpa',
      database: 'sqlite',
    })).toThrow(/暂不支持 SQLite/)

    expect(() => createManualProjectScaffold({
      name: 'Invalid Model',
      backendStack: 'hono-drizzle',
      database: 'sqlite',
      entities: [{
        name: 'task',
        label: '任务',
        pluralLabel: '任务管理',
        route: '/tasks',
        fields: [{ name: 'id', label: '编号', type: 'integer', required: true }],
      }],
    })).toThrow(/PascalCase/)
  })

  it('builds a ZIP containing the CRUD manifest and both services', async () => {
    const blob = await buildManualProjectZip({
      name: 'Content Studio',
      description: 'Manual project test',
      backendStack: 'fastapi-sqlalchemy',
      database: 'postgresql',
      includeDocker: true,
      includeGithubActions: false,
      entities: [articleEntity],
    })
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(zip.file('siteforge.json')).toBeTruthy()
    expect(zip.file('openapi.yaml')).toBeTruthy()
    expect(zip.file('apps/web/src/resources.ts')).toBeTruthy()
    expect(zip.file('apps/web/src/App.vue')).toBeTruthy()
    expect(zip.file('apps/api/app/models.py')).toBeTruthy()
    expect(zip.file('apps/api/app/routes.py')).toBeTruthy()
    expect(zip.file('docker-compose.yml')).toBeTruthy()
    expect(zip.file('.github/workflows/ci.yml')).toBeNull()
    const manifest = JSON.parse(await zip.file('siteforge.json')!.async('string'))
    expect(manifest).toMatchObject({
      schemaVersion: 2,
      projectKind: 'fullstack-app',
      backend: 'fastapi-sqlalchemy',
      database: 'postgresql',
      entities: [{ name: 'Article', route: '/articles' }],
    })
    expect(await zip.file('apps/api/app/routes.py')!.async('string')).toContain('@router.post("/articles"')
  })
})

export const BACKEND_STACK_IDS = [
  'hono-drizzle',
  'nestjs-prisma',
  'fastapi-sqlalchemy',
  'spring-boot-jpa',
  'gin-gorm',
] as const

export type BackendStackId = (typeof BACKEND_STACK_IDS)[number]
export const BACKEND_DATABASE_IDS = ['sqlite', 'postgresql'] as const
export type BackendDatabaseId = (typeof BACKEND_DATABASE_IDS)[number]

export interface BackendStackCommands {
  install: string
  dev: string
  build: string
  test: string
  migrate: string
}

export interface BackendStackProfile {
  id: BackendStackId
  name: string
  shortName: string
  description: string
  language: 'TypeScript' | 'Python' | 'Java' | 'Go'
  runtime: string
  framework: string
  frameworkVersion: string
  orm: string
  migrationTool: string
  packageManager: string
  defaultPort: number
  dockerImage: string
  databases: readonly BackendDatabaseId[]
  recommendedDatabase: BackendDatabaseId
  recommended: boolean
  maturity: 'recommended' | 'stable'
  commands: BackendStackCommands
  strengths: readonly string[]
  considerations: readonly string[]
}

export const DEFAULT_BACKEND_STACK_ID: BackendStackId = 'hono-drizzle'

export const BACKEND_STACK_PROFILES: readonly BackendStackProfile[] = [
  {
    id: 'hono-drizzle',
    name: 'Hono + Drizzle',
    shortName: 'Hono',
    description: '轻量、Web 标准优先的 TypeScript API，适合中小型产品、边缘部署与快速迭代。',
    language: 'TypeScript',
    runtime: 'Node.js 24',
    framework: 'Hono',
    frameworkVersion: '4.x',
    orm: 'Drizzle ORM',
    migrationTool: 'Drizzle Kit',
    packageManager: 'pnpm',
    defaultPort: 8787,
    dockerImage: 'node:24-alpine',
    databases: ['sqlite', 'postgresql'],
    recommendedDatabase: 'sqlite',
    recommended: true,
    maturity: 'recommended',
    commands: {
      install: 'pnpm install',
      dev: 'pnpm --filter api dev',
      build: 'pnpm --filter api build',
      test: 'pnpm --filter api test',
      migrate: 'pnpm --filter api db:migrate',
    },
    strengths: ['启动快、依赖少', '前后端均使用 TypeScript', '适合容器与边缘运行时'],
    considerations: ['大型领域模型需要主动规划分层', '部分企业级能力需要自行组合中间件'],
  },
  {
    id: 'nestjs-prisma',
    name: 'NestJS + Prisma',
    shortName: 'NestJS',
    description: '模块化、约束明确的 Node.js 企业应用栈，适合团队协作和复杂业务。',
    language: 'TypeScript',
    runtime: 'Node.js 24',
    framework: 'NestJS',
    frameworkVersion: '11.x',
    orm: 'Prisma ORM',
    migrationTool: 'Prisma Migrate',
    packageManager: 'pnpm',
    defaultPort: 8787,
    dockerImage: 'node:24-alpine',
    databases: ['sqlite', 'postgresql'],
    recommendedDatabase: 'postgresql',
    recommended: false,
    maturity: 'stable',
    commands: {
      install: 'pnpm install',
      dev: 'pnpm --filter api start:dev',
      build: 'pnpm --filter api build',
      test: 'pnpm --filter api test',
      migrate: 'pnpm --filter api prisma:migrate',
    },
    strengths: ['模块、依赖注入和测试边界清晰', '适合多人长期维护', 'Prisma 类型体验完整'],
    considerations: ['基础开销高于 Hono', '生成代码和目录数量更多'],
  },
  {
    id: 'fastapi-sqlalchemy',
    name: 'FastAPI + SQLAlchemy',
    shortName: 'FastAPI',
    description: 'Python 类型化 API 栈，适合数据产品、自动化服务和 Python 生态集成。',
    language: 'Python',
    runtime: 'Python 3.14',
    framework: 'FastAPI',
    frameworkVersion: '0.139.x',
    orm: 'SQLAlchemy',
    migrationTool: 'Alembic',
    packageManager: 'uv',
    defaultPort: 8787,
    dockerImage: 'python:3.14-slim',
    databases: ['sqlite', 'postgresql'],
    recommendedDatabase: 'postgresql',
    recommended: false,
    maturity: 'stable',
    commands: {
      install: 'uv sync',
      dev: 'uv run fastapi dev app/main.py --port 8787',
      build: 'uv build',
      test: 'uv run pytest',
      migrate: 'uv run alembic upgrade head',
    },
    strengths: ['OpenAPI 与请求校验开箱即用', '适合 Python 数据和 AI 生态', '代码直接、开发效率高'],
    considerations: ['前后端语言不同', '同步与异步数据库代码需要保持一致'],
  },
  {
    id: 'spring-boot-jpa',
    name: 'Spring Boot + JPA',
    shortName: 'Spring Boot',
    description: '成熟的 Java 企业后端，适合复杂权限、事务、集成和长期维护场景。',
    language: 'Java',
    runtime: 'Java 21',
    framework: 'Spring Boot',
    frameworkVersion: '4.1.x',
    orm: 'Spring Data JPA',
    migrationTool: 'Flyway',
    packageManager: 'Maven',
    defaultPort: 8787,
    dockerImage: 'eclipse-temurin:21-jre-alpine',
    databases: ['postgresql'],
    recommendedDatabase: 'postgresql',
    recommended: false,
    maturity: 'stable',
    commands: {
      install: 'mvn dependency:go-offline',
      dev: 'mvn spring-boot:run',
      build: 'mvn verify',
      test: 'mvn test',
      migrate: 'mvn flyway:migrate',
    },
    strengths: ['企业生态成熟', '事务、安全和可观测性能力完整', '适合大型团队'],
    considerations: ['资源占用和构建时间更高', '第一版只开放 PostgreSQL'],
  },
  {
    id: 'gin-gorm',
    name: 'Gin + GORM',
    shortName: 'Gin',
    description: '高效、单二进制部署的 Go API 栈，适合高吞吐服务和简单运维。',
    language: 'Go',
    runtime: 'Go 1.25',
    framework: 'Gin',
    frameworkVersion: '1.12.x',
    orm: 'GORM',
    migrationTool: 'Goose',
    packageManager: 'Go modules',
    defaultPort: 8787,
    dockerImage: 'golang:1.25-alpine',
    databases: ['sqlite', 'postgresql'],
    recommendedDatabase: 'postgresql',
    recommended: false,
    maturity: 'stable',
    commands: {
      install: 'go mod download',
      dev: 'go run ./cmd/api',
      build: 'go build ./...',
      test: 'go test ./...',
      migrate: 'goose -dir migrations up',
    },
    strengths: ['启动与运行资源开销低', '部署为单二进制', '并发模型清晰'],
    considerations: ['前后端语言不同', '通用后台能力需要显式组合'],
  },
] as const

export function getBackendStackProfile(id: BackendStackId | string): BackendStackProfile | undefined {
  return BACKEND_STACK_PROFILES.find((profile) => profile.id === id)
}

export function backendStackSupportsDatabase(stackId: BackendStackId, database: BackendDatabaseId): boolean {
  return getBackendStackProfile(stackId)?.databases.includes(database) ?? false
}

export function backendDatabaseLabel(database: BackendDatabaseId): string {
  return database === 'sqlite' ? 'SQLite' : 'PostgreSQL'
}

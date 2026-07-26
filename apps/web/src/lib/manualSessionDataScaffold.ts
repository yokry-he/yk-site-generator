import {
  normalizeManualAccess,
  type ArtifactFile,
  type BackendDatabaseId,
  type BackendStackId,
  type ManualAccessDefinition,
  type ManualEntityDefinition,
} from 'shared'
import { replaceFile } from './manualAuthCommon'
import { text } from './manualCrudHelpers'

const PASSWORD_ITERATIONS = 600_000
const PASSWORD_SALT_BYTES = 16
const PASSWORD_DERIVED_KEY_BYTES = 32
const SESSION_TOKEN_BYTES = 32

function appendEnvironment(files: ArtifactFile[], access: ManualAccessDefinition) {
  replaceFile(files, '.env.example', (content) => {
    if (content.includes('AUTH_BOOTSTRAP_EMAIL=')) return content
    const session = access.session!
    return `${content.trimEnd()}

# Persistent identity/session data model (runtime login endpoints are added in the next phase).
AUTH_BOOTSTRAP_EMAIL=admin@example.com
AUTH_BOOTSTRAP_PASSWORD=replace-with-a-long-random-password
AUTH_SESSION_TTL_SECONDS=${session.ttlSeconds}
AUTH_MAX_ACTIVE_SESSIONS=${session.maxActiveSessions}
`
  })
}

function sessionPolicyFile(access: ManualAccessDefinition): ArtifactFile {
  return text('siteforge.session.json', JSON.stringify({
    schemaVersion: 1,
    status: 'schema-ready',
    runtime: 'not-wired',
    password: {
      algorithm: 'PBKDF2-HMAC-SHA256',
      iterations: PASSWORD_ITERATIONS,
      saltBytes: PASSWORD_SALT_BYTES,
      derivedKeyBytes: PASSWORD_DERIVED_KEY_BYTES,
      storageFormat: 'pbkdf2_sha256$iterations$saltHex$hashHex',
    },
    session: {
      tokenBytes: SESSION_TOKEN_BYTES,
      tokenStorage: 'SHA-256 digest only',
      ttlSeconds: access.session!.ttlSeconds,
      maxActiveSessions: access.session!.maxActiveSessions,
      revocation: 'revoked_at timestamp',
      rotation: 'replace current session and revoke the previous token',
    },
    tables: {
      users: 'auth_users',
      sessions: 'auth_sessions',
    },
    bootstrap: {
      email: 'AUTH_BOOTSTRAP_EMAIL',
      password: 'AUTH_BOOTSTRAP_PASSWORD',
    },
  }, null, 2))
}

function sessionGuideFile(access: ManualAccessDefinition): ArtifactFile {
  const session = access.session!
  return text('SESSION_SECURITY.md', `# Persistent Identity and Session Data / 持久化身份与 Session 数据

[中文](#中文) · [English](#english)

---

## 中文

本工程已经生成持久化用户与 Session 的数据库结构，但当前运行时仍使用原有的环境变量 Bearer Token 路由保护。登录、退出、轮换和撤销端点将在下一阶段接线；本文件不会把尚未存在的端点描述为可用。

### 已生成的数据结构

- \`auth_users\`：邮箱、密码哈希、角色、禁用状态和时间戳
- \`auth_sessions\`：Session Token 摘要、用户外键、过期时间、撤销时间、最后使用时间和创建时间
- 删除用户时级联删除其 Session
- Token 摘要和用户邮箱均有唯一约束
- 过期时间和用户外键建立索引

### 密码参数

密码不会以明文或可逆密文写入数据库。计划中的运行时统一使用：

- PBKDF2-HMAC-SHA256
- ${PASSWORD_ITERATIONS.toLocaleString('en-US')} 次迭代
- ${PASSWORD_SALT_BYTES} 字节随机盐
- ${PASSWORD_DERIVED_KEY_BYTES} 字节派生密钥
- 每条密码记录存储自己的迭代次数和盐，便于以后升级工作因子

### Session 参数

- 客户端 Token 使用 ${SESSION_TOKEN_BYTES} 字节密码学随机数
- 数据库只保存 Token 的 SHA-256 摘要
- 默认有效期：${session.ttlSeconds} 秒
- 单用户最多 ${session.maxActiveSessions} 个活动 Session
- 撤销使用 \`revoked_at\`，不会重新启用旧 Token
- 轮换时应先创建新 Token，再撤销旧 Token，并保证事务一致性

### 环境变量

\`AUTH_BOOTSTRAP_EMAIL\` 和 \`AUTH_BOOTSTRAP_PASSWORD\` 预留给首个管理员引导流程。真实密码必须通过 Secret 管理注入，不能提交到仓库、镜像、日志或截图。

### 当前边界

当前阶段只生成数据层、迁移和安全协议，不包含可调用的密码登录、退出、Session 轮换、密码找回、邮箱验证、MFA 或 OAuth/OIDC。现有 \`AUTH_IDENTITIES_JSON\` Bearer Token 认证仍是实际运行时保护。

---

## English

This project now contains persistent user and session database structures, while runtime route protection still uses the existing environment-backed bearer identities. Login, logout, rotation, and revocation endpoints are wired in the next phase; this document does not claim that unavailable endpoints already exist.

### Generated data structures

- \`auth_users\`: email, password hash, role, disabled flag, and timestamps
- \`auth_sessions\`: session-token digest, user foreign key, expiry, revocation, last-used, and creation timestamps
- deleting a user cascades to the user's sessions
- token digests and user emails are unique
- expiry and user foreign keys are indexed

### Password parameters

Passwords are never stored as plaintext or reversible ciphertext. The planned runtime contract uses:

- PBKDF2-HMAC-SHA256
- ${PASSWORD_ITERATIONS.toLocaleString('en-US')} iterations
- a ${PASSWORD_SALT_BYTES}-byte random salt
- a ${PASSWORD_DERIVED_KEY_BYTES}-byte derived key
- per-record iteration and salt values so the work factor can be upgraded later

### Session parameters

- client tokens contain ${SESSION_TOKEN_BYTES} bytes of cryptographic randomness
- the database stores only a SHA-256 digest of each token
- default lifetime: ${session.ttlSeconds} seconds
- at most ${session.maxActiveSessions} active sessions per user
- revocation uses \`revoked_at\`; old tokens are never re-enabled
- rotation should create the new token and revoke the old token transactionally

### Environment variables

\`AUTH_BOOTSTRAP_EMAIL\` and \`AUTH_BOOTSTRAP_PASSWORD\` are reserved for the first administrator bootstrap flow. Real passwords must be injected through secret management and must never be committed to the repository, image, logs, or screenshots.

### Current boundary

This phase generates the data layer, migrations, and security protocol only. It does not yet expose password login, logout, session rotation, password recovery, email verification, MFA, or OAuth/OIDC endpoints. The existing \`AUTH_IDENTITIES_JSON\` bearer-token flow remains the active runtime protection.
`)
}

function honoSessionData(files: ArtifactFile[], database: BackendDatabaseId): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  replaceFile(files, 'apps/api/src/schema.ts', (content) => `${content.trimEnd()}

export const authUserTable = ${sqlite ? 'sqliteTable' : 'pgTable'}('auth_users', {
  id: integer('id').primaryKey(${sqlite ? '{ autoIncrement: true }' : ''})${sqlite ? '' : '.generatedAlwaysAsIdentity()'},
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  disabled: ${sqlite ? "integer('disabled', { mode: 'boolean' }).notNull().default(false)" : "boolean('disabled').notNull().default(false)"},
  createdAt: ${sqlite ? "text('created_at').notNull()" : "timestamp('created_at', { withTimezone: true }).notNull().defaultNow()"},
  updatedAt: ${sqlite ? "text('updated_at').notNull()" : "timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()"},
})

export const authSessionTable = ${sqlite ? 'sqliteTable' : 'pgTable'}('auth_sessions', {
  id: integer('id').primaryKey(${sqlite ? '{ autoIncrement: true }' : ''})${sqlite ? '' : '.generatedAlwaysAsIdentity()'},
  tokenHash: text('token_hash').notNull().unique(),
  userId: integer('user_id').notNull().references(() => authUserTable.id, { onDelete: 'cascade' }),
  expiresAt: ${sqlite ? "text('expires_at').notNull()" : "timestamp('expires_at', { withTimezone: true }).notNull()"},
  revokedAt: ${sqlite ? "text('revoked_at')" : "timestamp('revoked_at', { withTimezone: true })"},
  lastUsedAt: ${sqlite ? "text('last_used_at').notNull()" : "timestamp('last_used_at', { withTimezone: true }).notNull()"},
  createdAt: ${sqlite ? "text('created_at').notNull()" : "timestamp('created_at', { withTimezone: true }).notNull().defaultNow()"},
})
`)

  const sql = sqlite
    ? `CREATE TABLE auth_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);`
    : `CREATE TABLE auth_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);`
  return [text('apps/api/drizzle/0002_auth_identity_sessions.sql', sql)]
}

function nestSessionData(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/api/prisma/schema.prisma', (content) => `${content.trimEnd()}

model AuthUser {
  id           Int           @id @default(autoincrement())
  email        String        @unique
  passwordHash String
  role         String
  disabled     Boolean       @default(false)
  sessions     AuthSession[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@map("auth_users")
}

model AuthSession {
  id         Int       @id @default(autoincrement())
  tokenHash  String    @unique
  userId     Int
  user       AuthUser  @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  revokedAt  DateTime?
  lastUsedAt DateTime  @default(now())
  createdAt  DateTime  @default(now())

  @@index([userId])
  @@index([expiresAt])
  @@map("auth_sessions")
}
`)
  return []
}

function fastApiSessionData(files: ArtifactFile[]): ArtifactFile[] {
  replaceFile(files, 'apps/api/app/models.py', (content) => `${content.trimEnd()}

class AuthUser(Base):
    __tablename__ = "auth_users"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    passwordHash: Mapped[str] = mapped_column("password_hash", Text, nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    createdAt: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updatedAt: Mapped[datetime] = mapped_column("updated_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class AuthSession(Base):
    __tablename__ = "auth_sessions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tokenHash: Mapped[str] = mapped_column("token_hash", Text, unique=True, nullable=False)
    userId: Mapped[int] = mapped_column("user_id", ForeignKey("auth_users.id", ondelete="CASCADE"), nullable=False, index=True)
    expiresAt: Mapped[datetime] = mapped_column("expires_at", DateTime(timezone=True), nullable=False, index=True)
    revokedAt: Mapped[datetime | None] = mapped_column("revoked_at", DateTime(timezone=True), nullable=True)
    lastUsedAt: Mapped[datetime] = mapped_column("last_used_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    createdAt: Mapped[datetime] = mapped_column("created_at", DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
`)
  return [text('apps/api/migrations/versions/0002_auth_identity_sessions.py', `"""create persistent authentication users and sessions"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "auth_users",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("disabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["auth_users.id"], ondelete="CASCADE"),
    )
    op.create_index("auth_sessions_user_id_idx", "auth_sessions", ["user_id"])
    op.create_index("auth_sessions_expires_at_idx", "auth_sessions", ["expires_at"])

def downgrade() -> None:
    op.drop_index("auth_sessions_expires_at_idx", table_name="auth_sessions")
    op.drop_index("auth_sessions_user_id_idx", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_table("auth_users")
`)]
}

function springSessionData(): ArtifactFile[] {
  return [text('apps/api/src/main/resources/db/migration/V2__auth_identity_sessions.sql', `CREATE TABLE auth_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id BIGINT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);`)]
}

function ginSessionData(files: ArtifactFile[], database: BackendDatabaseId): ArtifactFile[] {
  const sqlite = database === 'sqlite'
  replaceFile(files, 'apps/api/internal/database/models.go', (content) => `${content.trimEnd()}

type AuthUser struct {
  ID uint \`json:"id" gorm:"primaryKey"\`
  Email string \`json:"email" gorm:"column:email;uniqueIndex;not null"\`
  PasswordHash string \`json:"-" gorm:"column:password_hash;not null"\`
  Role string \`json:"role" gorm:"column:role;not null"\`
  Disabled bool \`json:"disabled" gorm:"column:disabled;not null;default:false"\`
  CreatedAt time.Time \`json:"createdAt"\`
  UpdatedAt time.Time \`json:"updatedAt"\`
}

func (AuthUser) TableName() string { return "auth_users" }

type AuthSession struct {
  ID uint \`json:"id" gorm:"primaryKey"\`
  TokenHash string \`json:"-" gorm:"column:token_hash;uniqueIndex;not null"\`
  UserID uint \`json:"userId" gorm:"column:user_id;index;not null"\`
  ExpiresAt time.Time \`json:"expiresAt" gorm:"column:expires_at;index;not null"\`
  RevokedAt *time.Time \`json:"revokedAt" gorm:"column:revoked_at"\`
  LastUsedAt time.Time \`json:"lastUsedAt" gorm:"column:last_used_at;not null"\`
  CreatedAt time.Time \`json:"createdAt"\`
}

func (AuthSession) TableName() string { return "auth_sessions" }
`)
  replaceFile(files, 'apps/api/internal/database/database.go', (content) => content.replace(
    /db\.AutoMigrate\(([^)]*)\)/,
    'db.AutoMigrate($1, &AuthUser{}, &AuthSession{})',
  ))
  const id = sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGSERIAL PRIMARY KEY'
  const userId = sqlite ? 'INTEGER' : 'BIGINT'
  return [text('apps/api/migrations/00002_auth_identity_sessions.sql', `-- +goose Up
CREATE TABLE auth_users (
  id ${id},
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE auth_sessions (
  id ${id},
  token_hash TEXT NOT NULL UNIQUE,
  user_id ${userId} NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);

-- +goose Down
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS auth_users;`)]
}

export function applyManualSessionData(
  inputFiles: ArtifactFile[],
  stack: BackendStackId,
  database: BackendDatabaseId,
  entities: readonly ManualEntityDefinition[],
  input?: ManualAccessDefinition,
): ArtifactFile[] {
  const access = normalizeManualAccess(input, entities)
  const files = inputFiles.map((file) => ({ ...file }))
  if (!access.persistentSessions) return files

  appendEnvironment(files, access)
  const stackFiles = stack === 'hono-drizzle'
    ? honoSessionData(files, database)
    : stack === 'nestjs-prisma'
      ? nestSessionData(files)
      : stack === 'fastapi-sqlalchemy'
        ? fastApiSessionData(files)
        : stack === 'spring-boot-jpa'
          ? springSessionData()
          : ginSessionData(files, database)

  return [
    ...files,
    ...stackFiles,
    sessionPolicyFile(access),
    sessionGuideFile(access),
  ]
}

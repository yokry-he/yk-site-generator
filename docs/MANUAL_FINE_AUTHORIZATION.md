# 字段与记录级授权 / Field-level and Record-level Authorization

[中文](#中文) · [English](#english)

## 中文

SiteForge 在现有角色 × 实体 × CRUD 权限之上生成字段白名单和记录范围策略。

- 管理员默认读取和写入全部业务字段。
- 非管理员默认不能读取或写入名称包含 password、secret、token、credential、private、internal、salary、cost 或 ssn 的字段。
- viewer 没有写字段。
- 实体存在 ownerId、userId、createdById、authorId 或 assigneeId 时，非管理员默认只访问自己的记录。
- 没有 owner 字段但存在 teamId、organizationId、workspaceId 或 tenantId 时，非管理员默认只访问当前团队记录。
- 没有作用域字段时保持 all，避免生成无法使用的 API。

生成工程包含 `siteforge.authorization.json`、运行时适配器和 `FINE_GRAINED_AUTHORIZATION.md`。运行时可以使用 `AUTH_FINE_POLICY_JSON` 覆盖编译策略。字段隐藏必须同时应用于请求写入、响应读取和数据库记录谓词，不能只依赖 Vue 界面。

## English

SiteForge now compiles field allowlists and record scopes on top of role/resource CRUD permissions.

Administrators receive all fields. Sensitive-name fields are administrator-only by default, viewers receive no writable fields, owner-like fields enable owner scope, and team-like fields enable team scope. If no scope field exists, the generated policy remains `all` so the API is not accidentally locked.

Generated projects include `siteforge.authorization.json`, a stack-native adapter, and `FINE_GRAINED_AUTHORIZATION.md`. `AUTH_FINE_POLICY_JSON` can override the compiled policy. Enforcement belongs in request writes, response reads, and database record predicates rather than frontend visibility alone.

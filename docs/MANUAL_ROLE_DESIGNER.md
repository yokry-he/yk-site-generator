# 可视化角色权限设计器 / Visual Role and Permission Designer

[中文](#中文) · [English](#english)

---

## 中文

### 定位

`/projects/new` 在数据模型之后提供“认证与角色权限”步骤。用户可以直接为每个角色配置每个实体的：

- `list`：读取列表
- `read`：读取详情
- `create`：新建记录
- `update`：修改记录
- `delete`：删除记录

同一份矩阵会写入 `siteforge.auth.json`，并生成到 Hono、NestJS、FastAPI、Spring Boot 和 Gin 的路由权限实现中。

### 默认角色

新工程默认包含：

| 角色 | 默认权限 |
| --- | --- |
| `admin` | 所有实体完整权限 |
| `editor` | 列表、详情、新建和修改 |
| `viewer` | 列表和详情 |

用户可以新增最多 8 个角色，修改角色标识、名称和说明，并使用完整、编辑、只读或清空预设。

### 实体变化同步

角色矩阵会跟随数据模型变化：

- 实体重命名时保留原有动作
- 删除实体时移除对应权限
- 新增实体时，原本拥有全部资源权限的角色自动获得完整权限
- 内置 `editor` 和 `viewer` 对新实体使用各自默认预设
- 部分权限的自定义角色不会自动获得新实体权限

这样既避免管理员因新增资源被锁死，也不会把新资源静默开放给有限权限的自定义角色。

### 锁死保护

当生成认证代码时，至少需要一个角色拥有所有实体的完整权限。删除最后一个完整权限角色、清空其权限或修改角色矩阵导致无人能够管理全部资源时：

- 页面显示明确错误
- “生成并下载工程 ZIP”被禁用
- 生成器不会静默补回管理员权限

关闭“生成认证与路由权限代码”后，工程不会生成后端认证中间件或前端 Token 面板，但仍保留权限协议文件和启用说明，便于后续恢复。

### 运行时边界

角色设计器决定**生成什么权限代码**。生成工程中的运行时保护仍默认关闭：

```text
AUTH_ENABLED=false
```

只有部署者明确设置 `AUTH_ENABLED=true` 并提供合法 `AUTH_IDENTITIES_JSON` 后，API 才会要求 Bearer Token。

当前身份仍来自环境变量中的静态身份列表。持久化用户、密码哈希、Session、撤销和轮换属于下一阶段。

---

## English

### Purpose

After the data-model step, `/projects/new` now includes an authentication and role-permission designer. Each role can receive these actions for every entity:

- `list`: read collections
- `read`: read details
- `create`: create records
- `update`: modify records
- `delete`: delete records

The same matrix is written to `siteforge.auth.json` and compiled into the route-authorization implementation for Hono, NestJS, FastAPI, Spring Boot, and Gin.

### Default roles

New projects start with:

| Role | Default permissions |
| --- | --- |
| `admin` | Full access to every entity |
| `editor` | List, read, create, and update |
| `viewer` | List and read |

Users can create up to eight roles, edit the role key, label, and description, and apply full-access, editor, read-only, or empty presets.

### Synchronizing entity changes

The role matrix follows data-model changes:

- Renaming an entity preserves its existing actions.
- Deleting an entity removes its permission entry.
- A role that previously had full access automatically receives full access to newly added entities.
- Built-in `editor` and `viewer` roles apply their normal presets to new entities.
- A partial custom role receives no access to a new entity automatically.

This prevents accidental administrator lockout without silently exposing a new resource to limited custom roles.

### Lockout protection

When authentication code is enabled, at least one role must retain full access to every entity. If the user deletes the final full-access role, clears its permissions, or otherwise leaves no complete administrator role:

- The page displays an explicit validation error.
- The ZIP generation action is disabled.
- The generator does not silently restore administrator permissions.

Turning off “generate authentication and route-permission code” omits the backend authentication middleware and frontend token panel. The policy and activation guidance remain available so access control can be restored later.

### Runtime boundary

The designer determines **which authorization code is generated**. Runtime enforcement in the generated project remains disabled by default:

```text
AUTH_ENABLED=false
```

The API only requires a bearer token after the deployer explicitly sets `AUTH_ENABLED=true` and supplies a valid `AUTH_IDENTITIES_JSON` value.

Identities are still provided through the static environment-variable list. Persistent users, password hashing, sessions, revocation, and rotation remain the next phase.

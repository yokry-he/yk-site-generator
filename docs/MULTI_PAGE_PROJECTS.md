# 多页面项目 / Multi-page Projects

[中文](#中文) · [English](#english)

---

## 中文

### 当前能力

SiteForge 项目版本现在可以包含完整的页面集合，而不再只能保存一份 HTML。旧项目会在读取时自动迁移为只有一个首页的多页面文档，不需要用户手工转换。

每个整站版本包含：

- 一个首页，固定路径为 `/`
- 最多 12 个页面
- 每个页面独立的名称、路径和完整 HTML
- 页面顺序和首页标识
- 整站不可变版本、回滚、复制、发布与 ZIP 导出

### 页面工作区

打开云端项目后进入“页面管理”标签，可以：

- 新增或复制页面
- 修改页面名称和访问路径
- 调整页面顺序
- 将任意页面设为首页
- 删除非唯一页面
- 在桌面和手机宽度下预览
- 使用可视化编辑器修改当前页面
- 将统一导航写入所有页面
- 保存为新的完整整站版本

页面路径必须是 `/`，或由小写英文、数字和连字符组成，例如：

```text
/
/about
/products
/docs/getting-started
```

### 版本语义

保存页面修改不会覆盖当前版本。系统会创建新的整站版本，快照中包含所有页面。回滚、复制项目和版本对比都以整站版本为边界。

首页上的快捷“可视化编辑”和质量修复只修改首页，但保存时会带上其余页面，避免多页面项目退化为单页。

### 发布与导出

发布多页面版本后：

```text
/                 -> index.html
/about            -> about/index.html
/docs/getting-started -> docs/getting-started/index.html
```

本地发布目录和 S3/R2 兼容对象存储都会写入完整页面集合。ZIP 导出使用 `siteforge-export-v2` 清单，并记录每个页面的公开路径和文件位置。

### 限制与后续

当前 AI 初次生成仍然优先生成一个完整首页。用户可以在项目工作区添加其余页面。后续阶段将增加：

- AI 根据站点地图一次生成多个页面
- AI 为指定页面生成或迭代内容
- 全站导航引用检查与自动修复
- 多页面质量汇总和跨页面 SEO 检查
- 版本对比中的逐页面差异

---

## English

### Current capability

A SiteForge project version can now contain a complete set of pages instead of a single HTML document. Existing projects are normalized automatically into a multi-page document containing one home page; users do not need to run a manual migration.

Each immutable site version contains:

- One home page whose path is `/`
- Up to 12 pages
- An independent title, route, and complete HTML document for every page
- Page order and the home-page identifier
- Whole-site versioning, rollback, duplication, publishing, and ZIP export

### Pages workspace

Open a cloud project and select the “Pages” workspace to:

- Add or duplicate pages
- Edit page titles and public routes
- Reorder pages
- Make any page the home page
- Delete a page while retaining at least one page
- Preview desktop and mobile widths
- Edit the current page with the visual editor
- Synchronize a shared navigation block across every page
- Save the complete site as a new immutable version

A page path must be `/`, or lowercase ASCII letters, numbers, and hyphens, for example:

```text
/
/about
/products
/docs/getting-started
```

### Version semantics

Saving page changes never overwrites the current version. SiteForge creates a new whole-site snapshot containing every page. Rollback, project duplication, and version history operate on the complete site version.

The quick visual editor and quality fixes on the project page edit the home page only, but they preserve all other pages when creating the next version. A multi-page project therefore cannot silently collapse back into one page.

### Publishing and export

A published multi-page version maps routes to static files as follows:

```text
/                 -> index.html
/about            -> about/index.html
/docs/getting-started -> docs/getting-started/index.html
```

Both local publication storage and S3/R2-compatible object storage write the complete page set. ZIP exports use a `siteforge-export-v2` manifest that records every public route and output file.

### Limits and next steps

Initial AI generation currently prioritizes one complete home page. Users can add the remaining pages in the project workspace. Planned follow-up work includes:

- Generating multiple pages from an AI-created sitemap
- Generating or iterating one selected page with AI
- Cross-page navigation validation and repair
- Whole-site quality and SEO aggregation
- Per-page version comparison

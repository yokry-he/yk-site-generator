# 高级关系与远程搜索 / Advanced Relations and Remote Search

[中文](#中文) · [English](#english)

## 中文

现有 belongs-to 关系自动生成分页远程搜索端点，避免前端一次加载全部目标记录。编程接口还支持 one-to-one、many-to-many 和 self 关系，并为五套后端生成关系表、索引、迁移和 `siteforge.relations.json`。

远程搜索默认返回 25 条、最多 100 条，查询字段和排序仍使用生成时白名单。多对多连接表使用复合主键防止重复关系；自引用关系必须由同一实体指向自身。

## English

Existing belongs-to relations now receive paginated remote-search endpoints so the frontend does not load every target row. The programmatic input also supports one-to-one, many-to-many, and self relations, generating relationship tables, indexes, migrations, and `siteforge.relations.json` across all five stacks.

Remote search returns 25 rows by default and at most 100. Query and sort fields remain allowlisted. Many-to-many join tables use composite primary keys, and self relations must point from an entity to itself.

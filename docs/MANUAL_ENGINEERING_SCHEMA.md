# 高级字段、索引与并发 / Advanced Fields, Indexes, and Concurrency

[中文](#中文) · [English](#english)

## 中文

工程 Schema 支持 file、image、rich-text、json 和 tags 字段，以及最多 6 列的复合普通／唯一索引。PostgreSQL 的 JSON 与标签使用 JSONB，SQLite 使用规范化 JSON 文本。

所有实体生成 `revision` 字段。读取响应返回 `ETag`，修改和删除必须发送 `If-Match`；版本不一致返回 `409 REVISION_CONFLICT` 和当前 revision，防止并发覆盖。文件字段只保存受控对象键和元数据，不直接接受任意服务器路径。

## English

The engineering schema supports file, image, rich-text, JSON, and tag fields plus composite regular or unique indexes of up to six columns. PostgreSQL uses JSONB while SQLite stores normalized JSON text.

Every entity receives a `revision` field. Read responses expose `ETag`; updates and deletes require `If-Match`. Stale writes return `409 REVISION_CONFLICT` with the current revision. File fields store controlled object keys and metadata rather than arbitrary server paths.

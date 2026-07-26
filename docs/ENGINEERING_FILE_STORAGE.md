# 工程文件、版本和 Diff / Engineering Files, Versions, and Diff

[中文](#中文) · [English](#english)

## 中文

SiteForge 服务端现在提供工程文件树、单文件读取、批量原子写入、不可变版本快照和版本 Diff。路径会规范化并拒绝 `..`；单文件上限 2 MB、单工程 20 MB、最多 500 个文件。写入使用 revision 乐观锁，冲突返回当前 revision。

文件内容与站点 HTML 版本分开保存，默认使用权限为 0600 的独立原子 JSON 快照。生产部署可将相同接口替换为对象存储／数据库实现，但必须保留用户和项目隔离、内容哈希和不可变版本语义。

## English

The SiteForge server now exposes engineering file trees, single-file reads, atomic batch writes, immutable version snapshots, and version diffs. Paths are normalized and reject `..`; limits are 2 MB per file, 20 MB per project, and 500 files. Writes use revision-based optimistic locking and return the current revision on conflict.

Engineering files are stored separately from site-HTML versions. The default store uses an atomic JSON snapshot with mode 0600. Production object-storage or database implementations must preserve user/project isolation, content hashes, and immutable-version semantics.

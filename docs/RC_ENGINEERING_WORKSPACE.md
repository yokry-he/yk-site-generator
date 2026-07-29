# RC Engineering Workspace / RC 工程工作区

[中文](#中文) · [English](#english)

## 中文

`/projects/:id/engineering` 将云端工程文件、revision 保存、不可变快照、文件 Diff、隔离 Runner 和发布交付整合为一个工作区。文件保存必须携带当前 revision；冲突时不会覆盖远端内容。Runner 使用预定义技术栈与动作，交付区继续遵守可信门禁，未满足条件时 Production 按钮保持禁用。

工作区不提供任意 Shell，也不会把 Production 解锁逻辑放在浏览器中。所有所有权检查、revision、Runner 策略和门禁判断仍由服务端执行。

## English

`/projects/:id/engineering` combines cloud engineering files, revision-aware saves, immutable snapshots, file diffs, isolated Runner execution, and release delivery in one workspace. File writes carry the current revision and never overwrite a conflicting remote update. Runner actions remain predefined, and Production stays disabled until trusted gates pass.

The workspace does not expose arbitrary shell access or move Production-unlock logic into the browser. Ownership, revisions, Runner policy, and release-gate decisions remain server-side.

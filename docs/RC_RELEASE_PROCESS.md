# v0.1.0 RC Release Process / v0.1.0 RC 发布流程

[中文](#中文) · [English](#english)

## 中文

手动 Workflow `RC Release Candidate` 在同一候选 Commit 上执行核心门禁、MySQL、浏览器／无障碍／视觉测试、Redis 双实例和五套 Golden Runtime Matrix。每个成功 Job 使用独立的 `RC_EVIDENCE_SIGNING_KEY` 生成 HMAC 证据。

最终汇总 Job 验证：候选版本、完整 Commit SHA、允许的来源、最大证据年龄、签名和所有必需 Gate。通过后只生成 `manifest.json`、`SHA256SUMS` 和 Release Notes Artifact，状态为 `ready-for-human-approval`。

该 Workflow 不创建 Git Tag、不发布 GitHub Release、不合并 PR、不启用 Production 部署。人工批准前仍需检查已知问题、数据库备份／回滚、Runner 镜像 Digest 和部署配置。

## English

The manually dispatched `RC Release Candidate` workflow runs core gates, MySQL, browser/accessibility/visual checks, Redis multi-instance verification, and the five Golden Runtime Matrix jobs against the same candidate commit. Every successful job creates HMAC evidence with the dedicated `RC_EVIDENCE_SIGNING_KEY`.

The assembly job validates candidate version, full commit SHA, allowed source, maximum evidence age, signatures, and every required gate. Success produces only a `manifest.json`, `SHA256SUMS`, and release-notes artifact with status `ready-for-human-approval`.

The workflow does not create a Git tag, publish a GitHub Release, merge the PR, or enable Production deployment. Human approval must still review known issues, backup/rollback readiness, Runner image digests, and deployment configuration.

# Release Evidence / 发布证据

[中文](#中文) · [English](#english)

## 中文

`rc-manifest.json` 是签名 RC Gate 的唯一需求清单。每份 Gate 证据必须由 `RC_EVIDENCE_SIGNING_KEY` HMAC-SHA-256 签名，并绑定候选版本、完整 Commit SHA、Workflow Run、来源和观察时间。汇总器不会把缺失、失败、过期、跨 Commit 或签名无效的证据标记为通过。

Commit 绑定的首轮真实运行 Manifest 是 `rc:prepare` 的额外必需输入。它必须来自 GitHub API 已验证的 `RC First Real Run` Release Artifact、完整通过 SHA-256 复验、状态为 `passed`、Profile 为 `release`、Commit 与候选一致，且封存 Triage 中没有 P0/P1。首轮 SHA-256 只用于完整性校验，不会被当作 HMAC 签名 Gate。

## English

`rc-manifest.json` is the canonical requirement list for signed RC gates. Every gate evidence document is HMAC-SHA-256 signed with `RC_EVIDENCE_SIGNING_KEY` and binds the candidate version, full commit SHA, workflow run, source, and observation time. The assembler never treats missing, failed, stale, cross-commit, or invalidly signed evidence as passing.

The commit-bound first real run manifest is an additional required input to `rc:prepare`. It must come from a GitHub-API-verified `RC First Real Run` Release artifact, pass full SHA-256 verification, have status `passed`, use profile `release`, match the candidate commit, and contain no sealed P0/P1 triage findings. The first-run SHA-256 layer provides integrity only and is never treated as an HMAC-signed gate.

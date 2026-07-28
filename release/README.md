# Release Evidence / 发布证据

[中文](#中文) · [English](#english)

## 中文

`rc-manifest.json` 是签名 RC Gate 的唯一需求清单。每份 Gate 证据必须由 `RC_EVIDENCE_SIGNING_KEY` HMAC-SHA-256 签名，并绑定候选版本、完整 Commit SHA、Repository、Workflow 路径、Workflow Run ID、Run Attempt、来源和观察时间。汇总器拒绝缺失、重复、未声明、失败、过期、跨 Commit、跨 Run／Attempt 或签名无效的证据。

Commit 绑定的首轮真实运行 Manifest 是 `rc:prepare` 的额外必需输入。它必须来自 GitHub API 已验证的 `RC First Real Run` Release Artifact，并绑定唯一 Artifact ID、SHA-256 Digest、大小、创建时间和过期时间；Manifest 必须完整通过 SHA-256 复验、状态为 `passed`、Profile 为 `release`、Commit 与候选一致，且封存 Triage 中没有 P0/P1。首轮 SHA-256 和 Artifact Digest 只用于完整性与来源身份，不会被当作 HMAC 签名 Gate。

首轮、签名 Gate 和最终 Bundle Artifact 名称均包含 Workflow Run Attempt，避免重新运行时复用旧 Attempt 的 Artifact。

## English

`rc-manifest.json` is the canonical requirement list for signed RC gates. Every gate evidence document is HMAC-SHA-256 signed with `RC_EVIDENCE_SIGNING_KEY` and binds the candidate version, full commit SHA, repository, workflow path, workflow run ID, run attempt, source, and observation time. The assembler rejects missing, duplicate, undeclared, failed, stale, cross-commit, cross-run/attempt, or invalidly signed evidence.

The commit-bound first real run manifest is an additional required input to `rc:prepare`. It must come from a GitHub-API-verified `RC First Real Run` Release artifact and bind the unique artifact ID, SHA-256 digest, size, creation time, and expiration time. The manifest must pass full SHA-256 verification, have status `passed`, use profile `release`, match the candidate commit, and contain no sealed P0/P1 triage findings. The first-run SHA-256 and artifact digest provide integrity and source identity only; they are never treated as an HMAC-signed gate.

First-run, signed-gate, and final bundle artifact names all include the workflow run attempt so reruns cannot reuse artifacts from an older attempt.

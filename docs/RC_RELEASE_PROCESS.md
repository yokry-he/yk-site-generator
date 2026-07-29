# v0.1.0 RC Release Process / v0.1.0 RC 发布流程

[中文](#中文) · [English](#english)

## 中文

### 两层发布证据

SiteForge v0.1.0 RC 使用两层证据，二者不能互相替代：

1. **首轮真实运行证据**：`RC First Real Run` 的 Release Profile 在干净数据卷中执行完整首轮矩阵，并生成 `evidence-manifest.json` 与 `SHA256SUMS`。SHA-256 只证明下载后的 Artifact 内部一致性和篡改检测，不是数字签名。
2. **签名 Gate 证据**：`RC Release Candidate` 的各个 Job 使用 `RC_EVIDENCE_SIGNING_KEY` 生成 HMAC-SHA-256 证据，绑定候选版本、完整 Commit SHA、Gate、Repository、Workflow 路径、Workflow Run ID、Run Attempt、来源和观察时间。

`rc:prepare` 不会把首轮 Manifest 当作签名 Gate，也不会使用首轮 Manifest 或 GitHub Artifact Digest 的 SHA-256 代替 HMAC 验证。

### Attempt 隔离

首轮和发布 Workflow 的 Artifact 名称都包含 `github.run_attempt`：

```text
rc-first-real-run-release-<full-commit-sha>-attempt-<attempt>
rc-evidence-attempt-<attempt>-<job>
siteforge-<candidate-version>-bundle-attempt-<attempt>
```

因此同一 Workflow Run 的重新运行不会复用上一 Attempt 的证据 Artifact。所有签名 Gate 还会把 Run Attempt 写入 HMAC Payload；修改 Attempt、Repository 或 Workflow 路径都会使签名验证失败。

### 首轮结果准入

手动启动 `RC Release Candidate` 时必须提供成功的 `RC First Real Run` Workflow Run ID。汇总 Job 在下载前通过 GitHub Actions API 验证：

- 来源 Workflow 路径为 `.github/workflows/rc-first-real-run.yml`
- Workflow 名称为 `RC First Real Run`
- Head 仓库为当前仓库
- Head 分支为 `Feature-dev-v0.1.0`
- Head SHA 等于当前候选 Commit
- Run 已完成且结论为 `success`
- Run Attempt 是正整数
- Run 创建时间未超过 `maximumEvidenceAgeHours`
- Artifact 名称严格等于 `rc-first-real-run-release-<full-commit-sha>-attempt-<attempt>`
- Artifact ID、大小和 `sha256:<digest>` 格式有效
- Artifact 创建时间未过期，`expires_at` 仍在未来
- Artifact 的 Workflow Run ID 和 Head SHA 与可信 Run 一致
- 同名、未过期 Artifact 唯一

下载后，`rc:prepare` 再执行离线交叉校验：

- 首轮 Manifest 和 `SHA256SUMS` 完整通过复验
- 首轮最终状态为 `passed`
- Profile 为 `release`
- Candidate Version 和完整 Commit SHA 与当前候选一致
- Manifest 的封存时间未超过 `maximumEvidenceAgeHours`
- Manifest 中的 Repository、Workflow 名称、Workflow 路径、Workflow Run ID、Run Attempt 和 Artifact 名称与 GitHub API 的可信结果一致
- Artifact ID、Digest、大小、创建时间和过期时间写入最终准入收据
- 被封存的 `artifacts/rc-triage/first-run-<run-id>/latest.json` 不包含 P0 或 P1，且没有 Blocking Finding

任何一项失败都会阻止 RC Bundle 生成。

### 原子化签名 Gate

首轮准入通过后，汇总 Job继续验证所有必需的 HMAC Gate：核心门禁、MySQL、浏览器／无障碍／视觉测试、Redis 双实例和五套 Golden Runtime Matrix。每份证据必须满足：

- 候选版本和完整 Commit SHA 一致
- 来源为当前允许且期望的来源
- Repository 和 Workflow 路径等于当前 `RC Release Candidate`
- Workflow Run ID 和 Run Attempt 等于当前发布 Attempt
- 状态为 `passed`
- 观察时间未过期且不在未来
- HMAC-SHA-256 签名有效
- `release/rc-manifest.json` 中的所有必需 Gate 均存在且没有重复
- 不存在 Manifest 未声明的额外 Gate

这会阻止来自旧 Attempt、其他 Workflow、其他 Repository 或同 Commit 的另一次 Release Run 的证据混入当前 Bundle。

### 签名 RC Bundle

成功后只生成：

```text
artifacts/rc-release/manifest.json
artifacts/rc-release/SHA256SUMS
artifacts/rc-release/RELEASE_NOTES.md
```

Bundle Manifest Schema 为 `2`，状态为 `ready-for-human-approval`。Manifest 会分别记录：

- 首轮 Workflow Run／Attempt 与 Artifact ID、Digest、大小和有效期
- 首轮 Evidence Manifest SHA-256 与 Triage 计数
- 当前 Release Workflow Run／Attempt、Repository 和 Workflow 路径
- HMAC Gate 数量和签名摘要

两种信任机制保持独立：首轮 SHA-256 和 GitHub Artifact Digest 用于完整性与来源身份，Gate HMAC 用于发布门禁认证。

该 Workflow 不创建 Git Tag、不发布 GitHub Release、不合并 PR、不启用 Production 部署。人工批准前仍需检查已知问题、数据库备份／回滚、Runner 镜像 Digest 和部署配置。

## English

### Two evidence layers

SiteForge v0.1.0 RC uses two evidence layers that cannot replace each other:

1. **First real run evidence**: the `RC First Real Run` Release Profile executes the complete first-run matrix on clean data volumes and produces `evidence-manifest.json` plus `SHA256SUMS`. SHA-256 provides artifact-internal consistency and tamper detection after download; it is not a digital signature.
2. **Signed gate evidence**: every `RC Release Candidate` job creates HMAC-SHA-256 evidence with `RC_EVIDENCE_SIGNING_KEY`, binding the candidate version, full commit SHA, gate, repository, workflow path, workflow run ID, run attempt, source, and observation time.

`rc:prepare` never treats the first-run manifest as a signed gate and never substitutes the first-run SHA-256 or GitHub artifact digest for HMAC verification.

### Attempt isolation

Both first-run and release workflow artifacts include `github.run_attempt` in their names:

```text
rc-first-real-run-release-<full-commit-sha>-attempt-<attempt>
rc-evidence-attempt-<attempt>-<job>
siteforge-<candidate-version>-bundle-attempt-<attempt>
```

A rerun of the same workflow run therefore does not reuse evidence artifacts from a previous attempt. Every signed gate also includes the run attempt in its HMAC payload; changing the attempt, repository, or workflow path invalidates the signature.

### First-run admission

A manual `RC Release Candidate` dispatch must provide the successful `RC First Real Run` workflow run ID. Before download, the assembly job verifies through the GitHub Actions API that:

- the source workflow path is `.github/workflows/rc-first-real-run.yml`
- the workflow name is `RC First Real Run`
- the head repository is the current repository
- the head branch is `Feature-dev-v0.1.0`
- the head SHA equals the current candidate commit
- the run is completed with conclusion `success`
- the run attempt is a positive integer
- the run creation time is within `maximumEvidenceAgeHours`
- the artifact name exactly equals `rc-first-real-run-release-<full-commit-sha>-attempt-<attempt>`
- the artifact ID, size, and `sha256:<digest>` format are valid
- the artifact creation time is fresh and `expires_at` remains in the future
- the artifact workflow run ID and head SHA match the trusted run
- the matching unexpired artifact is unique

After download, `rc:prepare` performs a second offline cross-check:

- the first-run manifest and `SHA256SUMS` verify completely
- the final first-run status is `passed`
- the profile is `release`
- the candidate version and full commit SHA match the current candidate
- the manifest sealing time is within `maximumEvidenceAgeHours`
- the repository, workflow name, workflow path, workflow run ID, run attempt, and artifact name embedded in the manifest match the trusted GitHub API result
- the artifact ID, digest, size, creation time, and expiration time are recorded in the final admission receipt
- the sealed `artifacts/rc-triage/first-run-<run-id>/latest.json` contains no P0 or P1 findings and no blocking findings

Any failure blocks RC bundle generation.

### Atomic signed gates

After first-run admission, the assembly job continues to validate every required HMAC gate: core gates, MySQL, browser/accessibility/visual checks, Redis multi-instance verification, and the five Golden Runtime Matrix jobs. Every evidence document must have:

- the matching candidate version and full commit SHA
- the currently allowed and expected source
- the repository and workflow path of the current `RC Release Candidate`
- the workflow run ID and run attempt of the current release attempt
- status `passed`
- a non-stale, non-future observation time
- a valid HMAC-SHA-256 signature
- complete, non-duplicated coverage of `release/rc-manifest.json`
- no extra gate that is absent from the manifest

This prevents evidence from an older attempt, another workflow, another repository, or another release run for the same commit from entering the current bundle.

### Signed RC bundle

Success produces only:

```text
artifacts/rc-release/manifest.json
artifacts/rc-release/SHA256SUMS
artifacts/rc-release/RELEASE_NOTES.md
```

The bundle manifest uses schema `2` and status `ready-for-human-approval`. It separately records:

- the first-run workflow run/attempt and artifact ID, digest, size, and validity window
- the first-run evidence manifest SHA-256 and triage counts
- the current release workflow run/attempt, repository, and workflow path
- the HMAC gate count and signature digest

The trust mechanisms remain separate: the first-run SHA-256 and GitHub artifact digest provide integrity and source identity, while gate HMAC values authenticate release-gate evidence.

The workflow does not create a Git tag, publish a GitHub Release, merge the PR, or enable Production deployment. Human approval must still review known issues, backup/rollback readiness, Runner image digests, and deployment configuration.

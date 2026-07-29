# RC Bundle 离线复验 / RC Bundle Offline Verification

[中文](#中文) · [English](#english)

## 中文

### 目标

`RC Release Candidate` 只有在首轮准入和全部 HMAC Gate 都通过后才生成 `artifacts/rc-release`。阶段二十一为这个最终交付目录增加独立 Node.js 复验入口，使下载 Artifact 后无需 Docker、pnpm Store、数据库或签名 Secret，也能检查 Bundle 的文件完整性和准入收据一致性。

复验不会重新执行产品 Gate，也不会重新计算 HMAC。HMAC 已在 `rc:prepare` 汇总前使用 `RC_EVIDENCE_SIGNING_KEY` 验证；最终 Bundle 只保留每个签名的 SHA-256 收据，不包含签名 Secret。

### 生成时自检

`rc:prepare` 会先删除旧的 `artifacts/rc-release`，只生成：

```text
manifest.json
RELEASE_NOTES.md
SHA256SUMS
```

随后它会：

1. 对 `manifest.json` 和 `RELEASE_NOTES.md` 计算 SHA-256；
2. 按固定顺序写入 `SHA256SUMS`；
3. 调用同一个离线复验器；
4. 只有复验结果为 `ok` 才返回成功并允许 Workflow 上传 Artifact。

因此旧文件、额外文件或上一 Attempt 的残留不能静默进入最终 Bundle。

### 下载后复验

在仓库根目录执行：

```bash
pnpm rc:bundle:verify
```

仅使用 Node.js：

```bash
node scripts/rc-release-bundle.mjs \
  --bundle artifacts/rc-release \
  --version 0.1.0-rc.1 \
  --commit <40-character-candidate-sha> \
  --release-workflow-run-id <run-id> \
  --release-workflow-run-attempt <attempt> \
  --repository yokry-he/yk-site-generator \
  --workflow-path .github/workflows/rc-release.yml
```

不提供期望值时，复验器仍会检查 Bundle 内部契约；提供期望值可以把下载目录绑定到人工批准时记录的 Workflow Run、Attempt、Repository、版本和 Commit。

### 复验内容

复验器拒绝：

- 缺失、额外、目录或符号链接条目；
- 未同时覆盖 `manifest.json` 和 `RELEASE_NOTES.md` 的 `SHA256SUMS`；
- 非 Schema 2、非 `ready-for-human-approval`、无效版本或 Commit；
- 与人工输入不一致的候选版本、Commit、Release Run／Attempt、Repository 或 Workflow；
- 首轮 Manifest Digest、Workflow Run／Attempt、Artifact ID／Digest／大小或时间窗口异常；
- 首轮 P0／P1 或 blocked Triage；
- 重复、乱序、缺少名称、非 passed、来源不一致或时间过期的 Gate 收据；
- Gate `signatureSha256` 清单与 `receiptDigest` 不一致；
- Release Notes 中的版本、Commit、首轮 Run／Attempt 或 Release Run／Attempt 与 Manifest 不一致。

Bundle Manifest 还保存 `maximumEvidenceAgeHours`。复验器会确认首轮 Run、封存、Artifact 和所有 Gate 在 Bundle 汇总时仍位于允许时效窗口内，并确认首轮 Artifact 在汇总时尚未过期。

### 信任边界

`SHA256SUMS`、首轮 Manifest SHA-256、GitHub Artifact Digest 和 Gate `signatureSha256` 都是完整性收据，不是最终 Bundle 的数字签名。能够修改 Bundle 的主体也能重新计算这些普通 SHA-256 值。

因此离线复验回答的是：

```text
下载目录是否符合 SiteForge RC Bundle 契约，且内部收据是否自洽？
```

它不能单独回答：

```text
该目录是否一定由受信任的 GitHub Workflow 创建？
```

人工批准仍必须从可信的 GitHub Actions Run 下载 Attempt 专属 Artifact，并核对 Run ID、Attempt、Commit 和 Artifact 来源。该流程不替代 HMAC Gate 验证，也不创建 Tag、合并 PR 或部署 Production。

## English

### Goal

`RC Release Candidate` creates `artifacts/rc-release` only after first-run admission and every HMAC gate pass. Stage twenty-one adds an independent Node.js verifier for that final delivery directory. After downloading the artifact, reviewers can check bundle-file integrity and admission-receipt consistency without Docker, a pnpm store, databases, or the signing secret.

The verifier does not rerun product gates and does not recompute HMAC values. `rc:prepare` already verifies HMAC evidence with `RC_EVIDENCE_SIGNING_KEY` before assembly. The final bundle retains SHA-256 receipts for each signature, never the signing secret.

### Self-verification during assembly

`rc:prepare` removes any previous `artifacts/rc-release` directory and creates only:

```text
manifest.json
RELEASE_NOTES.md
SHA256SUMS
```

It then:

1. calculates SHA-256 for `manifest.json` and `RELEASE_NOTES.md`;
2. writes `SHA256SUMS` in a fixed order;
3. invokes the same offline verifier;
4. returns success only when verification is `ok`, allowing the workflow to upload the artifact.

Stale files, extra files, and remnants from an older attempt therefore cannot silently enter the final bundle.

### Verify after download

From the repository root:

```bash
pnpm rc:bundle:verify
```

With Node.js only:

```bash
node scripts/rc-release-bundle.mjs \
  --bundle artifacts/rc-release \
  --version 0.1.0-rc.1 \
  --commit <40-character-candidate-sha> \
  --release-workflow-run-id <run-id> \
  --release-workflow-run-attempt <attempt> \
  --repository yokry-he/yk-site-generator \
  --workflow-path .github/workflows/rc-release.yml
```

Without expected values, the verifier still checks the internal bundle contract. Expected values bind the downloaded directory to the workflow run, attempt, repository, version, and commit recorded for human approval.

### Verification coverage

The verifier rejects:

- missing, extra, directory, or symbolic-link entries;
- `SHA256SUMS` that does not cover both `manifest.json` and `RELEASE_NOTES.md` exactly;
- a non-schema-2 manifest, a status other than `ready-for-human-approval`, or invalid version/commit data;
- candidate version, commit, release run/attempt, repository, or workflow values that differ from reviewer-supplied expectations;
- invalid first-run manifest digest, workflow run/attempt, artifact ID/digest/size, or time ordering;
- first-run P0/P1 or blocked triage;
- duplicate, unsorted, unnamed, non-passing, source-mismatched, or stale gate receipts;
- a gate `signatureSha256` list that does not match `receiptDigest`;
- release notes whose version, commit, first-run run/attempt, or release run/attempt differs from the manifest.

The bundle manifest also records `maximumEvidenceAgeHours`. The verifier confirms that the first-run workflow, seal, artifact, and every gate were still within the permitted age window when the bundle was assembled, and that the first-run artifact had not expired at assembly time.

### Trust boundary

`SHA256SUMS`, the first-run manifest SHA-256, the GitHub artifact digest, and gate `signatureSha256` values are integrity receipts, not a digital signature over the final bundle. A party able to replace the bundle can also recompute ordinary SHA-256 values.

Offline verification answers:

```text
Does this directory satisfy the SiteForge RC bundle contract, and are its receipts internally consistent?
```

It cannot independently answer:

```text
Was this directory definitely created by the trusted GitHub workflow?
```

Human approval must still download the attempt-specific artifact from the trusted GitHub Actions run and confirm the run ID, attempt, commit, and artifact source. This verifier does not replace HMAC gate validation and does not create a tag, merge the PR, or deploy Production.

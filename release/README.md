# Release Evidence / 发布证据

[中文](#中文) · [English](#english)

## 中文

`rc-manifest.json` 是 RC 发布证据的唯一需求清单。每份证据必须由 `RC_EVIDENCE_SIGNING_KEY` HMAC 签名，并绑定候选版本、完整 Commit SHA、Workflow Run、来源和观察时间。汇总器不会把缺失、失败、过期、跨 Commit 或签名无效的证据标记为通过。

## English

`rc-manifest.json` is the canonical RC evidence requirement list. Every evidence document is HMAC-signed with `RC_EVIDENCE_SIGNING_KEY` and binds the candidate version, full commit SHA, workflow run, source, and observation time. The assembler never treats missing, failed, stale, cross-commit, or invalidly signed evidence as passing.

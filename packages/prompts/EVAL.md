# 提示词评测记录(SF-1-2)

评测脚本:`scripts/eval-prompts.ts`(14 类 × 3 真实感中文用例,共 42 个)

评分维度(每用例 4 项取平均):
1. 输出可被 `@shared` 的 `parseModelOutput` 解析为文件树
2. 必备要素关键词命中率(画像 `validationKeywords`)
3. 经 `artifactToSingleHtml` 合成后包含全部 5 个 head 标准槽位
4. HTML 基本健全(doctype/html/head/body 闭合、style/script 标签配平)

## 真实跑分结果

- **模型**:DeepSeek `deepseek-chat`(`max_tokens: 8192`,`temperature: 0.7`,并发 5)
- **日期**:2026-02-14
- **总通过率**:基线(第 1 轮)44.8% → 第 2 轮 90.9% → 合并第 3 轮定向结果后 **约 95.7%**(按 14 类均分合并估算,最终)

### 最终通过率表(按类型)

| 站点类型 | id | 通过率 | 轮次 | 状态 |
|---|---|---|---|---|
| 个人主页 | personal | 100% | 第 2 轮 | ✅ |
| 作品集 | portfolio | 94% | 第 2 轮 | ✅ |
| 在线简历 | resume | 100% | 第 2 轮 | ✅ |
| 博客站 | blog | 89% | 第 2 轮 | ✅ |
| 企业官网 | corporate | 100% | 第 2 轮 | ✅ |
| SaaS 产品页 | saas | 100% | 第 3 轮 | ✅ |
| 活动落地页 | landing | 94% | 第 2 轮 | ✅ |
| 餐饮门店页 | restaurant | 100% | 第 2 轮 | ✅ |
| 文档站 | docs | **69%** | 第 3 轮 | ❌ **Beta** |
| 知识库 Wiki | wiki | 100% | 第 2 轮 | ✅ |
| 教育课程页 | education | 100% | 第 2 轮 | ✅ |
| 社区论坛 | forum | 100% | 第 2 轮 | ✅ |
| 数据大屏 | dashboard | 100% | 第 2 轮 | ✅ |
| 电商橱窗 | shop | 94% | 第 3 轮 | ✅ |

### 迭代记录

- **基线(第 1 轮,2026-02-14)**:总通过率 44.8%,12/14 类型不达标。
  失败主因:输出在 4096 max_tokens 处截断,末尾代码围栏未闭合导致解析失败。
- **迭代 1(第 2 轮)**:max_tokens 提至 8192;系统提示词新增「完整性高于一切、
  控制在 2500 tokens 以内、单文件自包含」约束;`parseModelOutput` 增加未闭合
  围栏按 EOF 抢救。→ 90.9%,saas/docs/shop 仍 <80%。
- **迭代 2(第 3 轮,只重跑 saas/docs/shop)**:诊断发现模型偶发「只输出文件清单
  就结束回复」,系统提示词新增「清单之后必须紧跟全部文件的代码块」硬约束。
  → saas 100%、shop 94%;docs 69% 仍不达标。

### Beta 类型与已知问题

- **docs(文档站)69%**:单用例波动大(模型偶发不遵循输出协议,散文式作答)。
  两轮迭代预算已用完,按规则标记 Beta。后续方向:文档站骨架强调「先代码后说明」、
  或在生成代理(SF-1-3)层面对解析失败自动重试一次。

## 复现

```bash
# 需要 OpenAI 兼容 key(见根目录 .env.example)
set -a; source ../../.env; set +a
pnpm --filter prompts eval                      # 全量 42 用例
pnpm --filter prompts eval -- --only docs,shop  # 只跑指定类型
pnpm --filter prompts eval -- --dry-run         # 离线管线自检(不代表真实质量)
```

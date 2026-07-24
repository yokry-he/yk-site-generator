import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

interface SiteTypeRow {
  siteType: string
  name?: string
  overall: number
  parseable?: number
  keywordHit?: number
  headComplete?: number
  htmlSane?: number
  averageDurationMs?: number
}

interface QualityReport {
  generatedAt: string
  authoritative?: boolean
  mode?: string
  model?: string | null
  modelLabel?: string | null
  reportId?: string
  passed?: boolean
  summary: {
    executions?: number
    failures?: number
    overall: number
    parseable: number
    keywordHit?: number
    headComplete: number
    htmlSane: number
    averageDurationMs?: number
  }
  bySiteType: SiteTypeRow[]
  provenance?: { commitSha?: string | null; workflowRunId?: string | null }
  parameters?: Record<string, unknown>
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function percent(value: number | undefined): string {
  return `${((value ?? 0) * 100).toFixed(1)}%`
}

function escapeCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function modelName(report: QualityReport): string {
  return report.modelLabel ?? report.model ?? 'unknown-model'
}

async function main() {
  const rawPaths = argValue('--reports') ?? process.env.EVAL_REPORTS
  if (!rawPaths) throw new Error('请通过 --reports 或 EVAL_REPORTS 提供逗号分隔的报告路径')
  const paths = rawPaths.split(',').map((value) => resolve(process.cwd(), value.trim())).filter(Boolean)
  if (!paths.length) throw new Error('没有可读取的质量报告')

  const reports = await Promise.all(
    paths.map(async (path) => JSON.parse(await readFile(path, 'utf8')) as QualityReport),
  )
  reports.sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt))

  const siteTypes = Array.from(
    new Set(reports.flatMap((report) => report.bySiteType.map((row) => row.siteType))),
  ).sort()

  const entries = reports.map((report, index) => {
    const previous = [...reports.slice(0, index)].reverse().find((candidate) => modelName(candidate) === modelName(report))
    return {
      reportId: report.reportId ?? null,
      generatedAt: report.generatedAt,
      authoritative: Boolean(report.authoritative),
      model: modelName(report),
      commitSha: report.provenance?.commitSha ?? null,
      workflowRunId: report.provenance?.workflowRunId ?? null,
      passed: Boolean(report.passed),
      summary: report.summary,
      bySiteType: Object.fromEntries(report.bySiteType.map((row) => [row.siteType, row])),
      deltaFromPrevious: previous
        ? {
            overall: report.summary.overall - previous.summary.overall,
            parseable: report.summary.parseable - previous.summary.parseable,
            headComplete: report.summary.headComplete - previous.summary.headComplete,
            htmlSane: report.summary.htmlSane - previous.summary.htmlSane,
          }
        : null,
      parameters: report.parameters ?? null,
    }
  })

  const jsonOutput = resolve(
    process.cwd(),
    argValue('--json') ?? process.env.EVAL_TREND_JSON ?? '../../artifacts/prompt-eval-trend.json',
  )
  const markdownOutput = resolve(
    process.cwd(),
    argValue('--markdown') ?? process.env.EVAL_TREND_MARKDOWN ?? '../../artifacts/prompt-eval-trend.md',
  )

  const trend = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    reportCount: entries.length,
    siteTypes,
    entries,
  }

  const lines: string[] = [
    '# SiteForge Prompt Quality Trend',
    '',
    '## 总体趋势',
    '',
    '| 日期 | 模型 | 权威 | 提交 | 总分 | 解析 | SEO | HTML | 平均耗时 | 判定 |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
  ]
  for (const report of reports) {
    lines.push(
      `| ${escapeCell(report.generatedAt)} | ${escapeCell(modelName(report))} | ${report.authoritative ? '是' : '否'} | ${escapeCell(report.provenance?.commitSha?.slice(0, 12) ?? '-')} | ${percent(report.summary.overall)} | ${percent(report.summary.parseable)} | ${percent(report.summary.headComplete)} | ${percent(report.summary.htmlSane)} | ${Math.round(report.summary.averageDurationMs ?? 0)} ms | ${report.passed ? 'PASS' : 'REVIEW'} |`,
    )
  }

  lines.push('', '## 模型 × 站点类型矩阵', '')
  lines.push(`| 日期 / 模型 | ${siteTypes.map(escapeCell).join(' | ')} |`)
  lines.push(`| --- | ${siteTypes.map(() => '---:').join(' | ')} |`)
  for (const report of reports) {
    const scores = new Map(report.bySiteType.map((row) => [row.siteType, row.overall]))
    lines.push(
      `| ${escapeCell(`${report.generatedAt} / ${modelName(report)}`)} | ${siteTypes.map((siteType) => percent(scores.get(siteType))).join(' | ')} |`,
    )
  }

  lines.push('', '## 低于 80% 的类型', '')
  let hasBeta = false
  for (const report of reports) {
    for (const row of report.bySiteType.filter((item) => item.overall < 0.8)) {
      hasBeta = true
      lines.push(`- ${modelName(report)} · ${row.name ?? row.siteType} (${row.siteType}): ${percent(row.overall)}`)
    }
  }
  if (!hasBeta) lines.push('- 无')

  await mkdir(dirname(jsonOutput), { recursive: true })
  await mkdir(dirname(markdownOutput), { recursive: true })
  await writeFile(jsonOutput, `${JSON.stringify(trend, null, 2)}\n`, 'utf8')
  await writeFile(markdownOutput, `${lines.join('\n')}\n`, 'utf8')
  console.log(`趋势 JSON: ${jsonOutput}`)
  console.log(`趋势 Markdown: ${markdownOutput}`)
}

main().catch((error) => {
  console.error('生成质量趋势失败:', error instanceof Error ? error.message : error)
  process.exit(1)
})

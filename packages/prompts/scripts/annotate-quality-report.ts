import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function numberValue(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function safeEndpointLabel(raw: string | undefined): string | null {
  if (process.env.EVAL_ENDPOINT_LABEL) return process.env.EVAL_ENDPOINT_LABEL
  if (!raw) return null
  try {
    return new URL(raw).hostname
  } catch {
    return 'custom-endpoint'
  }
}

async function main() {
  const inputPath = resolve(
    process.cwd(),
    argValue('--input') ?? process.env.EVAL_REPORT_PATH ?? '../../artifacts/prompt-eval.json',
  )
  const outputPath = resolve(process.cwd(), argValue('--output') ?? inputPath)
  const report = JSON.parse(await readFile(inputPath, 'utf8')) as Record<string, unknown>

  const originalBaseUrl = typeof report.baseUrl === 'string' ? report.baseUrl : process.env.EVAL_BASE_URL
  delete report.baseUrl

  const generatedAt = typeof report.generatedAt === 'string' ? report.generatedAt : new Date().toISOString()
  const model = typeof report.model === 'string' ? report.model : process.env.EVAL_MODEL ?? null
  const commitSha = process.env.EVAL_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null
  const modelLabel = process.env.EVAL_MODEL_LABEL ?? model
  const runsPerCase = numberValue(
    typeof report.runsPerCase === 'number' ? String(report.runsPerCase) : process.env.EVAL_RUNS,
    1,
  )

  report.schemaVersion = Math.max(numberValue(String(report.schemaVersion ?? 1), 1), 2)
  report.generatedAt = generatedAt
  report.model = model
  report.modelLabel = modelLabel
  report.endpointLabel = safeEndpointLabel(originalBaseUrl)
  report.provenance = {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    commitSha,
    ref: process.env.GITHUB_REF_NAME ?? process.env.GITHUB_REF ?? null,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    workflowRunId: process.env.GITHUB_RUN_ID ?? null,
    workflowRunNumber: process.env.GITHUB_RUN_NUMBER ?? null,
    workflowAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    actor: process.env.GITHUB_ACTOR ?? null,
  }
  report.parameters = {
    runsPerCase,
    concurrency: numberValue(process.env.EVAL_CONCURRENCY, 3),
    timeoutMs: numberValue(process.env.EVAL_TIMEOUT_MS, 180_000),
    temperature: numberValue(process.env.EVAL_TEMPERATURE, 0.7),
    maxTokens: numberValue(process.env.EVAL_MAX_TOKENS, 8192),
  }
  report.reportId = [
    generatedAt.replace(/[:.]/g, '-'),
    String(modelLabel ?? 'unknown-model').replace(/[^a-zA-Z0-9._-]+/g, '-'),
    commitSha ? String(commitSha).slice(0, 12) : 'local',
  ].join('__')

  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`质量报告证据链已补全: ${outputPath}`)
}

main().catch((error) => {
  console.error('补全质量报告失败:', error instanceof Error ? error.message : error)
  process.exit(1)
})

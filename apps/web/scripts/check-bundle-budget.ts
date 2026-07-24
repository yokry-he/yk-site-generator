import { gzipSync } from 'node:zlib'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'

interface AssetMetric {
  path: string
  bytes: number
  gzipBytes: number
  extension: string
}

interface BudgetResult {
  generatedAt: string
  distDir: string
  budgets: {
    totalJsGzipBytes: number
    largestJsGzipBytes: number
    totalCssGzipBytes: number
    totalAssetBytes: number
  }
  totals: {
    totalJsGzipBytes: number
    largestJsGzipBytes: number
    totalCssGzipBytes: number
    totalAssetBytes: number
  }
  passed: boolean
  violations: string[]
  assets: AssetMetric[]
}

function kb(value: number): number {
  return Math.round(value * 1024)
}

function envKb(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return kb(fallback)
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正数(KiB)`)
  }
  return kb(parsed)
}

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current)
  const files: string[] = []
  for (const entry of entries) {
    const path = resolve(current, entry)
    const info = await stat(path)
    if (info.isDirectory()) files.push(...(await listFiles(root, path)))
    else if (info.isFile()) files.push(path)
  }
  return files
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

async function main() {
  const distDir = resolve(process.cwd(), process.env.BUNDLE_DIST_DIR ?? 'dist')
  const reportPath = resolve(
    process.cwd(),
    process.env.BUNDLE_REPORT_PATH ?? '../../artifacts/web-bundle-budget.json',
  )

  const budgets = {
    totalJsGzipBytes: envKb('BUNDLE_MAX_TOTAL_JS_GZIP_KB', 350),
    largestJsGzipBytes: envKb('BUNDLE_MAX_LARGEST_JS_GZIP_KB', 80),
    totalCssGzipBytes: envKb('BUNDLE_MAX_TOTAL_CSS_GZIP_KB', 25),
    totalAssetBytes: envKb('BUNDLE_MAX_TOTAL_ASSET_KB', 1200),
  }

  const files = await listFiles(distDir)
  const assets: AssetMetric[] = []
  for (const path of files) {
    const content = await readFile(path)
    assets.push({
      path: relative(distDir, path),
      bytes: content.byteLength,
      gzipBytes: gzipSync(content).byteLength,
      extension: extname(path).toLowerCase(),
    })
  }
  assets.sort((a, b) => b.gzipBytes - a.gzipBytes)

  const js = assets.filter((asset) => asset.extension === '.js')
  const css = assets.filter((asset) => asset.extension === '.css')
  const totals = {
    totalJsGzipBytes: js.reduce((sum, asset) => sum + asset.gzipBytes, 0),
    largestJsGzipBytes: js[0]?.gzipBytes ?? 0,
    totalCssGzipBytes: css.reduce((sum, asset) => sum + asset.gzipBytes, 0),
    totalAssetBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  }

  const violations: string[] = []
  if (totals.totalJsGzipBytes > budgets.totalJsGzipBytes) {
    violations.push(
      `JS gzip 总量 ${formatKb(totals.totalJsGzipBytes)} 超过 ${formatKb(budgets.totalJsGzipBytes)}`,
    )
  }
  if (totals.largestJsGzipBytes > budgets.largestJsGzipBytes) {
    violations.push(
      `最大 JS gzip ${formatKb(totals.largestJsGzipBytes)} 超过 ${formatKb(budgets.largestJsGzipBytes)}`,
    )
  }
  if (totals.totalCssGzipBytes > budgets.totalCssGzipBytes) {
    violations.push(
      `CSS gzip 总量 ${formatKb(totals.totalCssGzipBytes)} 超过 ${formatKb(budgets.totalCssGzipBytes)}`,
    )
  }
  if (totals.totalAssetBytes > budgets.totalAssetBytes) {
    violations.push(
      `构建产物原始总量 ${formatKb(totals.totalAssetBytes)} 超过 ${formatKb(budgets.totalAssetBytes)}`,
    )
  }

  const report: BudgetResult = {
    generatedAt: new Date().toISOString(),
    distDir,
    budgets,
    totals,
    passed: violations.length === 0,
    violations,
    assets,
  }

  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log('Web bundle performance budget')
  console.table({
    'JS gzip 总量': formatKb(totals.totalJsGzipBytes),
    '最大 JS gzip': formatKb(totals.largestJsGzipBytes),
    'CSS gzip 总量': formatKb(totals.totalCssGzipBytes),
    '全部产物原始总量': formatKb(totals.totalAssetBytes),
  })
  console.log(`报告: ${reportPath}`)

  if (violations.length) {
    for (const violation of violations) console.error(`❌ ${violation}`)
    process.exitCode = 1
  } else {
    console.log('✅ Bundle performance budget passed')
  }
}

main().catch((error) => {
  console.error('Bundle performance budget failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})

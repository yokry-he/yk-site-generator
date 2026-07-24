import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { hostname, platform, release } from 'node:os'
import { dirname, resolve } from 'node:path'
import { performance as nodePerformance } from 'node:perf_hooks'
import {
  chromium,
  devices,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test'
import { mockAuthenticatedApi, mockPublicApi, project } from '../tests/e2e/fixtures'

type DeviceKind = 'desktop' | 'mobile'
type ApiMode = 'public' | 'authenticated'
type NetworkKind = 'local' | 'slow-4g'

interface RouteScenario {
  id: string
  path: string
  api: ApiMode
  readySelector: string
}

interface NavigationSample {
  scenario: string
  path: string
  device: DeviceKind
  network: NetworkKind
  run: number
  readyMs: number
  ttfbMs: number
  domContentLoadedMs: number
  loadEventMs: number
  fcpMs: number
  lcpMs: number
  cls: number
  resourceCount: number
  transferBytes: number
}

interface InteractionSample {
  scenario: string
  run: number
  durationMs: number
}

interface ParseSample {
  sizeBytes: number
  run: number
  durationMs: number
  elementCount: number
}

interface Distribution {
  count: number
  min: number
  mean: number
  p50: number
  p95: number
  max: number
}

const baseUrl = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:4173'
const reportPath = resolve(
  process.cwd(),
  process.env.PERF_REPORT_PATH ?? '../../artifacts/web-performance.json',
)
const markdownPath = resolve(
  process.cwd(),
  process.env.PERF_MARKDOWN_PATH ?? '../../artifacts/web-performance.md',
)
const enforce = process.env.PERF_ENFORCE !== 'false'

const routes: RouteScenario[] = [
  { id: 'home', path: '/', api: 'public', readySelector: 'main h1' },
  { id: 'templates', path: '/templates', api: 'public', readySelector: 'main h1' },
  {
    id: 'template-detail',
    path: '/templates/aurora-saas',
    api: 'public',
    readySelector: 'main h1',
  },
  {
    id: 'project-workspace',
    path: `/projects/${project.id}`,
    api: 'authenticated',
    readySelector: 'main h1',
  },
]

const budgets = {
  navigation: {
    desktopLocal: { readyP95Ms: 2_500, lcpP95Ms: 2_000, clsP95: 0.1 },
    mobileLocal: { readyP95Ms: 3_500, lcpP95Ms: 3_000, clsP95: 0.1 },
    mobileSlow4g: { readyP95Ms: 8_000, lcpP95Ms: 6_000, clsP95: 0.1 },
  },
  interactions: {
    'command-palette': 500,
    'template-preview': 800,
    'editor-open': 1_500,
    'version-save': 1_500,
  } as Record<string, number>,
  parsing: {
    '512000': 200,
    '2097152': 650,
    '5242880': 1_500,
  } as Record<string, number>,
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function percentile(values: number[], ratio: number): number {
  const ordered = [...values].sort((left, right) => left - right)
  if (!ordered.length) return 0
  return ordered[Math.max(0, Math.ceil(ordered.length * ratio) - 1)]
}

function distribution(values: number[]): Distribution {
  if (!values.length) return { count: 0, min: 0, mean: 0, p50: 0, p95: 0, max: 0 }
  return {
    count: values.length,
    min: round(Math.min(...values)),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    p50: round(percentile(values, 0.5)),
    p95: round(percentile(values, 0.95)),
    max: round(Math.max(...values)),
  }
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Preview may still be starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error(`预览服务在 ${timeoutMs}ms 内未就绪: ${url}`)
}

async function startPreview(): Promise<ChildProcess | null> {
  if (process.env.PERF_SKIP_SERVER === 'true') {
    await waitForServer(baseUrl)
    return null
  }
  await access(resolve(process.cwd(), 'dist/index.html'))
  const executable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const server = spawn(
    executable,
    ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4173'],
    { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let logs = ''
  server.stdout?.on('data', (chunk) => {
    logs += String(chunk)
  })
  server.stderr?.on('data', (chunk) => {
    logs += String(chunk)
  })
  try {
    await waitForServer(baseUrl)
    return server
  } catch (error) {
    server.kill('SIGTERM')
    throw new Error(`${error instanceof Error ? error.message : error}\n${logs}`)
  }
}

async function stopPreview(server: ChildProcess | null): Promise<void> {
  if (!server || server.killed) return
  server.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolvePromise) => server.once('exit', () => resolvePromise())),
    new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 2_000)),
  ])
}

async function newContext(browser: Browser, device: DeviceKind): Promise<BrowserContext> {
  const descriptor = devices[device === 'mobile' ? 'Pixel 7' : 'Desktop Chrome']
  return browser.newContext({
    ...descriptor,
    viewport: device === 'mobile' ? { width: 412, height: 915 } : { width: 1440, height: 1000 },
    locale: 'zh-CN',
    colorScheme: 'light',
  })
}

async function createPage(
  context: BrowserContext,
  api: ApiMode,
  network: NetworkKind,
): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 }
    Object.defineProperty(window, '__siteforgePerfMetrics', { value: metrics })
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.lcp = Math.max(metrics.lcp, entry.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      // Some Chromium builds may omit this entry type.
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
          if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0
        }
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {
      // Some Chromium builds may omit this entry type.
    }
  })
  if (api === 'authenticated') await mockAuthenticatedApi(page)
  else await mockPublicApi(page)

  if (network === 'slow-4g') {
    const session = await context.newCDPSession(page)
    await session.send('Network.enable')
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150,
      downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
      uploadThroughput: Math.round((750 * 1024) / 8),
      connectionType: 'cellular4g',
    })
  }
  return page
}

async function browserMetrics(page: Page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const fcp =
      performance.getEntriesByType('paint').find((entry) => entry.name === 'first-contentful-paint')
        ?.startTime ?? 0
    const metrics = (
      window as unknown as { __siteforgePerfMetrics?: { lcp: number; cls: number } }
    ).__siteforgePerfMetrics
    return {
      ttfbMs: navigation ? navigation.responseStart - navigation.requestStart : 0,
      domContentLoadedMs: navigation
        ? navigation.domContentLoadedEventEnd - navigation.startTime
        : 0,
      loadEventMs: navigation ? navigation.loadEventEnd - navigation.startTime : 0,
      fcpMs: fcp,
      lcpMs: metrics?.lcp || fcp,
      cls: metrics?.cls ?? 0,
      resourceCount: resources.length,
      transferBytes: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
    }
  })
}

async function measureNavigation(
  browser: Browser,
  scenario: RouteScenario,
  device: DeviceKind,
  network: NetworkKind,
  run: number,
): Promise<NavigationSample> {
  const context = await newContext(browser, device)
  try {
    const page = await createPage(context, scenario.api, network)
    const startedAt = nodePerformance.now()
    await page.goto(`${baseUrl}${scenario.path}`, { waitUntil: 'domcontentloaded' })
    await page.locator(scenario.readySelector).first().waitFor({ state: 'visible' })
    const readyMs = nodePerformance.now() - startedAt
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    return {
      scenario: scenario.id,
      path: scenario.path,
      device,
      network,
      run,
      readyMs: round(readyMs),
      ...(await browserMetrics(page)),
    }
  } finally {
    await context.close()
  }
}

async function openScenario(
  browser: Browser,
  path: string,
  api: ApiMode,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newContext(browser, 'desktop')
  const page = await createPage(context, api, 'local')
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return { context, page }
}

async function waitUntilEnabled(page: Page, selectorLabel: RegExp): Promise<void> {
  const button = page.getByRole('button', { name: selectorLabel }).first()
  await button.waitFor({ state: 'visible' })
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if (await button.isEnabled()) return
    await page.waitForTimeout(50)
  }
  throw new Error(`按钮在 5 秒内未启用: ${selectorLabel}`)
}

async function measureInteractions(browser: Browser): Promise<InteractionSample[]> {
  const samples: InteractionSample[] = []
  for (let run = 1; run <= 5; run += 1) {
    {
      const { context, page } = await openScenario(browser, '/', 'public')
      try {
        const startedAt = nodePerformance.now()
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
        await page.getByRole('dialog', { name: '全局命令面板' }).waitFor({ state: 'visible' })
        samples.push({ scenario: 'command-palette', run, durationMs: round(nodePerformance.now() - startedAt) })
      } finally {
        await context.close()
      }
    }

    {
      const { context, page } = await openScenario(browser, '/templates/aurora-saas', 'public')
      try {
        const frame = page.locator('iframe[title="模板实时预览"]')
        const previous = await frame.getAttribute('srcdoc')
        const expected = `性能基线标题-${run}`
        const startedAt = nodePerformance.now()
        await page.getByLabel('核心标题').fill(expected)
        await page.waitForFunction(
          ({ previousValue, expectedValue }) => {
            const iframe = document.querySelector<HTMLIFrameElement>(
              'iframe[title="模板实时预览"]',
            )
            return Boolean(
              iframe?.srcdoc &&
                iframe.srcdoc !== previousValue &&
                iframe.srcdoc.includes(expectedValue),
            )
          },
          { previousValue: previous, expectedValue: expected },
        )
        samples.push({ scenario: 'template-preview', run, durationMs: round(nodePerformance.now() - startedAt) })
      } finally {
        await context.close()
      }
    }

    {
      const { context, page } = await openScenario(
        browser,
        `/projects/${project.id}`,
        'authenticated',
      )
      try {
        const editor = page
          .getByRole('dialog')
          .filter({ has: page.getByRole('button', { name: '关闭编辑器' }) })
        const openStartedAt = nodePerformance.now()
        await page.getByRole('button', { name: '可视化编辑', exact: true }).click()
        await editor.waitFor({ state: 'visible' })
        samples.push({ scenario: 'editor-open', run, durationMs: round(nodePerformance.now() - openStartedAt) })

        await editor.getByRole('button', { name: '添加', exact: true }).click()
        await editor.getByRole('button', { name: /行动号召/ }).first().click()
        await editor.getByText('有未保存修改', { exact: true }).waitFor({ state: 'visible' })
        await waitUntilEnabled(editor, /保存为新版本/)
        const saveStartedAt = nodePerformance.now()
        await editor.getByRole('button', { name: /保存为新版本/ }).click()
        await editor.getByText('已保存', { exact: true }).waitFor({ state: 'visible' })
        samples.push({ scenario: 'version-save', run, durationMs: round(nodePerformance.now() - saveStartedAt) })
      } finally {
        await context.close()
      }
    }
  }
  return samples
}

async function measureParsing(browser: Browser): Promise<ParseSample[]> {
  const context = await newContext(browser, 'desktop')
  try {
    const page = await context.newPage()
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
    const samples: ParseSample[] = []
    for (const sizeBytes of [500 * 1024, 2 * 1024 * 1024, 5 * 1024 * 1024]) {
      const rows = await page.evaluate(({ targetBytes, runs }) => {
        const block = '<section data-sf-section><h2>性能区块</h2><p>用于测量大型 HTML 解析成本。</p></section>'
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Perf</title></head><body>${block.repeat(Math.ceil(targetBytes / block.length))}</body></html>`
        const results: Array<{ run: number; durationMs: number; elementCount: number }> = []
        for (let run = 1; run <= runs; run += 1) {
          const startedAt = performance.now()
          const parsed = new DOMParser().parseFromString(html, 'text/html')
          results.push({
            run,
            durationMs: performance.now() - startedAt,
            elementCount: parsed.getElementsByTagName('*').length,
          })
        }
        return results
      }, { targetBytes: sizeBytes, runs: 5 })
      samples.push(
        ...rows.map((row) => ({
          sizeBytes,
          run: row.run,
          durationMs: round(row.durationMs),
          elementCount: row.elementCount,
        })),
      )
    }
    return samples
  } finally {
    await context.close()
  }
}

function groupNavigation(samples: NavigationSample[]) {
  const groups = new Map<string, NavigationSample[]>()
  for (const sample of samples) {
    const key = `${sample.device}:${sample.network}:${sample.scenario}`
    groups.set(key, [...(groups.get(key) ?? []), sample])
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, scoped]) => [
      key,
      {
        scenario: scoped[0].scenario,
        device: scoped[0].device,
        network: scoped[0].network,
        readyMs: distribution(scoped.map((sample) => sample.readyMs)),
        ttfbMs: distribution(scoped.map((sample) => sample.ttfbMs)),
        fcpMs: distribution(scoped.map((sample) => sample.fcpMs)),
        lcpMs: distribution(scoped.map((sample) => sample.lcpMs)),
        cls: distribution(scoped.map((sample) => sample.cls)),
        transferBytes: distribution(scoped.map((sample) => sample.transferBytes)),
      },
    ]),
  )
}

function groupInteractions(samples: InteractionSample[]) {
  const groups = new Map<string, InteractionSample[]>()
  for (const sample of samples) {
    groups.set(sample.scenario, [...(groups.get(sample.scenario) ?? []), sample])
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, scoped]) => [
      key,
      { durationMs: distribution(scoped.map((sample) => sample.durationMs)) },
    ]),
  )
}

function groupParsing(samples: ParseSample[]) {
  const groups = new Map<number, ParseSample[]>()
  for (const sample of samples) {
    groups.set(sample.sizeBytes, [...(groups.get(sample.sizeBytes) ?? []), sample])
  }
  return Object.fromEntries(
    [...groups.entries()].map(([sizeBytes, scoped]) => [
      String(sizeBytes),
      {
        sizeBytes,
        elementCount: scoped[0].elementCount,
        durationMs: distribution(scoped.map((sample) => sample.durationMs)),
      },
    ]),
  )
}

function budgetViolations(
  navigation: ReturnType<typeof groupNavigation>,
  interactions: ReturnType<typeof groupInteractions>,
  parsing: ReturnType<typeof groupParsing>,
): string[] {
  const violations: string[] = []
  for (const [key, row] of Object.entries(navigation)) {
    const limit =
      row.network === 'slow-4g'
        ? budgets.navigation.mobileSlow4g
        : row.device === 'mobile'
          ? budgets.navigation.mobileLocal
          : budgets.navigation.desktopLocal
    if (row.readyMs.p95 > limit.readyP95Ms) {
      violations.push(`${key} Ready P95 ${row.readyMs.p95}ms > ${limit.readyP95Ms}ms`)
    }
    if (row.lcpMs.p95 > limit.lcpP95Ms) {
      violations.push(`${key} LCP P95 ${row.lcpMs.p95}ms > ${limit.lcpP95Ms}ms`)
    }
    if (row.cls.p95 > limit.clsP95) {
      violations.push(`${key} CLS P95 ${row.cls.p95} > ${limit.clsP95}`)
    }
  }
  for (const [scenario, row] of Object.entries(interactions)) {
    const limit = budgets.interactions[scenario]
    if (limit && row.durationMs.p95 > limit) {
      violations.push(`${scenario} P95 ${row.durationMs.p95}ms > ${limit}ms`)
    }
  }
  for (const [sizeBytes, row] of Object.entries(parsing)) {
    const limit = budgets.parsing[sizeBytes]
    if (limit && row.durationMs.p95 > limit) {
      violations.push(`HTML ${sizeBytes} bytes P95 ${row.durationMs.p95}ms > ${limit}ms`)
    }
  }
  return violations
}

function markdown(report: {
  generatedAt: string
  commitSha: string | null
  passed: boolean
  violations: string[]
  navigation: ReturnType<typeof groupNavigation>
  interactions: ReturnType<typeof groupInteractions>
  parsing: ReturnType<typeof groupParsing>
}): string {
  const lines = [
    '# SiteForge Web Performance Baseline',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Commit: ${report.commitSha ?? 'local'}`,
    `- Result: ${report.passed ? 'PASS' : 'REVIEW'}`,
    '',
    '## Navigation',
    '',
    '| Scenario | Device | Network | Ready P50 / P95 | LCP P50 / P95 | CLS P95 |',
    '| --- | --- | --- | ---: | ---: | ---: |',
  ]
  for (const [key, row] of Object.entries(report.navigation)) {
    lines.push(
      `| ${key} | ${row.device} | ${row.network} | ${row.readyMs.p50} / ${row.readyMs.p95} ms | ${row.lcpMs.p50} / ${row.lcpMs.p95} ms | ${row.cls.p95} |`,
    )
  }
  lines.push('', '## Interactions', '', '| Scenario | P50 | P95 |', '| --- | ---: | ---: |')
  for (const [key, row] of Object.entries(report.interactions)) {
    lines.push(`| ${key} | ${row.durationMs.p50} ms | ${row.durationMs.p95} ms |`)
  }
  lines.push('', '## Large HTML parsing', '', '| Size | Elements | P50 | P95 |', '| ---: | ---: | ---: | ---: |')
  for (const row of Object.values(report.parsing)) {
    lines.push(
      `| ${Math.round(row.sizeBytes / 1024)} KiB | ${row.elementCount} | ${row.durationMs.p50} ms | ${row.durationMs.p95} ms |`,
    )
  }
  lines.push('', '## Violations', '')
  lines.push(...(report.violations.length ? report.violations.map((item) => `- ${item}`) : ['- None']))
  return `${lines.join('\n')}\n`
}

async function writeFatalReport(error: unknown): Promise<void> {
  const generatedAt = new Date().toISOString()
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  await mkdir(dirname(reportPath), { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })
  await writeFile(
    reportPath,
    `${JSON.stringify({ schemaVersion: 1, generatedAt, authoritative: false, passed: false, fatalError: message }, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    markdownPath,
    `# SiteForge Web Performance Baseline\n\n- Result: ERROR\n\n\`\`\`text\n${message}\n\`\`\`\n`,
    'utf8',
  )
}

async function main(): Promise<void> {
  const server = await startPreview()
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const navigationSamples: NavigationSample[] = []
    for (const scenario of routes) {
      for (let run = 1; run <= 5; run += 1) {
        navigationSamples.push(await measureNavigation(browser, scenario, 'desktop', 'local', run))
      }
      for (let run = 1; run <= 3; run += 1) {
        navigationSamples.push(await measureNavigation(browser, scenario, 'mobile', 'local', run))
      }
    }
    for (let run = 1; run <= 3; run += 1) {
      navigationSamples.push(await measureNavigation(browser, routes[0], 'mobile', 'slow-4g', run))
    }

    const interactionSamples = await measureInteractions(browser)
    const parseSamples = await measureParsing(browser)
    const navigation = groupNavigation(navigationSamples)
    const interactions = groupInteractions(interactionSamples)
    const parsing = groupParsing(parseSamples)
    const violations = budgetViolations(navigation, interactions, parsing)
    const generatedAt = new Date().toISOString()
    const report = {
      schemaVersion: 1,
      generatedAt,
      authoritative: true,
      commitSha: process.env.PERF_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
      environment: {
        ci: Boolean(process.env.CI),
        runner: hostname(),
        platform: platform(),
        release: release(),
        node: process.version,
        browser: `Chromium ${browser.version()}`,
        baseUrl,
      },
      protocol: {
        desktopLocalRunsPerRoute: 5,
        mobileLocalRunsPerRoute: 3,
        mobileSlow4gRuns: 3,
        interactionRuns: 5,
        parseRunsPerSize: 5,
      },
      budgets,
      passed: violations.length === 0,
      violations,
      navigation,
      interactions,
      parsing,
      raw: { navigation: navigationSamples, interactions: interactionSamples, parsing: parseSamples },
    }
    const reportMarkdown = markdown(report)
    await mkdir(dirname(reportPath), { recursive: true })
    await mkdir(dirname(markdownPath), { recursive: true })
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(markdownPath, reportMarkdown, 'utf8')
    console.log(reportMarkdown)
    console.log(`JSON report: ${reportPath}`)
    if (enforce && violations.length) process.exitCode = 1
  } finally {
    await browser?.close()
    await stopPreview(server)
  }
}

main().catch(async (error) => {
  console.error('Web 性能基线失败:', error instanceof Error ? error.stack ?? error.message : error)
  await writeFatalReport(error)
  process.exit(1)
})

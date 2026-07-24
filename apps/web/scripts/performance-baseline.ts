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

interface NetworkProfile {
  name: 'local' | 'slow-4g'
  latencyMs: number
  downloadBytesPerSecond: number
  uploadBytesPerSecond: number
}

interface NavigationScenario {
  id: string
  path: string
  api: ApiMode
  readySelector: string
}

interface BrowserMetric {
  ttfbMs: number
  domContentLoadedMs: number
  loadEventMs: number
  fcpMs: number
  lcpMs: number
  cls: number
  resourceCount: number
  transferBytes: number
  encodedBodyBytes: number
}

interface NavigationSample extends BrowserMetric {
  scenario: string
  path: string
  device: DeviceKind
  network: NetworkProfile['name']
  run: number
  readyMs: number
}

interface InteractionSample {
  scenario: string
  device: DeviceKind
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

const networks: Record<NetworkProfile['name'], NetworkProfile> = {
  local: {
    name: 'local',
    latencyMs: 0,
    downloadBytesPerSecond: -1,
    uploadBytesPerSecond: -1,
  },
  'slow-4g': {
    name: 'slow-4g',
    latencyMs: 150,
    downloadBytesPerSecond: Math.round((1.6 * 1024 * 1024) / 8),
    uploadBytesPerSecond: Math.round((750 * 1024) / 8),
  },
}

const scenarios: NavigationScenario[] = [
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
    commandPalette: 500,
    templatePreview: 800,
    editorOpen: 1_500,
    versionSave: 1_500,
  },
  parse: {
    '512000': 200,
    '2097152': 650,
    '5242880': 1_500,
  } as Record<string, number>,
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  return sorted[index]
}

function distribution(values: number[]): Distribution {
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
      // The preview server may still be starting.
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
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const server = spawn(command, ['exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '4173'], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let logs = ''
  server.stdout?.on('data', (chunk) => {
    logs += String(chunk)
  })
  server.stderr?.on('data', (chunk) => {
    logs += String(chunk)
  })
  server.once('exit', (code) => {
    if (code && code !== 0) console.error(`Vite preview 提前退出(${code}):\n${logs}`)
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
  const descriptor = device === 'mobile' ? devices['Pixel 7'] : devices['Desktop Chrome']
  return browser.newContext({
    ...descriptor,
    viewport: device === 'mobile' ? { width: 412, height: 915 } : { width: 1440, height: 1000 },
    locale: 'zh-CN',
    colorScheme: 'light',
  })
}

async function preparePage(
  context: BrowserContext,
  api: ApiMode,
  network: NetworkProfile,
): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript(() => {
    const state = { lcp: 0, cls: 0 }
    Object.defineProperty(window, '__siteforgePerformance', {
      value: state,
      configurable: false,
      enumerable: false,
      writable: false,
    })
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.lcp = Math.max(state.lcp, entry.startTime)
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      // Browser may not expose LCP in all environments.
    }
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
          if (!shift.hadRecentInput) state.cls += shift.value ?? 0
        }
      }).observe({ type: 'layout-shift', buffered: true })
    } catch {
      // Browser may not expose layout-shift in all environments.
    }
  })

  if (api === 'authenticated') await mockAuthenticatedApi(page)
  else await mockPublicApi(page)

  if (network.name !== 'local') {
    const session = await context.newCDPSession(page)
    await session.send('Network.enable')
    await session.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: network.latencyMs,
      downloadThroughput: network.downloadBytesPerSecond,
      uploadThroughput: network.uploadBytesPerSecond,
      connectionType: 'cellular4g',
    })
  }
  return page
}

async function readBrowserMetrics(page: Page): Promise<BrowserMetric> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paints = performance.getEntriesByType('paint')
    const fcp = paints.find((entry) => entry.name === 'first-contentful-paint')?.startTime ?? 0
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    const state = (window as unknown as { __siteforgePerformance?: { lcp: number; cls: number } })
      .__siteforgePerformance
    return {
      ttfbMs: nav ? nav.responseStart - nav.requestStart : 0,
      domContentLoadedMs: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
      loadEventMs: nav ? nav.loadEventEnd - nav.startTime : 0,
      fcpMs: fcp,
      lcpMs: state?.lcp || fcp,
      cls: state?.cls ?? 0,
      resourceCount: resources.length,
      transferBytes: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
      encodedBodyBytes: resources.reduce(
        (sum, resource) => sum + (resource.encodedBodySize || 0),
        0,
      ),
    }
  })
}

async function measureNavigation(
  browser: Browser,
  scenario: NavigationScenario,
  device: DeviceKind,
  network: NetworkProfile,
  run: number,
): Promise<NavigationSample> {
  const context = await newContext(browser, device)
  try {
    const page = await preparePage(context, scenario.api, network)
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
      network: network.name,
      run,
      readyMs: round(readyMs),
      ...(await readBrowserMetrics(page)),
    }
  } finally {
    await context.close()
  }
}

async function loadedPage(
  browser: Browser,
  device: DeviceKind,
  path: string,
  api: ApiMode,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await newContext(browser, device)
  const page = await preparePage(context, api, networks.local)
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  return { context, page }
}

async function measureInteractions(browser: Browser, runs: number): Promise<InteractionSample[]> {
  const samples: InteractionSample[] = []
  for (let run = 1; run <= runs; run += 1) {
    {
      const { context, page } = await loadedPage(browser, 'desktop', '/', 'public')
      try {
        const startedAt = nodePerformance.now()
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
        await page.getByRole('dialog', { name: '全局命令面板' }).waitFor({ state: 'visible' })
        samples.push({ scenario: 'command-palette', device: 'desktop', run, durationMs: round(nodePerformance.now() - startedAt) })
      } finally {
        await context.close()
      }
    }

    {
      const { context, page } = await loadedPage(
        browser,
        'desktop',
        '/templates/aurora-saas',
        'public',
      )
      try {
        const frame = page.locator('iframe[title="模板实时预览"]')
        const before = await frame.getAttribute('srcdoc')
        const nextTitle = `性能基线标题-${run}`
        const startedAt = nodePerformance.now()
        await page.getByLabel('核心标题').fill(nextTitle)
        await page.waitForFunction(
          ({ previous, expected }) => {
            const iframe = document.querySelector<HTMLIFrameElement>('iframe[title="模板实时预览"]')
            return Boolean(iframe?.srcdoc && iframe.srcdoc !== previous && iframe.srcdoc.includes(expected))
          },
          { previous: before, expected: nextTitle },
        )
        samples.push({ scenario: 'template-preview', device: 'desktop', run, durationMs: round(nodePerformance.now() - startedAt) })
      } finally {
        await context.close()
      }
    }

    {
      const { context, page } = await loadedPage(
        browser,
        'desktop',
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
        samples.push({ scenario: 'editor-open', device: 'desktop', run, durationMs: round(nodePerformance.now() - openStartedAt) })

        const saveStartedAt = nodePerformance.now()
        await editor.getByRole('button', { name: /保存为新版本/ }).click()
        await editor.getByText(/已保存/).waitFor({ state: 'visible' })
        samples.push({ scenario: 'version-save', device: 'desktop', run, durationMs: round(nodePerformance.now() - saveStartedAt) })
      } finally {
        await context.close()
      }
    }
  }
  return samples
}

async function measureHtmlParsing(browser: Browser): Promise<ParseSample[]> {
  const context = await newContext(browser, 'desktop')
  try {
    const page = await context.newPage()
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' })
    const sizes = [500 * 1024, 2 * 1024 * 1024, 5 * 1024 * 1024]
    const samples: ParseSample[] = []
    for (const sizeBytes of sizes) {
      const rows = await page.evaluate(({ targetBytes, runs }) => {
        const block = '<section data-sf-section><h2>性能区块</h2><p>用于测量大型 HTML 解析成本。</p></section>'
        const count = Math.ceil(targetBytes / block.length)
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Perf</title></head><body>${block.repeat(count)}</body></html>`
        const output: { run: number; durationMs: number; elementCount: number }[] = []
        for (let run = 1; run <= runs; run += 1) {
          const startedAt = performance.now()
          const documentResult = new DOMParser().parseFromString(html, 'text/html')
          const elementCount = documentResult.getElementsByTagName('*').length
          output.push({ run, durationMs: performance.now() - startedAt, elementCount })
        }
        return output
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
        device: scoped[0].device,
        network: scoped[0].network,
        scenario: scoped[0].scenario,
        path: scoped[0].path,
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
      { device: scoped[0].device, durationMs: distribution(scoped.map((sample) => sample.durationMs)) },
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

function evaluateBudgets(
  navigation: ReturnType<typeof groupNavigation>,
  interactions: ReturnType<typeof groupInteractions>,
  parsing: ReturnType<typeof groupParsing>,
): string[] {
  const violations: string[] = []
  for (const [key, row] of Object.entries(navigation)) {
    const budget =
      row.network === 'slow-4g'
        ? budgets.navigation.mobileSlow4g
        : row.device === 'mobile'
          ? budgets.navigation.mobileLocal
          : budgets.navigation.desktopLocal
    if (row.readyMs.p95 > budget.readyP95Ms) {
      violations.push(`${key} ready P95 ${row.readyMs.p95}ms > ${budget.readyP95Ms}ms`)
    }
    if (row.lcpMs.p95 > budget.lcpP95Ms) {
      violations.push(`${key} LCP P95 ${row.lcpMs.p95}ms > ${budget.lcpP95Ms}ms`)
    }
    if (row.cls.p95 > budget.clsP95) {
      violations.push(`${key} CLS P95 ${row.cls.p95} > ${budget.clsP95}`)
    }
  }

  for (const [scenario, row] of Object.entries(interactions)) {
    const camel = scenario.replace(/-([a-z])/g, (_match, value: string) => value.toUpperCase()) as keyof typeof budgets.interactions
    const limit = budgets.interactions[camel]
    if (limit && row.durationMs.p95 > limit) {
      violations.push(`${scenario} P95 ${row.durationMs.p95}ms > ${limit}ms`)
    }
  }

  for (const [size, row] of Object.entries(parsing)) {
    const limit = budgets.parse[size]
    if (limit && row.durationMs.p95 > limit) {
      violations.push(`HTML ${size} bytes parse P95 ${row.durationMs.p95}ms > ${limit}ms`)
    }
  }
  return violations
}

function markdownReport(report: {
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
    '| Scenario | Device | Network | Ready P50 / P95 | LCP P50 / P95 | CLS P95 | Transfer |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |',
  ]
  for (const [key, row] of Object.entries(report.navigation)) {
    lines.push(
      `| ${key} | ${row.device} | ${row.network} | ${row.readyMs.p50} / ${row.readyMs.p95} ms | ${row.lcpMs.p50} / ${row.lcpMs.p95} ms | ${row.cls.p95} | ${Math.round(row.transferBytes.p50 / 1024)} KiB |`,
    )
  }
  lines.push(
    '',
    '## Interactions',
    '',
    '| Scenario | P50 | P95 |',
    '| --- | ---: | ---: |',
  )
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
  if (report.violations.length) lines.push(...report.violations.map((item) => `- ${item}`))
  else lines.push('- None')
  return `${lines.join('\n')}\n`
}

async function main() {
  const server = await startPreview()
  let browser: Browser | null = null
  try {
    browser = await chromium.launch({ headless: true })
    const browserVersion = browser.version()
    const navigationSamples: NavigationSample[] = []

    for (const scenario of scenarios) {
      for (let run = 1; run <= 5; run += 1) {
        navigationSamples.push(
          await measureNavigation(browser, scenario, 'desktop', networks.local, run),
        )
      }
      for (let run = 1; run <= 3; run += 1) {
        navigationSamples.push(
          await measureNavigation(browser, scenario, 'mobile', networks.local, run),
        )
      }
    }
    for (let run = 1; run <= 3; run += 1) {
      navigationSamples.push(
        await measureNavigation(browser, scenarios[0], 'mobile', networks['slow-4g'], run),
      )
    }

    const interactionSamples = await measureInteractions(browser, 5)
    const parseSamples = await measureHtmlParsing(browser)
    const navigation = groupNavigation(navigationSamples)
    const interactions = groupInteractions(interactionSamples)
    const parsing = groupParsing(parseSamples)
    const violations = evaluateBudgets(navigation, interactions, parsing)
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
        browser: `Chromium ${browserVersion}`,
        baseUrl,
      },
      sampleProtocol: {
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
      raw: {
        navigation: navigationSamples,
        interactions: interactionSamples,
        parsing: parseSamples,
      },
    }

    await mkdir(dirname(reportPath), { recursive: true })
    await mkdir(dirname(markdownPath), { recursive: true })
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    await writeFile(markdownPath, markdownReport(report), 'utf8')
    console.log(markdownReport(report))
    console.log(`JSON report: ${reportPath}`)
    console.log(`Markdown report: ${markdownPath}`)

    if (enforce && violations.length) process.exitCode = 1
  } finally {
    await browser?.close()
    await stopPreview(server)
  }
}

main().catch((error) => {
  console.error('Web 性能基线失败:', error instanceof Error ? error.stack ?? error.message : error)
  process.exit(1)
})

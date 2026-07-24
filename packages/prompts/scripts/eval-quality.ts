import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  SITE_TYPE_PROFILES,
  buildGenerationPrompt,
  type SiteTypeProfile,
} from '../src/index'

process.env.VITEST = 'true'
const { scoreOutput } = await import('./eval-prompts')

const EVAL_CASES: Record<string, string[]> = {
  personal: [
    '为独立咖啡师小周生成个人主页,突出手冲课程预约和每周杯测活动',
    '我是自由插画师阿梨,想要一个温暖的个人主页展示我的猫咪插画和约稿方式',
    '帮我做一个程序员个人主页,我叫老白,做后端十年,想接技术顾问的私活',
  ],
  portfolio: [
    '为 UI 设计师陈默生成作品集,主打三个 App 改版案例和两个车载 HMI 项目',
    '建筑摄影师大川的作品集,分城市风光、室内空间两个系列,支持大图浏览',
    '独立游戏开发者小鹿的作品集,展示四款已上线小游戏,带试玩截图和商店链接',
  ],
  resume: [
    '为应聘前端工程师的应届生林小满做在线简历,强调实习经历和三个课程项目',
    '帮一位有八年经验的产品经理做在线简历,求职方向是 AI 产品负责人',
    '我是转行做数据分析的前会计,需要一份突出 SQL 和报表项目经历的在线简历',
  ],
  blog: [
    '做一个专注家庭烘焙的博客,有面包、蛋糕、失败复盘三个分类,风格温馨',
    '为数码爱好者老张生成博客首页,主要是耳机评测和桌面搭配两类文章',
    '我想记录环游中国的摩旅日记,做一个按省份分类的旅行博客',
  ],
  corporate: [
    '为苏州一家做工业机器人的中型企业做官网,突出焊接机器人产品线和汽车行业客户',
    '一家做宠物食品代工的公司需要官网,强调工厂资质、代工流程和起订量',
    '给一家律师事务所做官网,主打婚姻家事和劳动争议两个业务方向',
  ],
  saas: [
    '为一款面向奶茶店的排班 SaaS 做产品页,有三档定价,主打手机端一键排班',
    '做一个跨境电商 ERP 的产品落地页,核心卖点是多平台订单聚合和利润核算',
    '为一款 AI 简历优化工具做产品页,免费版每月 3 次,付费版不限次',
  ],
  landing: [
    '为 11 月在上海举办的独立咖啡节做报名落地页,有 30 家摊位和 6 场杯测工作坊',
    '公司年会活动页,主题是复古迪斯科,需要展示议程、抽奖规则和着装要求',
    '一场线上前端技术分享会的落地页,四位讲师,分下午和晚上两个半场',
  ],
  restaurant: [
    '为成都一家社区冒菜店做门店页,突出荤素同价和秘制牛油锅底,带菜单价格',
    '一家日式家庭料理小店需要主页,主打午市定食,周三店休,只有八个座位',
    '帮我做一个潮汕牛肉火锅店页面,强调现切吊龙和宵夜营业到凌晨两点',
  ],
  docs: [
    '为一个叫 FormKit 的表单组件库做文档站首页,包含安装指南和三个示例',
    '我们开源了一个 YAML 配置校验工具,需要带快速上手和 API 参考的文档站',
    '为公司内部的前端规范做文档站,分代码风格、Git 流程、发布检查单三章',
  ],
  wiki: [
    '做一个多肉植物养护知识库,分浇水、光照、度夏、病虫害四个分类',
    '为滑板社团做一个 Wiki,收录动作教学、装备选购和本地板场信息',
    '我想建一个家庭急救知识库,按外伤、中毒、突发疾病分类词条',
  ],
  education: [
    '为零基础尤克里里入门课做课程页,八节课大纲,讲师是琴行老板阿灿',
    '一门面向小学生的 Scratch 编程暑期课需要招生页,分两个年龄段班型',
    '帮我做一个手机摄影线上课页面,包含十二节课大纲和学员前后对比作品',
  ],
  forum: [
    '为养龟爱好者做一个社区论坛,有晒龟、问诊、交易三个版块',
    '做一个独立开发者交流社区,版块包括产品展示、招聘外包和技术问答',
    '我们小区的业主论坛,需要公告、邻里互助、二手闲置和投诉建议版块',
  ],
  dashboard: [
    '为物流仓库做一个实时数据大屏,展示今日出入库量、各分区利用率和异常告警',
    '做一个连锁奶茶品牌的经营大屏,包含实时营业额、门店排行和原料库存预警',
    '为城市充电桩运营做监控大屏,展示在线桩数、充电功率趋势和故障分布地图占位',
  ],
  shop: [
    '为一家手工皮具工作室做橱窗页,展示钱包、卡包、皮带三类共九件商品',
    '做一个江西脐橙的电商橱窗,有礼盒装和家庭装,突出果园直发',
    '帮我做一个 Vintage 古着店的线上橱窗,按上装、下装、配饰分类展示',
  ],
}

interface EvalTask {
  profile: SiteTypeProfile
  requirement: string
  run: number
}

interface EvalResult {
  siteType: string
  siteTypeName: string
  requirement: string
  run: number
  durationMs: number
  parseable: number
  keywordHit: number
  headComplete: number
  htmlSane: number
  total: number
  headMissing: string[]
  error?: string
}

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function numberOption(cliName: string, envName: string, fallback: number): number {
  const raw = argValue(cliName) ?? process.env[envName]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${cliName}/${envName} 必须为正数`)
  return value
}

function ratio(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} 必须在 0 到 1 之间`)
  }
  return value
}

function makeSample(profile: SiteTypeProfile, requirement: string): string {
  const keywordList = profile.validationKeywords.join('、')
  const sections = profile.skeleton
    .map((section, index) =>
      `    <section id="sec-${index + 1}"><h2>${section}</h2><p>${keywordList}</p></section>`,
    )
    .join('\n')
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${profile.name}样例</title>
<style>body{font-family:system-ui;margin:0}section{padding:2rem}</style>
</head>
<body>
<header><h1>${profile.name} · ${requirement.slice(0, 12)}</h1></header>
${sections}
<footer><p>© 2026</p></footer>
<script>console.log('sample')</script>
</body>
</html>`
  return [
    '```json',
    JSON.stringify({ files: [{ path: 'index.html', description: '入口页面' }] }),
    '```',
    '',
    '```html path="index.html"',
    html,
    '```',
  ].join('\n')
}

async function callModel(profile: SiteTypeProfile, requirement: string): Promise<string> {
  const baseUrl = process.env.EVAL_BASE_URL
  const apiKey = process.env.EVAL_API_KEY
  const model = process.env.EVAL_MODEL
  if (!baseUrl || !apiKey || !model) {
    throw new Error('缺少 EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL')
  }
  const { system, user } = buildGenerationPrompt({ siteType: profile.id, requirement })
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
    signal: AbortSignal.timeout(numberOption('--timeout-ms', 'EVAL_TIMEOUT_MS', 180_000)),
  })
  if (!response.ok) throw new Error(`模型请求失败:${response.status} ${await response.text()}`)
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型返回为空')
  return content
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (!dryRun && (!process.env.EVAL_API_KEY || !process.env.EVAL_BASE_URL || !process.env.EVAL_MODEL)) {
    throw new Error('真实质量评测必须配置 EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL')
  }

  const only = argValue('--only')?.split(',').map((value) => value.trim()).filter(Boolean)
  const runs = Math.max(1, Math.floor(numberOption('--runs', 'EVAL_RUNS', 1)))
  const concurrency = Math.max(1, Math.floor(numberOption('--concurrency', 'EVAL_CONCURRENCY', 5)))
  const reportPath = resolve(
    process.cwd(),
    argValue('--report') ?? process.env.EVAL_REPORT_PATH ?? '../../artifacts/prompt-eval.json',
  )

  const thresholds = {
    overall: ratio('EVAL_MIN_OVERALL', 0.8),
    siteType: ratio('EVAL_MIN_SITE_TYPE', 0.8),
    parseable: ratio('EVAL_MIN_PARSEABLE', 0.98),
    headComplete: ratio('EVAL_MIN_HEAD_COMPLETE', 0.95),
    htmlSane: ratio('EVAL_MIN_HTML_SANE', 0.95),
  }

  const tasks: EvalTask[] = []
  for (const profile of SITE_TYPE_PROFILES) {
    if (only?.length && !only.includes(profile.id)) continue
    for (const requirement of EVAL_CASES[profile.id] ?? []) {
      for (let run = 1; run <= runs; run += 1) tasks.push({ profile, requirement, run })
    }
  }
  if (!tasks.length) throw new Error('没有匹配的评测用例')

  console.log(
    dryRun
      ? `⚠️  评测管线自检: ${tasks.length} 次执行，结果不代表真实模型质量`
      : `🚀 真实质量评测: ${process.env.EVAL_MODEL}，${tasks.length} 次执行`,
  )

  const results: EvalResult[] = []
  let cursor = 0
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++]
      const startedAt = Date.now()
      try {
        const output = dryRun
          ? makeSample(task.profile, task.requirement)
          : await callModel(task.profile, task.requirement)
        const score = scoreOutput(task.profile, output)
        results.push({
          siteType: task.profile.id,
          siteTypeName: task.profile.name,
          requirement: task.requirement,
          run: task.run,
          durationMs: Date.now() - startedAt,
          ...score,
        })
        console.log(
          `${score.total >= thresholds.siteType ? '✅' : '⚠️'} [${task.profile.id}] #${task.run} ${(score.total * 100).toFixed(0)}% ${task.requirement.slice(0, 24)}…`,
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({
          siteType: task.profile.id,
          siteTypeName: task.profile.name,
          requirement: task.requirement,
          run: task.run,
          durationMs: Date.now() - startedAt,
          parseable: 0,
          keywordHit: 0,
          headComplete: 0,
          htmlSane: 0,
          total: 0,
          headMissing: [],
          error: message,
        })
        console.error(`❌ [${task.profile.id}] #${task.run} ${message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  const bySiteType = SITE_TYPE_PROFILES.filter((profile) => results.some((r) => r.siteType === profile.id)).map(
    (profile) => {
      const scoped = results.filter((result) => result.siteType === profile.id)
      return {
        siteType: profile.id,
        name: profile.name,
        executions: scoped.length,
        overall: average(scoped.map((result) => result.total)),
        parseable: average(scoped.map((result) => result.parseable)),
        keywordHit: average(scoped.map((result) => result.keywordHit)),
        headComplete: average(scoped.map((result) => result.headComplete)),
        htmlSane: average(scoped.map((result) => result.htmlSane)),
        averageDurationMs: average(scoped.map((result) => result.durationMs)),
      }
    },
  )

  const summary = {
    executions: results.length,
    failures: results.filter((result) => result.error).length,
    overall: average(results.map((result) => result.total)),
    parseable: average(results.map((result) => result.parseable)),
    keywordHit: average(results.map((result) => result.keywordHit)),
    headComplete: average(results.map((result) => result.headComplete)),
    htmlSane: average(results.map((result) => result.htmlSane)),
    averageDurationMs: average(results.map((result) => result.durationMs)),
  }

  const violations: string[] = []
  if (summary.overall < thresholds.overall) violations.push(`总分低于 ${(thresholds.overall * 100).toFixed(0)}%`)
  if (summary.parseable < thresholds.parseable) violations.push(`解析成功率低于 ${(thresholds.parseable * 100).toFixed(0)}%`)
  if (summary.headComplete < thresholds.headComplete) violations.push(`SEO head 完整率低于 ${(thresholds.headComplete * 100).toFixed(0)}%`)
  if (summary.htmlSane < thresholds.htmlSane) violations.push(`HTML 健全率低于 ${(thresholds.htmlSane * 100).toFixed(0)}%`)
  for (const row of bySiteType) {
    if (row.overall < thresholds.siteType) {
      violations.push(`${row.name}(${row.siteType})低于 ${(thresholds.siteType * 100).toFixed(0)}%`)
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    authoritative: !dryRun,
    mode: dryRun ? 'pipeline-self-check' : 'real-model',
    model: dryRun ? null : process.env.EVAL_MODEL,
    baseUrl: dryRun ? null : process.env.EVAL_BASE_URL,
    runsPerCase: runs,
    thresholds,
    passed: violations.length === 0,
    violations,
    summary,
    bySiteType,
    results,
  }

  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log('\n════════ 质量评测汇总 ════════')
  for (const row of bySiteType) {
    console.log(`${row.overall >= thresholds.siteType ? '✅' : '❌'} ${row.name} ${(row.overall * 100).toFixed(1)}% (${row.executions} 次)`)
  }
  console.log(`总分 ${(summary.overall * 100).toFixed(1)}%，解析 ${(summary.parseable * 100).toFixed(1)}%，SEO ${(summary.headComplete * 100).toFixed(1)}%，HTML ${(summary.htmlSane * 100).toFixed(1)}%`)
  console.log(`报告: ${reportPath}`)
  if (dryRun) console.log('注意:该报告只证明评测管线可运行，不代表真实模型质量。')

  if (violations.length) {
    for (const violation of violations) console.error(`❌ ${violation}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('质量评测失败:', error instanceof Error ? error.message : error)
  process.exit(1)
})

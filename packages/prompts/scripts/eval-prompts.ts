/**
 * 提示词离线评测脚本(SF-1-2)
 *
 * 用法:
 *   pnpm --filter prompts eval -- --dry-run   # 离线样例跑分(不需要 key)
 *   pnpm --filter prompts eval                 # 真实模型跑分,需 env:
 *                                              #   EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL
 *
 * 评分维度(每用例 4 项,取平均):
 *   1. 输出可被 shared 的 parseModelOutput 解析为文件树
 *   2. 必备要素关键词命中率(画像 validationKeywords)
 *   3. 经 artifactToSingleHtml 合成后包含全部 5 个 head 标准槽位
 *   4. HTML 基本健全(doctype/html/head/body 闭合、style/script 标签配平)
 *
 * 重要:--dry-run 使用脚本内置的占位样例 HTML 充当模型输出,仅用于验证
 * 评测管线与提示词结构,不代表真实模型质量。没有 EVAL_API_KEY 时本脚本
 * 拒绝真实跑分,绝不造假数据。
 */
import {
  SITE_TYPE_PROFILES,
  buildGenerationPrompt,
  type SiteTypeProfile,
} from '../src/index'
import {
  HEAD_SLOT_NAMES,
  artifactToSingleHtml,
  parseModelOutput,
  type ArtifactMeta,
} from 'shared'

/* ============ 42 个真实感中文评测用例(14 类 × 3) ============ */

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
    '公司年会活动页,主题是复古迪斯科,需要展示议程、抽奖规则和着裝要求',
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
    '一门面向小学生的Scratch编程暑期课需要招生页,分两个年龄段班型',
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

/* ============ dry-run 占位样例(非真实模型输出!) ============ */

/**
 * 根据画像拼装一份"理想化"的模型输出样例:
 * 仅用于验证评测管线,不能代表任何模型的真实水平。
 */
function makeSample(profile: SiteTypeProfile, requirement: string): string {
  const keywordList = profile.validationKeywords.join('、')
  const sections = profile.skeleton
    .map((s, i) => `    <section id="sec-${i + 1}"><h2>${s}</h2><p>${keywordList}</p></section>`)
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
<script>console.log('sample');</script>
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

/* ============ 评分器 ============ */

interface CaseScore {
  parseable: number
  keywordHit: number
  headSlots: number
  htmlSane: number
  total: number
}

function scoreOutput(profile: SiteTypeProfile, output: string): CaseScore {
  const parsed = parseModelOutput(output)
  const parseable = parsed ? 1 : 0

  const htmlAll = parsed
    ? parsed.tree.files.map((f) => f.content).join('\n')
    : output
  const hits = profile.validationKeywords.filter((k) => htmlAll.includes(k)).length
  const keywordHit = profile.validationKeywords.length
    ? hits / profile.validationKeywords.length
    : 1

  let headSlots = 0
  let htmlSane = 0
  if (parsed) {
    const meta: ArtifactMeta = {
      id: 'eval',
      siteType: profile.id,
      title: '评测',
      requirement: '评测',
      createdAt: new Date().toISOString(),
      iteration: 1,
    }
    try {
      const single = artifactToSingleHtml(parsed.tree, meta)
      headSlots = HEAD_SLOT_NAMES.every((n) => single.includes(`@sf:slot:${n}`)) ? 1 : 0
    } catch {
      headSlots = 0
    }

    const entry = parsed.tree.files.find((f) => f.path === parsed.tree.entry)?.content ?? ''
    const lower = entry.toLowerCase()
    const structureOk =
      lower.includes('<!doctype html') &&
      lower.includes('<html') &&
      lower.includes('</html>') &&
      lower.includes('<head') &&
      lower.includes('</head>') &&
      lower.includes('<body') &&
      lower.includes('</body>')
    const count = (re: RegExp) => (entry.match(re) ?? []).length
    const tagsBalanced =
      count(/<style\b/gi) === count(/<\/style>/gi) &&
      count(/<script\b/gi) === count(/<\/script>/gi)
    htmlSane = structureOk && tagsBalanced ? 1 : 0
  }

  const total = (parseable + keywordHit + headSlots + htmlSane) / 4
  return { parseable, keywordHit, headSlots, htmlSane, total }
}

/* ============ 真实模型调用(OpenAI 兼容协议) ============ */

async function callModel(profile: SiteTypeProfile, requirement: string): Promise<string> {
  const baseUrl = process.env.EVAL_BASE_URL
  const apiKey = process.env.EVAL_API_KEY
  const model = process.env.EVAL_MODEL
  if (!baseUrl || !apiKey || !model) {
    throw new Error(
      '缺少 EVAL_BASE_URL / EVAL_API_KEY / EVAL_MODEL,无法真实跑分。' +
        '不会用假数据冒充模型输出——请配置环境变量,或使用 --dry-run 跑离线管线自检。',
    )
  }
  const { system, user } = buildGenerationPrompt({ siteType: profile.id, requirement })
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
    }),
  })
  if (!res.ok) throw new Error(`模型请求失败:${res.status} ${await res.text()}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型返回为空')
  return content
}

/* ============ 主流程 ============ */

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (!dryRun && !process.env.EVAL_API_KEY) {
    console.error(
      '❌ 未检测到 EVAL_API_KEY,拒绝真实跑分(绝不造假)。\n' +
        '   配置 EVAL_BASE_URL/EVAL_API_KEY/EVAL_MODEL 后重试,或加 --dry-run 做离线自检。',
    )
    process.exit(2)
  }

  console.log(
    dryRun
      ? '⚠️  DRY-RUN:使用内置占位样例充当模型输出,仅验证评测管线,不代表真实模型质量。\n'
      : `🚀 真实跑分:模型 ${process.env.EVAL_MODEL} @ ${process.env.EVAL_BASE_URL}\n`,
  )

  const rows: { type: string; name: string; avg: number; cases: number }[] = []
  let allScores: number[] = []

  for (const profile of SITE_TYPE_PROFILES) {
    const requirements = EVAL_CASES[profile.id] ?? []
    const scores: number[] = []
    for (const req of requirements) {
      const output = dryRun ? makeSample(profile, req) : await callModel(profile, req)
      const s = scoreOutput(profile, output)
      scores.push(s.total)
      const flag = s.total >= 0.8 ? '✅' : '⚠️ '
      console.log(
        `  ${flag} [${profile.id}] ${req.slice(0, 24)}…  解析${s.parseable} 关键词${(s.keywordHit * 100).toFixed(0)}% 槽位${s.headSlots} HTML${s.htmlSane} → ${(s.total * 100).toFixed(0)}%`,
      )
    }
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    rows.push({ type: profile.id, name: profile.name, avg, cases: scores.length })
    allScores = allScores.concat(scores)
  }

  console.log('\n════════ 按站点类型通过率 ════════')
  for (const r of rows) {
    const bar = '█'.repeat(Math.round(r.avg * 20)).padEnd(20, '░')
    console.log(
      `${r.avg >= 0.8 ? '✅' : '❌'} ${r.name.padEnd(8, '　')} ${r.type.padEnd(12)} ${bar} ${(r.avg * 100).toFixed(0)}%(${r.cases} 用例)`,
    )
  }
  const overall = allScores.length
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0
  const verdict = overall >= 0.8 ? 'PASS' : 'BETA(通过率 <80%,提示词需继续迭代)'
  console.log(`\n总通过率:${(overall * 100).toFixed(1)}% → ${verdict}`)
  if (dryRun) console.log('(再次提醒:以上为占位样例结果,真实跑分请配置 EVAL_* 环境变量。)')
}

main().catch((err) => {
  console.error('评测失败:', err instanceof Error ? err.message : err)
  process.exit(1)
})

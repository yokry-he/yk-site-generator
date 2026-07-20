# SiteForge · 智能网站生成平台(Vue 版)— 设计文档

React 版在 `../app`(保留作参考),本项目为功能与视觉完全对齐的 Vue 重写。

## 产品定位

一句话描述需求,AI 帮你生成完整网站。面向"不会写代码但有表达/展示需求"的人群,把建站变成"说清楚想要什么"的自然语言交互。支持 14 种站点类型(4 组):个人创作(个人主页/作品集/在线简历/博客)、商业营销(企业官网/SaaS 产品页/活动落地页/电商橱窗/餐饮门店页/教育课程页)、内容社区(文档站/知识库 Wiki/社区论坛)、数据可视化(数据大屏)。

## 技术栈

Vue 3(`<script setup>`)+ TypeScript + Vite + Vue Router 4 + Tailwind CSS 3 + lucide-vue-next + jszip。UI 组件为手写轻量实现:`AppDialog`(Teleport 弹窗)、`AppSelect`(分组下拉)、`AppSwitch`、`ToastHost`(自研 toast);不引 shadcn-vue/radix-vue,包体更可控。

## 路由表(createWebHistory)

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 | Hero(query `?q=` 携带需求跳 `/generator`)、快速直达锚点行、站点类型(#types)、生成流程(#process)、CTA;**唯一非懒加载页面** |
| `/generator` | 在线体验 | AI 生成 / 模板生成 Tab;懒加载 |
| `/templates` | 模板库 | 23 个模板,分组筛选;懒加载 |
| `/pricing` | 定价 | 三档;懒加载 |
| `/docs` | 使用文档 | $M{} 变量语法(#template-vars)、模型接入说明(#model-providers);懒加载 |
| `/changelog` | 更新日志 | 时间线;懒加载 |
| `/about` | 关于我们 | 团队与联系方式(#contact);懒加载 |
| `/:pathMatch(.*)*` | 404 | 友好设计 + 返回首页;懒加载 |

- 分包策略:除首页外全部 `() => import()`,构建产物按页面拆 chunk
- `scrollBehavior`:有 hash 延迟 120ms 平滑滚动到锚点(等懒加载渲染),无 hash 滚顶,前进后退恢复位置;`/#types`、`/#process` 跨页面可用
- 主导航仅放真实路由(RouterLink 当前高亮);hash 锚点降级到首页「快速直达」行与页脚「页面导航」列;页脚资源/公司列指向 /docs、/changelog、/about

## 主题体系(6 套)

深色 · 默认 / 明亮 / 纸质 / 薄荷 / 天空 / 樱花。`[data-theme]` 上定义 RGB 语义变量(`--c-bg/--c-bg-soft/--c-text/--c-sub/--c-muted/--c-faint/--c-line/--c-brand1/--c-brand2`),Tailwind 注册为 `app/soft/ink/sub/mut/faint/line/brand1/brand2` 语义色;全站仅用语义色(例外:渐变按钮白字、mock 预览固定配色)。浅色主题品牌色加深保对比,光晕用 `--glow-strength` 折减。导航栏下拉切换(色板点+名称+勾选),localStorage(`siteforge.theme`)持久化,`index.html` 内联脚本首帧前应用防闪烁。

## 模型接入(演示)

8 家厂商(OpenAI/Anthropic/Gemini/DeepSeek/Kimi/智谱 GLM/通义千问/豆包,`src/data/providers.ts`)。模型设置 Dialog(导航栏 + Demo 横幅双入口,`useModelDialog` 模块级单例):选厂商 → API Key(遮蔽)+ Base URL + 模型下拉 → 测试连接(格式校验 + 1.2s 动画,不真实请求)→ 保存并启用;支持已接入徽标、设为当前、删除。`useModelConfig` 模块级响应式单例持久化 localStorage(`siteforge.models.v1`);Demo 区显示当前模型或演示模式提示;UI 明示密钥仅存本地浏览器。

## 模板变量语法 `$M{xxxx.xxxx}`

- 正则:`\$M\{([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}`,点号前缀用于表单分组
- 流程:上传/拖拽 zip(或内置示例)→ jszip 解析(扩展名 + NUL 字节 + UTF-8 探测区分文本/二进制)→ 扫描变量(汇总出现文件与次数)→ 分组表单(placeholder/title 标注出现位置,可一键填示例值)→ 替换重打包下载 `<项目名>-generated.zip`,二进制原样,未填变量可选保留原样
- 逻辑在 `src/lib/templateEngine.ts`(框架无关,与 React 版共用),内置个人主页示例含 site.\*/user.\*/nav.\* 变量 + 1 个 PNG 二进制

## 目录结构

- `src/data/` 站点类型、主题、厂商数据;`src/lib/` 模板引擎;`src/composables/` 主题/toast/模型配置/Dialog 状态(模块级单例)
- `src/components/` 布局与区块组件,`components/mock/` 预览基元(Nav/HeroBlock/CardRow/BarChart/Bar)组合出 14 种类型 mock;`src/pages/` 路由页面;`src/router/` 路由与滚动行为

## 后续扩展方向

- 服务端代理真实调用 LLM(避免 CORS 与密钥暴露),生成日志改流式
- 在线编辑器:区块拖拽、文案改写、配色切换;发布托管:静态导出 + CDN + 自定义域名
- 模板市场(模板生成器可复用为打包工具);账号体系与工作台、版本历史

<script setup lang="ts">
import { BookOpen, FileArchive, Plug, ShieldCheck } from 'lucide-vue-next'
import SectionHeading from '../components/SectionHeading.vue'
</script>

<template>
  <main class="pt-16">
    <section class="relative py-16">
      <div class="glow-brand1 pointer-events-none absolute top-0 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full blur-[130px]" />
      <div class="relative mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="使用文档"
          title="SiteForge 使用指南"
          desc="模板变量语法与模型接入的完整说明。"
        />

        <article class="mt-14 space-y-12">
          <!-- 模板变量语法 -->
          <section id="template-vars" class="scroll-mt-24">
            <h2 class="flex items-center gap-2 text-xl font-bold text-ink">
              <FileArchive class="h-5 w-5 text-brand1" />
              模板变量语法
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-mut">
              模板生成器会扫描压缩包内所有文本文件,找出形如
              <code class="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-xs text-brand2">$M{变量名}</code>
              的占位符并生成填写表单。生成项目时,这些占位符会被替换为你填写的值,二进制文件(图片、字体等)会原样保留。
            </p>
            <div class="mt-4 overflow-hidden rounded-xl border border-line/10">
              <div class="border-b border-line/10 bg-ink/[0.04] px-4 py-2 text-xs font-medium text-sub">语法规则</div>
              <ul class="space-y-2.5 px-4 py-4 text-sm leading-relaxed text-mut">
                <li>
                  · 格式:
                  <code class="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-xs text-brand2">$M{xxxx.xxxx}</code>
                  ,变量名由字母、数字、下划线组成,可用点号分层
                </li>
                <li>
                  · 正则:
                  <code class="rounded bg-ink/8 px-1.5 py-0.5 font-mono text-xs text-brand2">\$M\{([A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*)\}</code>
                </li>
                <li>· 点号前缀用于表单分组:site.title 与 site.author 会归入 site 组</li>
                <li>· 未填写的变量可选择保留原样,或替换为空字符串</li>
                <li>· 文本文件按扩展名 + 内容探测识别,二进制文件不参与替换、原样拷贝</li>
              </ul>
            </div>
            <div class="mt-4 overflow-hidden rounded-xl border border-line/10">
              <div class="border-b border-line/10 bg-ink/[0.04] px-4 py-2 text-xs font-medium text-sub">示例(index.html 片段)</div>
              <pre class="overflow-x-auto bg-app/60 p-4 font-mono text-xs leading-relaxed text-mut">&lt;title&gt;$M{site.title}&lt;/title&gt;
&lt;h1&gt;你好,我是 $M{user.name}&lt;/h1&gt;
&lt;p&gt;$M{user.bio}&lt;/p&gt;</pre>
            </div>
          </section>

          <!-- 模型接入说明 -->
          <section id="model-providers" class="scroll-mt-24">
            <h2 class="flex items-center gap-2 text-xl font-bold text-ink">
              <Plug class="h-5 w-5 text-brand1" />
              模型接入说明
            </h2>
            <p class="mt-3 text-sm leading-relaxed text-mut">
              SiteForge 支持接入 8 家主流大模型厂商。在导航栏点击「模型设置」,选择厂商后填写
              API Key、Base URL 与模型,点击「测试连接」验证格式,最后「保存并启用」。已接入的厂商可以随时切换或删除。
            </p>
            <div class="mt-4 overflow-hidden rounded-xl border border-line/10">
              <div class="border-b border-line/10 bg-ink/[0.04] px-4 py-2 text-xs font-medium text-sub">支持的厂商</div>
              <div class="grid grid-cols-2 gap-px bg-line/8 sm:grid-cols-4">
                <div
                  v-for="p in ['OpenAI', 'Anthropic', 'Google Gemini', 'DeepSeek', 'Moonshot Kimi', '智谱 GLM', '通义千问', '字节豆包']"
                  :key="p"
                  class="bg-soft px-4 py-3 text-center text-sm text-sub"
                >
                  {{ p }}
                </div>
              </div>
            </div>
            <p class="mt-4 flex items-start gap-2 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm leading-relaxed text-mut">
              <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0 text-brand2" />
              密钥仅保存在本地浏览器(localStorage),不会上传到任何服务器。当前版本的「测试连接」为演示环境模拟校验,不会发起真实请求。
            </p>
          </section>

          <!-- 快速上手 -->
          <section>
            <h2 class="flex items-center gap-2 text-xl font-bold text-ink">
              <BookOpen class="h-5 w-5 text-brand1" />
              快速上手
            </h2>
            <ol class="mt-4 list-decimal space-y-2.5 pl-5 text-sm leading-relaxed text-mut">
              <li>在首页输入一句话需求,或点击类型快捷标签填充示例;</li>
              <li>点击「立即生成」进入在线体验页,确认站点类型后点击「开始生成」;</li>
              <li>观看 AI 的分步生成过程,完成后可重新生成或进入编辑;</li>
              <li>有自己的项目模板?切换到「模板生成」Tab,上传 zip 即可批量替换变量。</li>
            </ol>
          </section>
        </article>
      </div>
    </section>
  </main>
</template>

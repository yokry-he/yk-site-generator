import { z } from 'zod'
import {
  MAX_SITE_PAGES,
  isCanonicalSitePath,
  normalizeSiteProject,
  sitePageSummaries,
  siteProjectByteLength,
  siteProjectHomePage,
  type SiteProjectDocument,
} from 'shared'
import { env } from '../env'
import type { ProjectVersionRecord } from './data-store'

export const sitePageInputSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(80),
  path: z.string().trim().refine(isCanonicalSitePath, '页面路径必须是 / 或小写英文、数字、连字符组成的路径'),
  html: z.string().min(20),
})

export const sitePagesInputSchema = z.array(sitePageInputSchema).min(1).max(MAX_SITE_PAGES).superRefine((pages, context) => {
  const ids = new Set<string>()
  const paths = new Set<string>()
  pages.forEach((page, index) => {
    if (ids.has(page.id)) context.addIssue({ code: 'custom', path: [index, 'id'], message: '页面 ID 不能重复' })
    if (paths.has(page.path)) context.addIssue({ code: 'custom', path: [index, 'path'], message: '页面路径不能重复' })
    ids.add(page.id)
    paths.add(page.path)
  })
})

export const siteDocumentInputShape = {
  html: z.string().min(20).optional(),
  pages: sitePagesInputSchema.optional(),
  homePageId: z.string().trim().min(1).max(80).optional(),
}

export type SiteDocumentInput = {
  html?: string
  pages?: z.infer<typeof sitePagesInputSchema>
  homePageId?: string
}

export function validateHomePage(input: SiteDocumentInput, context: z.RefinementCtx): void {
  if (!input.pages?.length || !input.homePageId) return
  if (!input.pages.some((page) => page.id === input.homePageId)) {
    context.addIssue({ code: 'custom', path: ['homePageId'], message: '首页必须属于当前页面列表' })
  }
}

export function siteDocumentFromInput(input: SiteDocumentInput, fallbackTitle = '首页'): SiteProjectDocument {
  return normalizeSiteProject(input, fallbackTitle)
}

export function siteDocumentFromVersion(version: ProjectVersionRecord): SiteProjectDocument {
  return normalizeSiteProject(version, '首页')
}

export function siteDocumentWithinLimit(document: SiteProjectDocument): boolean {
  return siteProjectByteLength(document) <= env.MAX_PROJECT_BYTES
}

export function versionDocumentSummary(version: ProjectVersionRecord) {
  const document = siteDocumentFromVersion(version)
  return {
    homePageId: document.homePageId,
    pages: sitePageSummaries(document),
    pageCount: document.pages.length,
    sizeBytes: siteProjectByteLength(document),
  }
}

export function applyDocumentToVersion<T extends ProjectVersionRecord>(version: T, document: SiteProjectDocument): T {
  const home = siteProjectHomePage(document)
  return {
    ...version,
    html: home.html,
    pages: document.pages,
    homePageId: document.homePageId,
  }
}

function htmlSignals(value: string) {
  return {
    text: value.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<[^>]+>/gi, ' ').replace(/\s+/g, ' ').trim(),
    sections: (value.match(/<(?:section|header|footer|main|article)\b/gi) ?? []).length,
    images: (value.match(/<img\b/gi) ?? []).length,
    links: (value.match(/<a\b/gi) ?? []).length,
  }
}

export function siteDocumentChangeSummary(previous: ProjectVersionRecord | undefined, next: SiteProjectDocument): string[] {
  if (!previous) return [`创建包含 ${next.pages.length} 个页面的初始版本`]
  const before = siteDocumentFromVersion(previous)
  const output: string[] = []
  if (before.pages.length !== next.pages.length) output.push(`页面数量 ${before.pages.length} → ${next.pages.length}`)

  const beforeById = new Map(before.pages.map((page) => [page.id, page]))
  const added = next.pages.filter((page) => !beforeById.has(page.id))
  const removed = before.pages.filter((page) => !next.pages.some((candidate) => candidate.id === page.id))
  if (added.length) output.push(`新增页面：${added.map((page) => page.title).slice(0, 4).join('、')}`)
  if (removed.length) output.push(`删除页面：${removed.map((page) => page.title).slice(0, 4).join('、')}`)

  const changed = next.pages.filter((page) => {
    const old = beforeById.get(page.id)
    return old && (old.title !== page.title || old.path !== page.path || old.html !== page.html)
  })
  if (changed.length) output.push(`更新页面：${changed.map((page) => page.title).slice(0, 4).join('、')}`)

  const beforeHome = siteProjectHomePage(before)
  const nextHome = siteProjectHomePage(next)
  if (beforeHome.id !== nextHome.id) output.push(`首页切换为「${nextHome.title}」`)

  const oldSignals = htmlSignals(beforeHome.html)
  const newSignals = htmlSignals(nextHome.html)
  const textDelta = newSignals.text.length - oldSignals.text.length
  if (Math.abs(textDelta) > 20) output.push(textDelta > 0 ? `首页新增约 ${textDelta} 个文字字符` : `首页精简约 ${Math.abs(textDelta)} 个文字字符`)
  if (newSignals.sections !== oldSignals.sections) output.push(`首页区块 ${oldSignals.sections} → ${newSignals.sections}`)
  if (newSignals.images !== oldSignals.images) output.push(`首页图片 ${oldSignals.images} → ${newSignals.images}`)
  if (newSignals.links !== oldSignals.links) output.push(`首页链接 ${oldSignals.links} → ${newSignals.links}`)
  if (!output.length) output.push('调整页面内容或样式')
  return output.slice(0, 12)
}

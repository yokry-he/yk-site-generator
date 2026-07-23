import JSZip from 'jszip'
import { singleHtmlToArtifact } from 'shared'

export interface ExportSiteInput {
  html: string
  title: string
  siteType: string
  requirement?: string
  model?: string
  generatedAt?: string
}

function safeFileName(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return normalized.slice(0, 64) || 'siteforge-site'
}

export async function buildSiteZip(input: ExportSiteInput): Promise<Blob> {
  const zip = new JSZip()
  const tree = singleHtmlToArtifact(input.html)
  for (const file of tree.files) {
    zip.file(file.path, file.content, file.binary ? { base64: true } : undefined)
  }

  zip.file(
    'siteforge.json',
    JSON.stringify(
      {
        format: 'siteforge-export-v1',
        entry: tree.entry,
        title: input.title,
        siteType: input.siteType,
        requirement: input.requirement,
        model: input.model,
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  zip.file(
    'README.txt',
    [
      'SiteForge 网站导出包',
      '',
      `入口文件:${tree.entry}`,
      `站点类型:${input.siteType}`,
      `标题:${input.title}`,
      '',
      '使用方式:解压后直接打开入口 HTML,或将整个目录部署到任意静态托管服务。',
      '注意:生成内容可能包含第三方链接或脚本,正式上线前请自行审核。',
    ].join('\n'),
  )
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
    platform: 'UNIX',
  })
}

export async function downloadSiteZip(input: ExportSiteInput): Promise<string> {
  const blob = await buildSiteZip(input)
  const fileName = `${safeFileName(input.title)}.zip`
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return fileName
}

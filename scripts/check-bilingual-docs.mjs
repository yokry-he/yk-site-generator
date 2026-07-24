import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const trackedMarkdown = execFileSync('git', ['ls-files', '*.md'], { encoding: 'utf8' })
  .split('\n')
  .map((value) => value.trim())
  .filter(Boolean)

const documentationFiles = trackedMarkdown.filter((path) =>
  path === 'README.md'
  || path.startsWith('docs/')
  || path.startsWith('deploy/')
  || /(^|\/)README\.md$/u.test(path),
)

const failures = []

for (const path of documentationFiles) {
  const content = readFileSync(path, 'utf8')
  const hasChineseSection = /^## 中文\s*$/mu.test(content)
  const hasEnglishSection = /^## English\s*$/mu.test(content)
  const hasLanguageNavigation = content.includes('[中文]') && content.includes('[English]')

  if (!hasChineseSection || !hasEnglishSection || !hasLanguageNavigation) {
    failures.push({ path, hasChineseSection, hasEnglishSection, hasLanguageNavigation })
  }
}

if (failures.length > 0) {
  console.error('Bilingual documentation check failed:')
  for (const failure of failures) {
    console.error(
      `- ${failure.path}: Chinese=${failure.hasChineseSection}, English=${failure.hasEnglishSection}, navigation=${failure.hasLanguageNavigation}`,
    )
  }
  process.exitCode = 1
} else {
  console.log(`Bilingual documentation check passed for ${documentationFiles.length} Markdown files.`)
}

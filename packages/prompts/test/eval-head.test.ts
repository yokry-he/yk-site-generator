import { describe, expect, it } from 'vitest'
import { SITE_TYPE_PROFILES } from '../src/index'
import { scoreOutput } from '../scripts/eval-prompts'

const profile = SITE_TYPE_PROFILES.find((item) => item.id === 'personal')!

function modelOutput(html: string): string {
  return ['```json', JSON.stringify({ files: [{ path: 'index.html' }] }), '```', '```html path="index.html"', html, '```'].join('\n')
}

describe('提示词评测 SEO 完整性', () => {
  it('经过标准产物合成后完整 SEO 得分为 1', () => {
    const score = scoreOutput(
      profile,
      modelOutput('<!DOCTYPE html><html><head></head><body><h1>个人主页</h1><p>自我介绍 社交 联系方式</p></body></html>'),
    )
    expect(score.headComplete).toBe(1)
    expect(score.headMissing).toEqual([])
  })

  it('不可解析输出会保留完整的缺失项诊断', () => {
    const score = scoreOutput(profile, '只有一段散文,没有任何代码块。')
    expect(score.parseable).toBe(0)
    expect(score.headComplete).toBe(0)
    expect(score.headMissing).toEqual([])
    expect(score.total).toBeLessThan(0.8)
  })
})

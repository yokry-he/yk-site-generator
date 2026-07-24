import { describe, expect, it } from 'vitest'
import {
  SITE_TYPE_PROFILES,
  SYSTEM_PROMPT,
  buildGenerationPrompt,
  buildSystemPrompt,
  getProfile,
} from '../src/index'

describe('站点类型画像', () => {
  it('覆盖 14 类站点', () => {
    expect(SITE_TYPE_PROFILES).toHaveLength(14)
    const ids = SITE_TYPE_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(14)
  })

  it('每类画像字段完整', () => {
    for (const p of SITE_TYPE_PROFILES) {
      expect(p.skeleton.length).toBeGreaterThanOrEqual(4)
      expect(p.essentials.length).toBeGreaterThanOrEqual(2)
      expect(p.design.length).toBeGreaterThan(0)
      expect(p.negative.length).toBeGreaterThanOrEqual(1)
      expect(p.validationKeywords.length).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('buildGenerationPrompt', () => {
  it('14 类均可构建并默认使用平衡生成', () => {
    for (const p of SITE_TYPE_PROFILES) {
      const { system, user } = buildGenerationPrompt({ siteType: p.id, requirement: '测试需求' })
      expect(system).toBe(SYSTEM_PROMPT)
      expect(system).toContain('当前生成策略：平衡生成')
      expect(user).toContain(p.name)
      expect(user).toContain(p.skeleton[0])
      expect(user).toContain(p.negative[0])
      expect(user).toContain('测试需求')
    }
  })

  it('不同策略改变系统约束和用户策略段', () => {
    const fast = buildGenerationPrompt({ siteType: 'saas', requirement: '测试', mode: 'fast' })
    const quality = buildGenerationPrompt({ siteType: 'saas', requirement: '测试', mode: 'quality' })
    expect(fast.system).toContain('当前生成策略：极速草稿')
    expect(fast.user).toContain('【生成策略】极速草稿')
    expect(quality.system).toContain('当前生成策略：精致成品')
    expect(quality.system).toContain('静默自检')
    expect(quality.user).toContain('7–10 个高完成度区块')
  })

  it('system 包含输出协议与运行性能约束', () => {
    expect(SYSTEM_PROMPT).toContain('文件清单')
    expect(SYSTEM_PROMPT).toContain('path')
    expect(SYSTEM_PROMPT).toContain('fenced code 块')
    expect(buildSystemPrompt('quality')).toContain('不阻塞首屏')
  })

  it('未知站点类型抛出错误', () => {
    expect(() => buildGenerationPrompt({ siteType: 'nope', requirement: 'x' })).toThrow(/未知站点类型/)
  })

  it('history 生效:追加迭代段并包含反馈意见', () => {
    const { user } = buildGenerationPrompt({
      siteType: 'blog', requirement: '做一个博客',
      history: [{ artifactHtml: '<html>旧版</html>', feedback: '把主题色改成绿色' }],
    })
    expect(user).toContain('【上一版产物与修改意见】')
    expect(user).toContain('把主题色改成绿色')
    expect(user).toContain('<html>旧版</html>')
  })

  it('history 中 artifactHtml 可省略', () => {
    const { user } = buildGenerationPrompt({
      siteType: 'blog', requirement: '做一个博客', history: [{ feedback: '字体大一点' }],
    })
    expect(user).toContain('字体大一点')
    expect(user).not.toContain('该轮产物 HTML')
  })

  it('getProfile 按 id 查找', () => {
    expect(getProfile('saas')?.name).toBe('SaaS 产品页')
    expect(getProfile('unknown')).toBeUndefined()
  })
})

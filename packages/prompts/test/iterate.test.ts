import { describe, expect, it } from 'vitest'
import { buildIterationPrompt, SYSTEM_PROMPT } from '../src/index'

const artifact = '<!DOCTYPE html><html><head><title>旧版</title></head><body><h1>你好</h1></body></html>'

describe('buildIterationPrompt', () => {
  const { system, user } = buildIterationPrompt({
    siteType: 'personal',
    currentArtifact: artifact,
    instruction: '把配色改成暖色系,首页加一个 FAQ 区块',
    round: 2,
  })

  it('system 沿用通用输出协议', () => {
    expect(system).toBe(SYSTEM_PROMPT)
    expect(system).toContain('文件清单')
  })

  it('user 包含当前产物正文', () => {
    expect(user).toContain(artifact)
    expect(user).toContain('【当前产物(第 1 轮)】')
  })

  it('user 包含修改指令与轮次', () => {
    expect(user).toContain('把配色改成暖色系,首页加一个 FAQ 区块')
    expect(user).toContain('【修改指令(第 2 轮)】')
  })

  it('包含迭代约束:只按指令改 / 输出完整新产物 / 协议不变 / 不截断', () => {
    expect(user).toContain('未提及的部分必须与当前产物保持一致')
    expect(user).toContain('完整的新产物')
    expect(user).toContain('输出协议不变')
    expect(user).toContain('完整性高于一切')
  })

  it('未知站点类型不抛错,按原 id 标注', () => {
    const { user: u } = buildIterationPrompt({
      siteType: 'custom-type',
      currentArtifact: artifact,
      instruction: '改字体',
      round: 3,
    })
    expect(u).toContain('【站点类型】custom-type')
  })
})

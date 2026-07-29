import { describe, expect, it } from 'vitest'
import { redactRcGateOutput, selectRcGates } from '../../../scripts/lib/rc-gates'

describe('RC gate runner', () => {
  it('keeps browser gates outside the core profile', () => {
    const core = selectRcGates('core').map((gate) => gate.id)
    const full = selectRcGates('full').map((gate) => gate.id)
    expect(core).toContain('typecheck')
    expect(core).toContain('unit')
    expect(core).not.toContain('browser')
    expect(full).toContain('browser')
    expect(full).toContain('visual')
  })

  it('supports explicit gate selection and validates unknown ids', () => {
    expect(selectRcGates('core', ['lint', 'docs']).map((gate) => gate.id)).toEqual(['lint', 'docs'])
    expect(() => selectRcGates('core', ['missing'])).toThrow('UNKNOWN_RC_GATE:missing')
  })

  it('redacts secrets, bearer tokens, URL credentials, and secret query values', () => {
    const output = redactRcGateOutput(
      'secret-value Bearer abcdefghijklmnopqrstuvwxyz redis://user:password@localhost:6379?a=1&token=visible',
      ['secret-value'],
    )
    expect(output).not.toContain('secret-value')
    expect(output).not.toContain('abcdefghijklmnopqrstuvwxyz')
    expect(output).not.toContain(':password@')
    expect(output).not.toContain('token=visible')
    expect(output).toContain('[REDACTED]')
  })
})

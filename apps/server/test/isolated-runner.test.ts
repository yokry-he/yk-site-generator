import { afterEach,describe,expect,it } from 'vitest'
import { createRun,RUNNER_PROFILES,runnerEnabled,runnerPolicy } from '../src/lib/isolated-runner'
afterEach(()=>{delete process.env.RUNNER_DRIVER})
describe('isolated runner policy',()=>{it('is disabled by default and exposes only allowlisted commands',()=>{expect(runnerEnabled()).toBe(false);expect(Object.keys(RUNNER_PROFILES)).toHaveLength(5);expect(()=>createRun('u','p','hono-drizzle','verify')).toThrow('RUNNER_DISABLED')});it('uses no-network and read-only defaults',()=>{process.env.RUNNER_DRIVER='docker';expect(runnerPolicy()).toMatchObject({network:'none',readOnlyRoot:true,maxConcurrent:2})})})

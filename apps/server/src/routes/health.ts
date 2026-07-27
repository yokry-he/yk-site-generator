import { timingSafeEqual } from 'node:crypto'
import { Hono } from 'hono'
import { getDataStoreHealth } from '../lib/data-store'
import { distributedRateLimitHealth } from '../lib/distributed-rate-limit'
import { metricsSnapshot,prometheusMetrics } from '../lib/runtime-metrics'
import { runnerPolicy } from '../lib/isolated-runner'
const health=new Hono()
const enabled=(name:string)=>['1','true','yes','on'].includes((process.env[name]||'').toLowerCase())
async function dependencies(){const[dataStore,rateLimit]=await Promise.all([getDataStoreHealth(),distributedRateLimitHealth()]);const runner=runnerPolicy();const deployment={driver:process.env.DEPLOYMENT_DRIVER||'disabled',configured:Boolean(process.env.DEPLOYMENT_WEBHOOK_URL)};const required={redis:enabled('REDIS_REQUIRED'),runner:enabled('RUNNER_REQUIRED'),deployment:enabled('DEPLOYMENT_REQUIRED')};const checks={dataStore:dataStore.status==='operational',redis:rateLimit.driver!=='redis'||rateLimit.status==='operational',runner:runner.driver!=='disabled',deployment:deployment.driver!=='disabled'&&deployment.configured};const ready=checks.dataStore&&(!required.redis||checks.redis)&&(!required.runner||checks.runner)&&(!required.deployment||checks.deployment);return{ready,required,checks,dataStore,rateLimit,runner:{driver:runner.driver,network:runner.network,readOnlyRoot:runner.readOnlyRoot,maxConcurrent:runner.maxConcurrent,images:runner.images},deployment}}
health.get('/live',(c)=>c.json({ok:true,service:'yk-site-generator',uptimeSeconds:Math.floor(process.uptime()),time:new Date().toISOString()}))
health.get('/ready',async(c)=>{const result=await dependencies();return c.json({ok:result.ready,...result},result.ready?200:503)})
health.get('/dependencies',async(c)=>{const result=await dependencies();return c.json(result,result.ready?200:503)})
function metricsAllowed(header?:string){if(!enabled('METRICS_ENABLED'))return false;const expected=process.env.METRICS_TOKEN||'';if(!expected)return process.env.NODE_ENV!=='production';const supplied=header?.startsWith('Bearer ')?header.slice(7):header||'';const left=Buffer.from(expected);const right=Buffer.from(supplied);return left.length===right.length&&timingSafeEqual(left,right)}
health.get('/metrics',(c)=>metricsAllowed(c.req.header('authorization')||c.req.header('x-metrics-token'))?c.text(prometheusMetrics(),200,{'Content-Type':'text/plain; version=0.0.4; charset=utf-8'}):c.text('Not found',404))
health.get('/',async(c)=>{const result=await dependencies();return c.json({ok:result.ready,service:'yk-site-generator',time:new Date().toISOString(),dataStore:result.dataStore,metrics:metricsSnapshot(),dependencies:{rateLimit:result.rateLimit,runner:result.runner,deployment:result.deployment}},result.ready?200:503)})
export default health

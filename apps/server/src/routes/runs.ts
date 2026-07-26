import { Hono } from 'hono'
import { z } from 'zod'
import { BACKEND_STACK_PROFILES } from 'shared'
import { authMiddleware,type AuthEnv } from '../lib/auth'
import { readData } from '../lib/data-store'
import { cancelRun,createRun,getRun,RUNNER_PROFILES,runnerPolicy } from '../lib/isolated-runner'
import { errorBody } from '../types'
const routes=new Hono<AuthEnv>();routes.use('*',authMiddleware)
routes.get('/profiles',(c)=>c.json({policy:runnerPolicy(),profiles:BACKEND_STACK_PROFILES.map((profile)=>({id:profile.id,name:profile.name,actions:Object.keys(RUNNER_PROFILES[profile.id])}))}))
routes.post('/',async(c)=>{const input=z.object({projectId:z.string().uuid(),stack:z.enum(['hono-drizzle','nestjs-prisma','fastapi-sqlalchemy','spring-boot-jpa','gin-gorm']),action:z.enum(['build','test','verify']).default('verify')}).parse(await c.req.json());const userId=c.get('auth').sub;if(!(await readData()).projects.some((item)=>item.id===input.projectId&&item.userId===userId))return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);try{return c.json({run:createRun(userId,input.projectId,input.stack,input.action)},202)}catch(error){return c.json(errorBody((error as Error).message,'Runner 不可用'),503)}})
routes.get('/:id',(c)=>{const run=getRun(c.get('auth').sub,c.req.param('id'));return run?c.json({run}):c.json(errorBody('RUN_NOT_FOUND','运行记录不存在'),404)})
routes.delete('/:id',(c)=>cancelRun(c.get('auth').sub,c.req.param('id'))?c.json({cancelled:true}):c.json(errorBody('RUN_NOT_FOUND','运行记录不存在'),404))
export default routes

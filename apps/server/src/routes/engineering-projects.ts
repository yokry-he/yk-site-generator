import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware,type AuthEnv } from '../lib/auth'
import { readData } from '../lib/data-store'
import { createEngineeringVersion,engineeringDiff,engineeringFile,engineeringTree,engineeringVersions,putEngineeringFiles } from '../lib/engineering-store'
import { errorBody } from '../types'
const routes=new Hono<AuthEnv>();routes.use('*',authMiddleware)
async function owns(userId:string,projectId:string){return(await readData()).projects.some((item)=>item.id===projectId&&item.userId===userId)}
async function authorized(c:any){const userId=c.get('auth').sub as string;const projectId=c.req.param('projectId') as string;return{userId,projectId,ok:await owns(userId,projectId)}}
routes.get('/:projectId/tree',async(c)=>{const a=await authorized(c);if(!a.ok)return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);return c.json(await engineeringTree(a.userId,a.projectId))})
routes.get('/:projectId/files/*',async(c)=>{const a=await authorized(c);if(!a.ok)return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);const item=await engineeringFile(a.userId,a.projectId,c.req.path.split('/files/')[1]||'');return item?c.json({file:item}):c.json(errorBody('FILE_NOT_FOUND','文件不存在'),404)})
routes.put('/:projectId/files',async(c)=>{const a=await authorized(c);if(!a.ok)return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);try{const input=z.object({revision:z.number().int().min(0),files:z.array(z.object({path:z.string().min(1).max(240),content:z.string().max(2_000_000)})).min(1).max(100)}).parse(await c.req.json());return c.json(await putEngineeringFiles(a.userId,a.projectId,input.revision,input.files))}catch(error){const current=(error as {currentRevision?:number}).currentRevision;return c.json({...errorBody((error as Error).message,'工程文件保存失败'),currentRevision:current},(error as Error).message==='ENGINEERING_REVISION_CONFLICT'?409:400)}})
routes.get('/:projectId/versions',async(c)=>{const a=await authorized(c);if(!a.ok)return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);return c.json({versions:await engineeringVersions(a.userId,a.projectId)})})
routes.post('/:projectId/versions',async(c)=>{const a=await authorized(c);if(!a.ok)return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);const input=z.object({name:z.string().max(80).default(''),note:z.string().max(500).optional()}).parse(await c.req.json());return c.json({version:await createEngineeringVersion(a.userId,a.projectId,input.name,input.note)},201)})
routes.get('/:projectId/diff',async(c)=>{const a=await authorized(c);if(!a.ok)return c.json(errorBody('PROJECT_NOT_FOUND','项目不存在'),404);const query=z.object({from:z.string().uuid(),to:z.string().uuid()}).parse(c.req.query());try{return c.json({files:await engineeringDiff(a.userId,a.projectId,query.from,query.to)})}catch{return c.json(errorBody('VERSION_NOT_FOUND','工程版本不存在'),404)}})
export default routes

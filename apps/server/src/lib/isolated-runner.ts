import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import type { BackendStackId } from 'shared'
import { engineeringFile, engineeringTree } from './engineering-store'

export type RunnerAction='build'|'test'|'verify'
export type RunnerStatus='queued'|'running'|'succeeded'|'failed'|'cancelled'|'timed-out'
export interface RunnerRecord{id:string;userId:string;projectId:string;stack:BackendStackId;action:RunnerAction;status:RunnerStatus;createdAt:string;startedAt?:string;finishedAt?:string;exitCode?:number;output:string;truncated:boolean;error?:string}
const records=new Map<string,RunnerRecord>();const controllers=new Map<string,AbortController>();let active=0;const queue:Array<()=>void>=[]
export const RUNNER_PROFILES:Record<BackendStackId,Record<RunnerAction,string[]>>={
'hono-drizzle':{build:['pnpm','--filter','api','build'],test:['pnpm','--filter','api','test'],verify:['pnpm','--filter','api','build']},
'nestjs-prisma':{build:['pnpm','--filter','api','build'],test:['pnpm','--filter','api','test'],verify:['pnpm','--filter','api','build']},
'fastapi-sqlalchemy':{build:['python','-m','compileall','apps/api/app'],test:['python','-m','pytest','apps/api'],verify:['python','-m','compileall','apps/api/app']},
'spring-boot-jpa':{build:['mvn','-f','apps/api/pom.xml','verify','-DskipTests'],test:['mvn','-f','apps/api/pom.xml','test'],verify:['mvn','-f','apps/api/pom.xml','verify']},
'gin-gorm':{build:['go','test','./...'],test:['go','test','./...'],verify:['go','test','./...']},
}
const intEnv=(name:string,fallback:number)=>{const value=Number(process.env[name]);return Number.isInteger(value)&&value>0?value:fallback}
export function runnerEnabled(){return ['docker','local-process'].includes(process.env.RUNNER_DRIVER||'disabled')}
export function runnerPolicy(){return{driver:process.env.RUNNER_DRIVER||'disabled',network:'none',readOnlyRoot:true,timeoutSeconds:intEnv('RUNNER_TIMEOUT_SECONDS',300),memoryMb:intEnv('RUNNER_MEMORY_MB',1024),cpus:Number(process.env.RUNNER_CPUS||1),maxOutputBytes:intEnv('RUNNER_MAX_OUTPUT_BYTES',1_000_000),maxConcurrent:intEnv('RUNNER_MAX_CONCURRENT',2)}}
async function materialize(userId:string,projectId:string){const root=await mkdtemp(path.join(os.tmpdir(),'siteforge-run-'));const tree=await engineeringTree(userId,projectId);for(const item of tree.files){const stored=await engineeringFile(userId,projectId,item.path);if(!stored)continue;const target=path.join(root,item.path);if(!target.startsWith(root+path.sep))throw new Error('RUNNER_PATH_ESCAPE');await mkdir(path.dirname(target),{recursive:true});await writeFile(target,stored.content,{mode:0o600})}return root}
function append(record:RunnerRecord,chunk:Buffer|string){const limit=runnerPolicy().maxOutputBytes;const next=record.output+String(chunk);if(Buffer.byteLength(next)>limit){record.output=Buffer.from(next).subarray(0,limit).toString();record.truncated=true}else record.output=next}
function runCommand(record:RunnerRecord,cwd:string,signal:AbortSignal){return new Promise<number>((resolve,reject)=>{const command=RUNNER_PROFILES[record.stack][record.action];const driver=runnerPolicy().driver;const image=`${process.env.RUNNER_IMAGE_PREFIX||'siteforge/runner'}-${record.stack}:latest`;const executable=driver==='docker'?'docker':command[0];const args=driver==='docker'?['run','--rm','--network=none','--read-only','--memory',`${runnerPolicy().memoryMb}m`,'--cpus',String(runnerPolicy().cpus),'-v',`${cwd}:/workspace:rw`,'-w','/workspace',image,...command]:command.slice(1);const child=spawn(executable,args,{cwd,env:{PATH:process.env.PATH||'',HOME:'/tmp',CI:'true',NO_COLOR:'1'},signal,shell:false});child.stdout.on('data',(data)=>append(record,data));child.stderr.on('data',(data)=>append(record,data));child.on('error',reject);child.on('close',(code)=>resolve(code??1))})}
async function execute(record:RunnerRecord){active++;record.status='running';record.startedAt=new Date().toISOString();const controller=new AbortController();controllers.set(record.id,controller);let root='';const timer=setTimeout(()=>controller.abort(),runnerPolicy().timeoutSeconds*1000);try{root=await materialize(record.userId,record.projectId);const code=await runCommand(record,root,controller.signal);record.exitCode=code;record.status=code===0?'succeeded':'failed'}catch(error){if(controller.signal.aborted&&record.status!=='cancelled')record.status='timed-out';else if(record.status!=='cancelled'){record.status='failed';record.error=error instanceof Error?error.message:'RUNNER_FAILED'}}finally{clearTimeout(timer);controllers.delete(record.id);record.finishedAt=new Date().toISOString();if(root)await rm(root,{recursive:true,force:true});active--;queue.shift()?.()}}
function schedule(record:RunnerRecord){const start=()=>void execute(record);if(active<runnerPolicy().maxConcurrent)start();else queue.push(start)}
export function createRun(userId:string,projectId:string,stack:BackendStackId,action:RunnerAction){if(!runnerEnabled())throw new Error('RUNNER_DISABLED');const record:RunnerRecord={id:randomUUID(),userId,projectId,stack,action,status:'queued',createdAt:new Date().toISOString(),output:'',truncated:false};records.set(record.id,record);schedule(record);return structuredClone(record)}
export function getRun(userId:string,id:string){const record=records.get(id);return record&&record.userId===userId?structuredClone(record):undefined}
export function cancelRun(userId:string,id:string){const record=records.get(id);if(!record||record.userId!==userId)return false;if(record.status==='queued'||record.status==='running'){record.status='cancelled';controllers.get(id)?.abort();record.finishedAt=new Date().toISOString()}return true}
export function resetRunnerForTests(){records.clear();controllers.clear();queue.splice(0);active=0}

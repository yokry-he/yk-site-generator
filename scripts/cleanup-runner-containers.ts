import { spawn } from 'node:child_process'
const maximumAge=Number(process.env.RUNNER_CONTAINER_MAX_AGE_SECONDS||900);const cutoff=Math.floor(Date.now()/1000)-maximumAge
function run(command:string,args:string[]){return new Promise<string>((resolve,reject)=>{const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});let out='';let err='';child.stdout.on('data',(chunk)=>out+=chunk);child.stderr.on('data',(chunk)=>err+=chunk);child.on('close',(code)=>code===0?resolve(out):reject(new Error(err||`${command} exited ${code}`)))})}
const rows=(await run('docker',['ps','-a','--filter','label=siteforge.runner=true','--format','{{.ID}} {{.CreatedAt}}'])).trim().split('\n').filter(Boolean);let removed=0
for(const row of rows){const[id,...createdParts]=row.split(' ');const created=Math.floor(Date.parse(createdParts.join(' '))/1000);if(Number.isFinite(created)&&created<cutoff){await run('docker',['rm','-f',id]);removed++}}
console.log(`Removed ${removed} stale SiteForge Runner container(s).`)

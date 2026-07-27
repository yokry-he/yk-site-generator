import { readFile } from 'node:fs/promises'
import { GOLDEN_PROJECTS } from './lib/rc-golden-fixture'
const stacks=[...new Set(GOLDEN_PROJECTS.map((item)=>item.stack))];const issues:string[]=[]
for(const stack of stacks){const file=`infra/runner/${stack}/Dockerfile`;const content=await readFile(file,'utf8');for(const marker of ['WORKDIR /workspace','USER 10001:10001'])if(!content.includes(marker))issues.push(`${file}: missing ${marker}`);if(/USER\s+root/i.test(content))issues.push(`${file}: root user is forbidden`)}
const example=JSON.parse(await readFile('infra/runner/images.lock.example.json','utf8')) as {images?:Array<{stack:string;reference:string}>};for(const stack of stacks)if(!example.images?.some((item)=>item.stack===stack&&item.reference.includes('@sha256:')))issues.push(`lock example missing ${stack}`)
if(issues.length){console.error(issues.join('\n'));process.exitCode=1}else console.log(`Runner image policy passed for ${stacks.length} stacks.`)

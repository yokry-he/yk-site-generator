import { mkdir,readFile,writeFile } from 'node:fs/promises'
const checks=[
 ['apps/server/src/lib/isolated-runner.ts',['--network=none','--read-only','--cap-drop=ALL','no-new-privileges','--pids-limit','RUNNER_PATH_ESCAPE']],
 ['apps/server/src/routes/preview.ts',["connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'",'X-Content-Type-Options']],
 ['apps/server/src/lib/engineering-store.ts',['INVALID_ENGINEERING_PATH','ENGINEERING_PATH_TOO_LONG','ENGINEERING_PROJECT_TOO_LARGE']],
 ['apps/server/src/routes/delivery.ts',['verifyReleaseEvidence','x-siteforge-timestamp','x-siteforge-nonce','x-siteforge-signature']],
 ['apps/server/src/lib/trusted-release-evidence.ts',['timingSafeEqual','usedNonces','maxSkew','idempotency-key']],
 ['apps/server/src/lib/distributed-rate-limit.ts',['createHmac','AUTH_RATE_LIMIT_FAIL_MODE','AUTH_RATE_LIMIT_BACKEND_UNAVAILABLE']],
] as const
const issues:Array<{file:string;message:string}>=[]
for(const[file,markers]of checks){let content='';try{content=await readFile(file,'utf8')}catch{issues.push({file,message:'missing security-critical file'});continue}for(const marker of markers)if(!content.includes(marker))issues.push({file,message:`missing marker: ${marker}`})}
const env=await readFile('apps/server/.env.example','utf8');for(const pattern of [/sk-[A-Za-z0-9]{20,}/,/AKIA[0-9A-Z]{16}/,/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/])if(pattern.test(env))issues.push({file:'apps/server/.env.example',message:`possible committed secret: ${pattern}`})
const report={schemaVersion:1,generatedAt:new Date().toISOString(),status:issues.length?'failed':'passed',checks:checks.length,issues};await mkdir('artifacts',{recursive:true});await writeFile('artifacts/security-audit.json',`${JSON.stringify(report,null,2)}\n`,'utf8');if(issues.length){for(const issue of issues)console.error(`${issue.file}: ${issue.message}`);process.exitCode=1}else console.log(`RC security audit passed with ${checks.length} critical surfaces.`)

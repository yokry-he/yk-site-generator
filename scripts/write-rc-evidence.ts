import { mkdir,writeFile } from 'node:fs/promises'
import path from 'node:path'
import { safeEvidenceFileName,signRcEvidence,type RcEvidencePayload,type RcEvidenceStatus } from './lib/rc-evidence'
function arg(name:string,fallback=''){const index=process.argv.indexOf(`--${name}`);return index>=0?process.argv[index+1]??fallback:fallback}
const gate=arg('gate');if(!gate)throw new Error('--gate is required');const status=arg('status','passed') as RcEvidenceStatus;if(!['passed','failed'].includes(status))throw new Error('--status must be passed or failed')
const candidateVersion=arg('version',process.env.RC_CANDIDATE_VERSION||'0.1.0-rc.1');const commit=arg('commit',process.env.GITHUB_SHA||process.env.RC_COMMIT||'');if(!/^[a-f0-9]{40}$/i.test(commit))throw new Error('A full candidate commit SHA is required')
const source=(arg('source',process.env.GITHUB_ACTIONS==='true'?'github-actions':'isolated-runner')) as RcEvidencePayload['source'];if(!['github-actions','isolated-runner'].includes(source))throw new Error('Unsupported evidence source')
const payload:RcEvidencePayload={schemaVersion:1,candidateVersion,gate,status,trusted:true,source,commit,runId:arg('run-id',process.env.GITHUB_RUN_ID||process.env.RC_RUN_ID||'local'),observedAt:new Date().toISOString(),details:arg('details')||undefined,artifacts:arg('artifacts').split(',').map((item)=>item.trim()).filter(Boolean)}
const signature=signRcEvidence(payload,process.env.RC_EVIDENCE_SIGNING_KEY||'');const output=path.resolve(arg('output',`artifacts/rc-evidence/${safeEvidenceFileName(gate)}.json`));await mkdir(path.dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify({...payload,signature},null,2)}\n`,'utf8');console.log(`Signed RC evidence: ${gate} → ${output}`)

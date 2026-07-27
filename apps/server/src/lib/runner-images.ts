import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { BackendStackId } from 'shared'

interface LockedImage { stack:BackendStackId; reference:string; sourceDigest?:string; builtAt?:string }
interface ImageLock { schemaVersion:number; images:LockedImage[] }
let cache:{path:string;mtime:number;lock:ImageLock}|undefined
const digestReference=/^(?:[a-z0-9._/-]+(?:\:[a-z0-9._-]+)?@)?sha256:[a-f0-9]{64}$|^[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/i
export function validRunnerImageReference(value:string){return digestReference.test(value)}
export async function runnerImage(stack:BackendStackId):Promise<{reference:string;digestPinned:boolean}>{const file=path.resolve(process.env.RUNNER_IMAGE_LOCK_FILE||'infra/runner/images.lock.json');try{const raw=await readFile(file,'utf8');const lock=JSON.parse(raw) as ImageLock;const item=lock.images.find((entry)=>entry.stack===stack);if(!item)throw new Error(`RUNNER_IMAGE_MISSING:${stack}`);const digestPinned=validRunnerImageReference(item.reference);if(process.env.NODE_ENV==='production'&&!digestPinned)throw new Error(`RUNNER_IMAGE_DIGEST_REQUIRED:${stack}`);return{reference:item.reference,digestPinned}}catch(error){if(process.env.NODE_ENV==='production')throw error;return{reference:`${process.env.RUNNER_IMAGE_PREFIX||'siteforge/runner'}-${stack}:latest`,digestPinned:false}}}
export function runnerImagePolicy(){return{lockFile:process.env.RUNNER_IMAGE_LOCK_FILE||'infra/runner/images.lock.json',productionRequiresDigest:true,developmentTagFallback:true}}

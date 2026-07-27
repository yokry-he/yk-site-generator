import { createHmac,timingSafeEqual } from 'node:crypto'

export type RcEvidenceStatus='passed'|'failed'
export interface RcEvidencePayload{schemaVersion:1;candidateVersion:string;gate:string;status:RcEvidenceStatus;trusted:true;source:'github-actions'|'isolated-runner';commit:string;runId:string;observedAt:string;details?:string;artifacts?:string[]}
export interface SignedRcEvidence extends RcEvidencePayload{signature:string}
export function validSigningKey(value:string){return value.length>=32&&!/replace-with|changeme|example/i.test(value)}
export function canonicalEvidence(value:RcEvidencePayload){return JSON.stringify({schemaVersion:value.schemaVersion,candidateVersion:value.candidateVersion,gate:value.gate,status:value.status,trusted:value.trusted,source:value.source,commit:value.commit,runId:value.runId,observedAt:value.observedAt,details:value.details??'',artifacts:value.artifacts??[]})}
export function signRcEvidence(value:RcEvidencePayload,key:string){if(!validSigningKey(key))throw new Error('RC_EVIDENCE_SIGNING_KEY_REQUIRED');return createHmac('sha256',key).update(canonicalEvidence(value)).digest('hex')}
export function verifyRcEvidence(value:SignedRcEvidence,key:string){if(!validSigningKey(key)||!value.signature)return false;const expected=Buffer.from(signRcEvidence(value,key));const supplied=Buffer.from(value.signature);return expected.length===supplied.length&&timingSafeEqual(expected,supplied)}
export function safeEvidenceFileName(gate:string){return gate.replace(/[^A-Za-z0-9._-]+/g,'_')}

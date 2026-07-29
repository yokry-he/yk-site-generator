import { apiUrl, ensureOk } from './api'

export interface EngineeringFileSummary { path:string;sha256:string;size:number;updatedAt:string }
export interface EngineeringFile extends EngineeringFileSummary { content:string }
export interface EngineeringVersion { id:string;number:number;name:string;note?:string;fileCount:number;createdAt:string }
export interface EngineeringDiff { path:string;status:'added'|'deleted'|'modified'|'unchanged';beforeSha256?:string;afterSha256?:string;beforeSize?:number;afterSize?:number }
export interface RunnerProfile { id:string;name:string;actions:string[] }
export interface EngineeringRun { id:string;status:string;action:string;stack:string;output?:string;error?:string;createdAt:string;updatedAt:string }

async function request<T>(path:string,init?:RequestInit):Promise<T>{const headers=new Headers(init?.headers);if(init?.body)headers.set('content-type','application/json');const response=await ensureOk(await fetch(apiUrl(path),{...init,headers,credentials:'include'}));return response.json() as Promise<T>}
export const engineeringApi={
 tree:(projectId:string)=>request<{revision:number;files:EngineeringFileSummary[]}>(`/api/engineering-projects/${projectId}/tree`),
 file:(projectId:string,filePath:string)=>request<{file:EngineeringFile}>(`/api/engineering-projects/${projectId}/files/${filePath.split('/').map(encodeURIComponent).join('/')}`),
 save:(projectId:string,revision:number,files:Array<{path:string;content:string}>)=>request<{revision:number;files:EngineeringFileSummary[]}>(`/api/engineering-projects/${projectId}/files`,{method:'PUT',body:JSON.stringify({revision,files})}),
 versions:(projectId:string)=>request<{versions:EngineeringVersion[]}>(`/api/engineering-projects/${projectId}/versions`),
 snapshot:(projectId:string,name:string,note?:string)=>request<{version:EngineeringVersion}>(`/api/engineering-projects/${projectId}/versions`,{method:'POST',body:JSON.stringify({name,note})}),
 diff:(projectId:string,from:string,to:string)=>request<{files:EngineeringDiff[]}>(`/api/engineering-projects/${projectId}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
 profiles:()=>request<{policy:unknown;profiles:RunnerProfile[]}>('/api/runs/profiles'),
 run:(projectId:string,stack:string,action:string)=>request<{run:EngineeringRun}>('/api/runs',{method:'POST',body:JSON.stringify({projectId,stack,action})}),
 runStatus:(id:string)=>request<{run:EngineeringRun}>(`/api/runs/${id}`),
 cancelRun:(id:string)=>request<{cancelled:boolean}>(`/api/runs/${id}`,{method:'DELETE'}),
 gates:(projectId:string,versionId:string)=>request<any>(`/api/delivery/gates/${projectId}/${versionId}`),
 previews:(projectId:string)=>request<any>(`/api/delivery/previews?projectId=${encodeURIComponent(projectId)}`),
 createPreview:(projectId:string,versionId:string)=>request<any>('/api/delivery/previews',{method:'POST',body:JSON.stringify({projectId,versionId})}),
 deployments:(projectId:string)=>request<any>(`/api/delivery/deployments?projectId=${encodeURIComponent(projectId)}`),
 deploy:(projectId:string,versionId:string,environment:'staging'|'production')=>request<any>('/api/delivery/deployments',{method:'POST',body:JSON.stringify({projectId,versionId,environment})}),
}

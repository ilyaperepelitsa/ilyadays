import fixture from '../../../content/aurelius/fixture.json';
import { applyCommand } from './domain.mjs';
import type { WorkCommand, Workspace } from './types';

const DB='aurelius-synthetic-v1';
async function browserDb(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function localState():Promise<Workspace>{
  const db=await browserDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readonly'),request=tx.objectStore('workspace').get('current');
    request.onsuccess=()=>resolve((request.result??structuredClone(fixture)) as Workspace);
    request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();
  });
}
async function localCommand(command:WorkCommand):Promise<Workspace>{
  // Compute outside the IDB transaction, then compare-and-swap inside it (other tabs can edit).
  const previous=await localState();
  if(previous.corpus_kind!=='synthetic')throw Error('Browser demonstration accepts synthetic data only');
  const fresh=await applyCommand(previous,command) as Workspace;
  const db=await browserDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),request=store.get('current');
    request.onsuccess=()=>{if((request.result?.version??0)!==command.expected_version){tx.abort();return;}store.put(fresh,'current');};
    tx.oncomplete=()=>{db.close();resolve(fresh);};
    tx.onabort=()=>{db.close();reject(Error('Workspace changed in another tab. Reload before saving.'));};
    tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export type WorkStorage = {mode:'browser'|'sqlite';load:()=>Promise<Workspace>;command:(c:WorkCommand)=>Promise<Workspace>};
export async function connectStorage():Promise<WorkStorage>{
  // Public builds never probe a private service. This flag is set by the loopback dev launcher only.
  if(process.env.NEXT_PUBLIC_AURELIUS_LOCAL==='1'){
    const response=await fetch('/api/aurelius/health',{cache:'no-store'});
    if(!response.ok)throw Error('Local SQLite service is unavailable. Start npm run aurelius:dev.');
    return {mode:'sqlite',load:async()=>{const r=await fetch('/api/aurelius/state',{cache:'no-store'});if(!r.ok)throw Error('Could not load the local workspace');return r.json();},command:async c=>{
      const r=await fetch('/api/aurelius/commands',{method:'POST',headers:{'Content-Type':'application/json','X-Aurelius-Local':'1'},body:JSON.stringify(c)});
      const value=await r.json();if(!r.ok)throw Error(value.detail??'Save failed');return value;
    }};
  }
  return {mode:'browser',load:localState,command:localCommand};
}
export function downloadSyntheticProject(workspace:Workspace){
  if(workspace.corpus_kind!=='synthetic')throw Error('Only synthetic demonstration export is implemented');
  const payload={manifest:{format:'aurelius-project-v1',corpus:'synthetic',not_a_translation:true,source_processing:false,model_runs:[],edition_ids:workspace.editions.map(e=>e.id)},workspace};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='aurelius-synthetic-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

import analysis from '../../../content/aurelius/analysis.json';
import fixture from '../../../content/aurelius/fixture.json';
import backupStudy from '../../../content/aurelius/backup-study.json';
import realMap from '../../../content/aurelius/real-map.json';
import { upgradeFixture } from './upgrade.mjs';
import { upgradeStudy } from './study-upgrade.mjs';
import { applyCommand } from './domain.mjs';
import type { WorkCommand, Workspace } from './types';

const DB='aurelius-synthetic-v1';
type BrowserCorpus={name:string;seed:Workspace};
async function browserDb(name=DB){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(name,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function localState(corpus:BrowserCorpus):Promise<Workspace>{
  const db=await browserDb(corpus.name);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite'),request=tx.objectStore('workspace').get('current');
    let loaded:Workspace;
    request.onsuccess=()=>{try{const saved=request.result??structuredClone(corpus.seed);loaded=(corpus.seed.corpus_kind==='synthetic'?upgradeFixture(saved,corpus.seed):upgradeStudy(saved,corpus.seed)) as Workspace;if(loaded.corpus_kind!==corpus.seed.corpus_kind)throw Error('Stored edition identity conflict; source data retained');if(loaded!==request.result)tx.objectStore('workspace').put(loaded,'current');}catch(error){tx.abort();reject(error);}};
    request.onerror=()=>reject(request.error);tx.oncomplete=()=>{db.close();resolve(loaded);};tx.onabort=()=>{db.close();reject(Error('Could not upgrade the saved workspace; existing data retained.'));};
  });
}
async function localCommand(command:WorkCommand,corpus:BrowserCorpus):Promise<Workspace>{
  // Compute outside the IDB transaction, then compare-and-swap inside it (other tabs can edit).
  const previous=await localState(corpus);
  if(previous.corpus_kind==='hays')throw Error('The modern translation stays in private local storage');
  const fresh=await applyCommand(previous,command) as Workspace;
  const db=await browserDb(corpus.name);
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite'),store=tx.objectStore('workspace'),request=store.get('current');
    request.onsuccess=()=>{if((request.result?.version??0)!==command.expected_version){tx.abort();return;}store.put(fresh,'current');};
    tx.oncomplete=()=>{db.close();resolve(fresh);};
    tx.onabort=()=>{db.close();reject(Error('Workspace changed in another tab. Reload before saving.'));};
    tx.onerror=()=>{db.close();reject(tx.error);};
  });
}
export type DiscoveryArtifact={schema_version:number;pipeline_version:string;run_id:string;corpus_kind:string;corpus_hash:string;vector_origin:string;vector_description:string;dimensions:number;chunk_count:number;excluded_chunks:string[];sampled:boolean;share_mode?:string;edition?:{id:string;translator:string;work:string;source_location:string};embedding_configuration?:{model:string;dimensions:number};pca:{explained_variance:number[];explained_variance_ratio:number[];singular_values:number[]};clustering:{linkage:string;distance:string;input_dimensions:number;input_space:string;labels_by_k:Record<string,number[]>;children:number[][];distances:number[]};software:{numpy:string;scikit_learn:string};points:{passage_id:string;revision_id:string;text_hash:string;reference:string;x:number;y:number}[]};
export type WorkStorage = {analysis:()=>Promise<DiscoveryArtifact>;mode:'browser'|'sqlite';load:()=>Promise<Workspace>;command:(c:WorkCommand)=>Promise<Workspace>};
export async function connectStorage():Promise<WorkStorage>{
  // Public builds never probe a private service. This flag is set by the loopback dev launcher only.
  if(process.env.NODE_ENV==='development'&&process.env.NEXT_PUBLIC_AURELIUS_LOCAL==='1'){
    const response=await fetch('/api/aurelius/health',{cache:'no-store'});
    if(!response.ok)throw Error('Local SQLite service is unavailable. Start npm run aurelius:dev.');
    return {mode:'sqlite',analysis:async()=>{const r=await fetch('/api/aurelius/analysis',{cache:'no-store'});if(!r.ok){const error=await r.json();throw Error(error.detail??'Could not fit the active-corpus map');}return r.json();},load:async()=>{const r=await fetch('/api/aurelius/state',{cache:'no-store'});if(!r.ok)throw Error('Could not load the local workspace');return r.json();},command:async c=>{
      const r=await fetch('/api/aurelius/commands',{method:'POST',headers:{'Content-Type':'application/json','X-Aurelius-Local':'1'},body:JSON.stringify(c)});
      const value=await r.json();if(!r.ok)throw Error(value.detail??'Save failed');return value;
    }};
  }
  const demo=new URLSearchParams(window.location.search).get('corpus')==='demo';
  const corpus:BrowserCorpus=demo?{name:DB,seed:fixture as Workspace}:{name:'aurelius-casaubon-study-v1',seed:backupStudy as Workspace};
  return {mode:'browser',analysis:async()=>{if(demo)return analysis as DiscoveryArtifact;if(!realMap)throw Error('Full-corpus OpenAI embeddings have not been run yet. The real imports are extracted; production model access and an approved processing run are needed. No lexical vectors are shown as real embeddings.');return realMap as unknown as DiscoveryArtifact;},load:()=>localState(corpus),command:c=>localCommand(c,corpus)};
}
export function downloadSyntheticProject(workspace:Workspace){
  if(workspace.corpus_kind==='hays')throw Error('Modern translation export is private-only and not implemented');
  const payload={manifest:{format:'aurelius-project-v1',corpus:workspace.corpus_kind,not_a_translation:workspace.corpus_kind==='synthetic',source_processing:false,model_runs:[],edition_ids:workspace.editions.map(e=>e.id)},workspace};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=workspace.corpus_kind==='synthetic'?'aurelius-synthetic-project.json':'aurelius-casaubon-editorial-study.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

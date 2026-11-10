import {createHash} from 'node:crypto';

export function validateProductionBatch(body,manifest){
 if(manifest.execution_enabled!==true||!Number.isFinite(Date.parse(manifest.expires_at))||Date.now()>Date.parse(manifest.expires_at))throw Error('The bounded production run is disabled or expired');
 if(!body||body.manifest_id!==manifest.id||Object.keys(body).some(k=>!['manifest_id','input','request_id'].includes(k)))throw Error('Unapproved production input manifest');
 if(!Array.isArray(body.input)||!body.input.length||body.input.length>manifest.max_batch_items)throw Error('Invalid batch size');
 if(typeof body.request_id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.request_id)||manifest.combined_cap_usd!==.1)throw Error('Invalid bounded job identity');
 const seen=new Set();let tokens=0;
 for(const text of body.input){if(typeof text!=='string'||!text.trim())throw Error('Invalid embedding input');const hash=createHash('sha256').update(text).digest('hex'),allowed=manifest.inputs[hash];if(!allowed||allowed.bytes!==Buffer.byteLength(text)||seen.has(hash)||!Number.isInteger(allowed.tokens)||allowed.tokens<1||allowed.tokens>8191)throw Error('Source text is outside the inspected allowlist');seen.add(hash);tokens+=allowed.tokens;}
 if(tokens>manifest.max_batch_tokens)throw Error('Batch token cap exceeded');
 return {tokens,estimated_usd:tokens*.13/1e6,input_hashes:[...seen]};
}

export async function executeProductionBatch(body,manifest,{credential,fetcher=fetch}){
 const reservation=validateProductionBatch(body,manifest);
 if(!credential)throw Error('Production authentication unavailable');
 const providers=manifest.configuration?.provider_allowlist;
 if(!Array.isArray(providers)||providers.length!==1||!['openai','azure'].includes(providers[0]))throw Error('Unknown model hosting route');
 let response;try{response=await fetcher('https://ai-gateway.vercel.sh/v1/embeddings',{method:'POST',headers:{Authorization:`Bearer ${credential}`,'Content-Type':'application/json'},body:JSON.stringify({model:'openai/text-embedding-3-large',dimensions:3072,input:body.input,encoding_format:'float',providerOptions:{gateway:{only:providers}}}),cache:'no-store',signal:AbortSignal.timeout(45000)});}catch{const error=Error('Production provider outcome unknown');error.name='ProviderOutcomeUnknown';throw error;}
 if(!response.ok){let type='provider_request_failed',diagnostic;try{const error=await response.json();if(typeof error.error?.type==='string'&&/^[a-z_]{1,80}$/.test(error.error.type))type=error.error.type;const message=error.error?.message;if(type==='no_providers_available'&&typeof message==='string'&&message.length<800&&!body.input.some(text=>message.includes(text.slice(0,20)))&&!/Bearer |sk-/.test(message))diagnostic=message.split(credential).join('[redacted]');}catch{}return {http_status:response.status,error:type,diagnostic};}
 let data;try{data=await response.json();}catch{const error=Error('Invalid provider response');error.name='ProviderOutcomeUnknown';throw error;}
 if(data.model!=='openai/text-embedding-3-large'||!Array.isArray(data.data)||data.data.length!==body.input.length||!Number.isInteger(data.usage?.total_tokens)){const error=Error('Unexpected production embedding response');error.name='ProviderOutcomeUnknown';throw error;}
 const rows=[...data.data].sort((a,b)=>a.index-b.index),encoded=[];
 for(let n=0;n<rows.length;n++){const row=rows[n];if(row.index!==n||!Array.isArray(row.embedding)||row.embedding.length!==3072||row.embedding.some(v=>!Number.isFinite(v)||!Number.isFinite(Math.fround(v)))||!row.embedding.some(v=>v!==0)){const error=Error('Invalid full-dimensional vector');error.name='ProviderOutcomeUnknown';throw error;}const bytes=new ArrayBuffer(3072*4),view=new DataView(bytes);row.embedding.forEach((v,i)=>view.setFloat32(i*4,v,true));encoded.push(Buffer.from(bytes).toString('base64'));}
 return {http_status:200,model:data.model,dimensions:3072,vectors_f32_base64:encoded,usage:data.usage,upstream_request_id:response.headers.get('x-request-id'),gateway:data.providerMetadata?.gateway?{cost:data.providerMetadata.gateway.cost,generation_id:data.providerMetadata.gateway.generationId,routing:data.providerMetadata.gateway.routing}:null,reserved_input_tokens:reservation.tokens};
}

export async function readProductionBody(request,limit=150000){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON request required');
 const reader=request.body?.getReader();if(!reader)throw Error('Missing body');let size=0,text='';const decoder=new TextDecoder();
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Request too large');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());
}

/** Read-only production preflight. No source text or embedding request is sent. */
export function protectedProductionHost(url,env,hostHeader){
 const host=new URL(url).hostname;
 return env.VERCEL_ENV==='production'&&typeof env.VERCEL_URL==='string'&&host===env.VERCEL_URL&&hostHeader===env.VERCEL_URL&&host.endsWith('.vercel.app');
}
export async function productionEmbeddingPreflight({credential,authentication,fetcher=fetch}){
 const base={model:'openai/text-embedding-3-large',dimensions:3072,provider:'vercel_ai_gateway',authentication,source_requests_made:0};
 if(!credential)return {...base,status:'credentials_unavailable'};
 try{
  const response=await fetcher('https://ai-gateway.vercel.sh/v1/credits',{method:'GET',headers:{Authorization:`Bearer ${credential}`},cache:'no-store',signal:AbortSignal.timeout(10000)});
  const payload=await response.json();
  if(!response.ok){const raw=payload?.error?.type??payload?.error?.code??'gateway_access_unavailable';const allowed=['customer_verification_required','insufficient_funds','quota_for_entity_exceeded','authentication_error','invalid_api_key'];return {...base,status:allowed.includes(raw)?raw:'gateway_access_unavailable',http_status:response.status};}
  const balance=Number(payload.balance??payload.credits?.balance);
  return {...base,status:Number.isFinite(balance)?balance>0?'credit_available_model_access_unverified':'insufficient_funds':'credit_check_succeeded',model_access:'unverified',http_status:response.status,credit_available:Number.isFinite(balance)?balance>0:null};
 }catch{return {...base,status:'gateway_check_failed'};}
}

import {getVercelOidcToken} from '@vercel/oidc';
import manifest from '../../../../../../content/aurelius/production-inputs.json';
import {protectedProductionHost} from '@/lib/aurelius/production.mjs';
import {executeProductionBatch,readProductionBody} from '@/lib/aurelius/production-embeddings.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(!protectedProductionHost(request.url,process.env,request.headers.get('host')))return Response.json({error:'Not found'},{status:404,headers});
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Wrong origin'},{status:403,headers});
 try{
  const body=await readProductionBody(request);
  const credential=manifest.configuration.transport==='vercel_production_openai_direct'?process.env.OPENAI_API_KEY:process.env.AI_GATEWAY_API_KEY||await getVercelOidcToken();
  const result=await executeProductionBatch(body,manifest,{credential});
  return Response.json(result,{status:result.http_status,headers});
 }catch(error){const name=error instanceof Error?error.name:'Error',unknown=name==='TimeoutError'||name==='ProviderOutcomeUnknown';return Response.json({error:unknown?'upstream_outcome_unknown':'production_request_rejected',detail:'Inspect the local job audit; no provider response or credential is exposed.'},{status:unknown?503:400,headers});}
}

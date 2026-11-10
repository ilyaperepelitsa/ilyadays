import { getVercelOidcToken } from '@vercel/oidc';
import { productionEmbeddingPreflight,protectedProductionHost } from '@/lib/aurelius/production.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;

export async function GET(request:Request){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 // Project protection is all_except_custom_domains. Only the protected,
 // immutable deployment hostname may inspect production model access.
 if(!protectedProductionHost(request.url,process.env,request.headers.get('host')))return Response.json({error:'Not found'},{status:404,headers});
 let credential=process.env.AI_GATEWAY_API_KEY,authentication='gateway_key';
 if(!credential){authentication='vercel_oidc';try{credential=await getVercelOidcToken();}catch{credential=undefined;}}
 const result=await productionEmbeddingPreflight({credential,authentication});
 return Response.json(result,{headers});
}

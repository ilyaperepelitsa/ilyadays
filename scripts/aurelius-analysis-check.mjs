import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateDiscoveryArtifact,validateReferenceDiscovery} from '../src/lib/aurelius/discovery.mjs';
const w=JSON.parse(fs.readFileSync(new URL('../content/aurelius/fixture.json',import.meta.url),'utf8'));
const a=JSON.parse(fs.readFileSync(new URL('../content/aurelius/analysis.json',import.meta.url),'utf8'));
validateDiscoveryArtifact(w,a);
for(const p of w.passages)if(crypto.createHash('sha256').update(p.text).digest('hex')!==p.text_hash)throw Error('Source hash mismatch; do not deploy stale discovery data');
const hash=crypto.createHash('sha256').update(JSON.stringify(w.passages.map(p=>[p.revision_id,p.text_hash]))).digest('hex');
if(hash!==a.corpus_hash||a.fixture_revision!==w.fixture_revision)throw Error('PCA artifact is stale; run npm run aurelius:analysis locally');
console.log(`Aurelius analysis verified: ${a.chunk_count}/${w.passages.length} synthetic chunks, actual PCA and full-space clusters.`);
for(const file of ['real-map.json','backup-map.json']){
const real=JSON.parse(fs.readFileSync(new URL('../content/aurelius/'+file,import.meta.url),'utf8'));
if(real){validateReferenceDiscovery(real);const sourceHash=crypto.createHash('sha256').update(JSON.stringify(real.points.map(p=>[p.revision_id,p.text_hash]))).digest('hex');if(sourceHash!==real.corpus_hash)throw Error('Real source map identity mismatch');console.log(`Real OpenAI source map verified: ${real.chunk_count} complete source vectors, 3072 dimensions, reference-only publication.`);}else console.log('Real source embeddings pending; no placeholder vectors are published.');

}

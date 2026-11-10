/** Public artifacts must cover every immutable active chunk, not a sampled/top-k neighborhood. */
export function validateDiscoveryArtifact(workspace,analysis){
 if(analysis.corpus_kind!=='synthetic'||workspace.corpus_kind!=='synthetic')throw Error('The checked-in discovery artifact is synthetic only');
 if(analysis.sampled!==false||analysis.excluded_chunks.length)throw Error('All-chunk discovery cannot silently omit sources');
 const rows=new Map(analysis.points.map(p=>[p.revision_id,p]));
 if(rows.size!==workspace.passages.length||analysis.points.length!==workspace.passages.length||analysis.chunk_count!==workspace.passages.length)throw Error('Projection does not cover every source chunk');
 for(const p of workspace.passages){const row=rows.get(p.revision_id);if(row?.text_hash!==p.text_hash||row.passage_id!==p.id||!Number.isFinite(row.x)||!Number.isFinite(row.y))throw Error('Projection source revision/hash mismatch');}
 if(analysis.dimensions!==3072||analysis.clustering.input_dimensions!==3072||analysis.clustering.input_space!=='full_feature_space'||analysis.clustering.distance!=='cosine'||analysis.clustering.linkage!=='average')throw Error('Incorrect full-space discovery configuration');
 for(const [k,labels] of Object.entries(analysis.clustering.labels_by_k))if(labels.length!==workspace.passages.length||new Set(labels).size!==Number(k))throw Error('Cluster cut does not cover every chunk');
 if(analysis.pca.explained_variance_ratio.length!==2||analysis.pca.explained_variance_ratio.some(n=>!Number.isFinite(n)||n<=0)||analysis.pca.explained_variance_ratio.reduce((a,b)=>a+b,0)>1+1e-10)throw Error('Invalid measured PCA variance');
 return true;
}
/** Public projection metadata carries references, never the private translation. */
export function validateReferenceDiscovery(a){
 if(!a||a.share_mode!=='references_and_projection_only'||a.vector_origin!=='openai'||a.dimensions!==3072||a.embedding_configuration?.model!=='text-embedding-3-large'||a.embedding_configuration?.dimensions!==3072)throw Error('Real full-dimensional source embeddings are required');
 if(a.sampled||a.excluded_chunks?.length||a.points?.length!==a.chunk_count||a.chunk_count<3||new Set(a.points.map(p=>p.revision_id)).size!==a.chunk_count)throw Error('The real projection must cover every imported chunk exactly once');
 if(a.points.some(p=>Object.keys(p).some(k=>!['passage_id','revision_id','text_hash','reference','x','y'].includes(k))||!Number.isFinite(p.x)||!Number.isFinite(p.y)||!/^\d+\.\d+$/.test(p.reference)||!/^[a-f0-9]{64}$/.test(p.text_hash)))throw Error('Invalid reference-only source row');
 if(a.clustering.input_dimensions!==3072||a.clustering.linkage!=='average'||a.clustering.distance!=='cosine'||Object.entries(a.clustering.labels_by_k).some(([k,labels])=>labels.length!==a.chunk_count||new Set(labels).size!==Number(k)))throw Error('Invalid full-dimensional clustering coverage');
 return true;
}

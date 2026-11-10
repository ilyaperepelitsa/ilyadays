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

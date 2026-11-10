/** Public artifacts must cover every immutable active chunk, not a sampled/top-k neighborhood. */
export function hierarchyIndex(run,n){
 if(!Number.isInteger(n)||n<2||run.children?.length!==n-1||run.distances?.length!==n-1)throw Error('Incomplete hierarchy');
 const nodes=Array.from({length:n},(_,id)=>({id,parent:-1,distance:0,members:[id],children:[]}));
 for(let i=0;i<n-1;i++){
  const id=n+i,pair=run.children[i],distance=run.distances[i];
  if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||!Number.isFinite(distance)||distance<0||pair.some(child=>!Number.isInteger(child)||child<0||child>=id||nodes[child].parent!==-1||nodes[child].distance>distance+1e-10))throw Error('Invalid hierarchy merge');
  const members=pair.flatMap(child=>nodes[child].members).sort((a,b)=>a-b);
  nodes.push({id,parent:-1,distance,members,children:[...pair]});for(const child of pair)nodes[child].parent=id;
 }
 if(nodes.at(-1).members.length!==n||nodes.slice(0,-1).some(node=>node.parent<0))throw Error('Hierarchy loses source leaves');
 return nodes;
}
export function hierarchyCut(nodes,k){
 const n=(nodes.length+1)/2;if(!Number.isInteger(k)||k<1||k>n)throw Error('Invalid cut');
 const active=new Set([nodes.length-1]);while(active.size<k){const id=Math.max(...active);active.delete(id);for(const child of nodes[id].children)active.add(child);}
 return [...active].sort((a,b)=>nodes[a].members[0]-nodes[b].members[0]);
}
export function hierarchyFrontier(nodes,root,depth=3){
 if(!nodes[root]||!Number.isInteger(depth)||depth<1||depth>5)throw Error('Invalid hierarchy viewport');
 const visible=[],edges=[],frontier=[];let row=0;
 const walk=(id,level)=>{const node=nodes[id];let y;
  if(level===depth||!node.children.length){y=row++;frontier.push(id);}else{const children=node.children.map(child=>{const position=walk(child,level+1);edges.push({from:id,to:child});return position;});y=(children[0]+children[1])/2;}
  visible.push({id,y});return y;
 };walk(root,0);return {visible,edges,frontier,rows:row};
}

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
 if(a.hierarchy){
  if(a.hierarchy.vector_hash!==a.vector_hash||a.hierarchy.evaluation_space!=='full_3072_cosine')throw Error('Hierarchy input differs from PCA source vectors');
  for(const [name,run]of Object.entries(a.hierarchy.methods)){
   if(!['average','complete'].includes(name)||run.linkage!==name||run.distance!=='cosine'||run.input_dimensions!==3072||run.input_space!=='full_feature_space')throw Error('Unknown hierarchy method');
   const nodes=hierarchyIndex(run,a.chunk_count);
   if(run.representatives.length!==nodes.length||run.representatives.some((representative,id)=>!nodes[id].members.includes(representative)))throw Error('Invalid hierarchy representative');
   for(const [k,labels]of Object.entries(run.labels_by_k)){
    const cut=hierarchyCut(nodes,Number(k)),expected=Array(a.chunk_count);cut.forEach((id,i)=>nodes[id].members.forEach(index=>expected[index]=i));
    if(labels.length!==expected.length||labels.some((label,i)=>label!==expected[i]))throw Error('Cut does not follow the stored hierarchy');
    const d=run.diagnostics_by_k[k],sizes=cut.map(id=>nodes[id].members.length);
    if(!d||JSON.stringify(d.sizes)!==JSON.stringify(sizes)||!Number.isFinite(d.largest_fraction)||Math.abs(d.largest_fraction-Math.max(...sizes)/a.chunk_count)>1e-12||d.singletons!==sizes.filter(n=>n===1).length||!Number.isFinite(d.cosine_silhouette)||d.cosine_silhouette < -1||d.cosine_silhouette>1)throw Error('Invalid hierarchy diagnostics');
   }
  }
  if(a.hierarchy.neighbors.length!==a.chunk_count||a.hierarchy.neighbors.some((rows,i)=>rows.length!==Math.min(8,a.chunk_count-1)||new Set(rows.map(r=>r.index)).size!==rows.length||rows.some((r,j)=>!Number.isInteger(r.index)||r.index<0||r.index>=a.chunk_count||r.index===i||!Number.isFinite(r.cosine_similarity)||Math.abs(r.cosine_similarity)>1||(j>0&&r.cosine_similarity>rows[j-1].cosine_similarity+1e-12))))throw Error('Invalid full-vector neighbors');
 }
 return true;
}

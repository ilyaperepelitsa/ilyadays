'use client';
import status from '../../../content/aurelius/processing-status.json';

export function DiscoveryStatus({compact=false,onOpen}:{compact?:boolean;onOpen?:()=>void}){
 const backup=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('map')==='backup';
 const corpus=backup?status.corpora.backup:status.corpora.primary;
 if(compact)return <aside className="au-discovery-status is-compact" aria-label="Real-source PCA status"><div><strong>PCA blocked · {corpus.cached_vectors} / {corpus.sections} real vectors</strong><p>{corpus.translator} · the production provider refused the required embedding model.</p></div><button type="button" onClick={onOpen}>PCA status & next step ↗</button></aside>;
 return <section className="au-discovery-status" data-testid="real-pca-blocked" aria-labelledby="au-map-blocked-title">
  <nav className="au-corpus-choice" aria-label="Map edition"><a href="?map=primary#discovery" aria-current={!backup?'page':undefined}>Gregory Hays · primary</a><a href="?map=backup#discovery" aria-current={backup?'page':undefined}>Meric Casaubon · backup</a></nav>
  <div className="au-discovery-heading"><div><h2 id="au-map-blocked-title">Real-source PCA is blocked</h2><p>{corpus.translator} · every numbered section · no sampling</p></div><span className="au-status status-unsupported">Model access required</span></div>
  <div className="au-pipeline-status" aria-label="Real corpus processing progress">
   <div><strong>{corpus.sections}</strong><span>Sections extracted</span><small>Exact text, references and hashes retained</small></div>
   <div><strong>{corpus.cached_vectors} / {corpus.sections}</strong><span>Real embeddings</span><small>{status.model} · {status.dimensions.toLocaleString()} dimensions</small></div>
   <div><strong>Pending</strong><span>PCA · 2 dimensions</span><small>Requires the complete real vector matrix</small></div>
   <div><strong>Pending</strong><span>Cluster proposals</span><small>Average linkage · full-dimensional cosine distance</small></div>
  </div>
  <p role="alert"><strong>The production provider rejected the model request:</strong> “{status.provider_reason}”</p>
  <p>The source imports and bounded processing authorization are recorded. Production authentication succeeded; a positive free-credit balance did not grant access to this model.</p>
  <div className="au-inference-step"><strong>What unlocks this map</strong><p>Enable paid AI Gateway credits, or configure a server-only OpenAI key in production. Then the existing job can resume, cache every successful vector, fit PCA and publish this reference-only map.</p><div className="au-button-row"><a href="https://vercel.com/ilyaperepelitsa-gmailcoms-projects/~/ai?modal=top-up" target="_blank" rel="noreferrer">Open Gateway credits ↗</a><a href="https://vercel.com/ilyaperepelitsa-gmailcoms-projects/ilyadays/settings/environment-variables" target="_blank" rel="noreferrer">Production model settings ↗</a></div></div>
  <p className="au-help">Last provider result: {status.checked_at} · HTTP {status.provider_status} · {status.requests_rejected} rejected requests · $0.10 combined job cap. No real PCA coordinates or clusters have been generated. No replacement vectors are plotted here.</p>
 </section>;
}

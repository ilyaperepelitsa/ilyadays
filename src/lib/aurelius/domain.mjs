/** Pure Stage 1 rules. Browser demo uses these; the local service enforces the same command contract. */
export const RELATIONS = ['supports','qualifies','challenges','illustrates','depends_on','paraphrases','editorial_extrapolation'];
export const INTERPRETATIONS = ['direct_statement','close_paraphrase','multi_passage_synthesis','editorial_inference','modern_application'];
export const scalarLength = (text) => Array.from(text).length;
export const scalarSlice = (text, start, end) => Array.from(text).slice(start, end).join('');
export function utf16ToScalar(text, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset > text.length) throw Error('Invalid editor offset');
  if (offset > 0 && offset < text.length && /[\uD800-\uDBFF]/.test(text[offset-1]) && /[\uDC00-\uDFFF]/.test(text[offset])) throw Error('Offset splits a surrogate pair');
  return scalarLength(text.slice(0, offset));
}
export function scalarToUtf16(text, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset > scalarLength(text)) throw Error('Invalid scalar offset');
  return scalarSlice(text, 0, offset).length;
}
export const sha256 = async (text) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
export const revision = (w,id) => w.revisions.find(r=>r.id===id);
export const entity = (w,id) => [...w.conclusions,...w.expressions].find(r=>r.id===id);
export const currentLinks = (w,rid) => w.links.filter(l=>l.target_revision===rid&&l.active);
export const docText = (doc) => (doc?.content??[]).map(block=>(block.content??[]).map(n=>n.text??'').join('')).join('\n');
export const plainDoc = (text,id) => ({type:'doc',content:text.split('\n').map((line,i)=>({type:'paragraph',attrs:{id:`${id}-block-${i}`},...(line?{content:[{type:'text',text:line}]}:{})}))});
export function validateDoc(doc) {
  if(doc?.type!=='doc'||!Array.isArray(doc.content)||doc.content.length>500)throw Error('Invalid editor document');
  const ids=new Set();
  for(const block of doc.content){
    if(block.type!=='paragraph'||typeof block.attrs?.id!=='string'||!block.attrs.id||ids.has(block.attrs.id))throw Error('Paragraphs need unique stable IDs');
    ids.add(block.attrs.id);
    for(const node of block.content??[]){
      if(node.type!=='text'||typeof node.text!=='string')throw Error('Only plain text paragraphs are supported in this slice');
      for(const mark of node.marks??[])if(mark.type!=='grounding')throw Error('Unsupported editor mark');
    }
  }
  if(docText(doc).length>50000)throw Error('Document is too long');
}
export async function validateAnchor(p,span) {
  if(!p||span.passage_revision!==p.revision_id||span.text_hash!==p.text_hash||await sha256(p.text)!==p.text_hash)throw Error('Source revision/hash mismatch');
  if(!Number.isInteger(span.start)||!Number.isInteger(span.end)||span.start<0||span.end<=span.start||span.end>scalarLength(p.text))throw Error('Invalid source offsets');
  if(scalarSlice(p.text,span.start,span.end)!==span.exact)throw Error('Quotation does not match the source');
  if(scalarSlice(p.text,Math.max(0,span.start-scalarLength(span.prefix)),span.start)!==span.prefix||scalarSlice(p.text,span.end,span.end+scalarLength(span.suffix))!==span.suffix)throw Error('Source context mismatch');
  return true;
}
/** Repeated exact matches are not silently resolved without context. */
export function locateQuote(text,exact,prefix='',suffix='') {
  const matches=[];for(let at=text.indexOf(exact);exact&&at>=0;at=text.indexOf(exact,at+1)){
    if((!prefix||text.slice(0,at).endsWith(prefix))&&(!suffix||text.slice(at+exact.length).startsWith(suffix)))matches.push({start:utf16ToScalar(text,at),end:utf16ToScalar(text,at+exact.length)});
  }
  if(matches.length!==1)throw Error(matches.length?'Ambiguous quotation; add context':'Quotation not found');
  return matches[0];
}
function invalidate(w,rid){
  if(w.assessments[rid])w.assessments[rid]={state:'stale',notes:'Evidence or a dependency changed. Human review is required.'};
  for(const r of w.revisions.filter(r=>r.dependencies.includes(rid)))if(w.assessments[r.id]?.state!=='stale'){invalidate(w,r.id);}
}
const requireText=(value,name)=>{if(typeof value!=='string'||!value.trim()||value.length>50000)throw Error(`${name} is required`);return value;};
function editable(w,e){if(!e)throw Error('Unknown editorial item');if(e.locked)throw Error('Unlock this editorial decision before changing it');return revision(w,e.current);}
export function mappedDependencies(w,doc) {
  const dependencies=new Set();
  for(const block of doc.content)for(const node of block.content??[])for(const mark of node.marks??[]){
    const rid=mark.attrs?.conclusionRevision, r=revision(w,rid);
    if(r?.kind!=='conclusion'||!Array.isArray(mark.attrs?.sourceSpanIds)||!mark.attrs.sourceSpanIds.length)throw Error('Invalid clause provenance');
    const supported=new Set(currentLinks(w,rid).map(l=>l.source_span));
    if(mark.attrs.sourceSpanIds.some(id=>!supported.has(id)))throw Error('Clause refers to an unrelated source');
    dependencies.add(rid);
  }
  return [...dependencies];
}
function allGrounded(doc){return doc.content.every(b=>(b.content??[]).every(n=>!n.text?.trim()||(n.marks??[]).some(m=>m.type==='grounding')));}
export async function applyCommand(input,command) {
  if(command.expected_version!==input.version)throw Error('Workspace changed. Reload before saving.');
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(command.id??''))throw Error('Invalid operation ID');
  if(input.events.some(e=>e.id===command.id))throw Error('Operation was already applied');
  const w=structuredClone(input),a=command.payload??{},op=command.id;
  const e=a.entity_id?entity(w,a.entity_id):null;
  switch(command.type){
    case 'create': {
      requireText(a.title,'Title');requireText(a.text,'Statement');
      const id=`${op}-conclusion`,rid=`${op}-revision`,doc=plainDoc(a.text,op);
      w.conclusions.push({id,title:a.title,current:rid,locked:false});
      w.revisions.push({id:rid,entity_id:id,kind:'conclusion',sequence:1,text:a.text,doc,scope:a.scope??'',practical_implication:a.practical_implication??'',qualifications:a.qualifications??'',assumptions:a.assumptions??'',interpretation:'editorial_inference',dependencies:[],created_at:command.at});
      w.assessments[rid]={state:'awaiting_review',notes:'New manual teaching; attach evidence before review.'};break;
    }
    case 'edit': {
      const old=editable(w,e);validateDoc(a.doc);requireText(docText(a.doc),'Text');
      if(!INTERPRETATIONS.includes(a.interpretation??old.interpretation))throw Error('Unknown interpretation type');
      const dependencies=old.kind==='expression'?mappedDependencies(w,a.doc):[];
      const fresh={...old,dependencies,id:`${op}-revision`,sequence:old.sequence+1,doc:a.doc,text:docText(a.doc),scope:a.scope??old.scope,practical_implication:a.practical_implication??old.practical_implication??'',qualifications:a.qualifications??old.qualifications,assumptions:a.assumptions??old.assumptions,interpretation:a.interpretation??old.interpretation,created_at:command.at};
      if(['text','scope','practical_implication','qualifications','assumptions','interpretation'].every(k=>old[k]===fresh[k])&&JSON.stringify(old.doc)===JSON.stringify(fresh.doc))throw Error('Nothing changed');
      w.revisions.push(fresh);e.current=fresh.id;
      w.assessments[fresh.id]={state:'stale',notes:'Edited revision. Previous reviews were not transferred.'};
      // The previous reviewed assessment is retained; only dependents are invalidated.
      for(const dep of w.revisions.filter(r=>r.dependencies.includes(old.id)))invalidate(w,dep.id);
      const bundles=w.bundles.filter(b=>b.target_revision===old.id);
      bundles.forEach((b,i)=>w.bundles.push({...b,id:`${op}-bundle-${i}`,target_revision:fresh.id}));
      currentLinks(w,old.id).forEach((l,i)=>w.links.push({...l,id:`${op}-link-${i}`,target_revision:fresh.id,bundle_id:`${op}-bundle-${bundles.findIndex(b=>b.id===l.bundle_id)}`,review_state:'stale',reviewer:null}));break;
    }
    case 'link': {
      const target=editable(w,e);if(target.kind!=='conclusion')throw Error('Attach source evidence to meaning first');
      let span=w.spans.find(s=>s.id===a.source_span);
      if(a.span){span={...a.span,id:`${op}-span`,validation:'valid'};await validateAnchor(w.passages.find(p=>p.revision_id===span.passage_revision),span);w.spans.push(span);}
      if(!span)throw Error('Choose an exact source span');
      await validateAnchor(w.passages.find(p=>p.revision_id===span.passage_revision),span);
      if(!RELATIONS.includes(a.relation))throw Error('Unknown evidence relation');
      requireText(a.justification,'Evidence justification');
      let bundle=w.bundles.find(b=>b.target_revision===target.id);
      if(!bundle){bundle={id:`${op}-bundle`,target_revision:target.id,mode:'joint',explanation:''};w.bundles.push(bundle);}
      w.links.push({id:`${op}-link`,source_span:span.id,target_revision:target.id,bundle_id:bundle.id,relation:a.relation,justification:a.justification,review_state:'proposed',reviewer:null,active:true});invalidate(w,target.id);break;
    }
    case 'link_edit':case 'unlink':case 'link_review': {
      const l=w.links.find(l=>l.id===a.link_id&&l.active);if(!l)throw Error('Unknown active evidence link');
      const r=revision(w,l.target_revision);editable(w,entity(w,r.entity_id));
      if(entity(w,r.entity_id).current!==r.id)throw Error('Historical evidence is immutable');
      if(command.type==='unlink')l.active=false;
      else if(command.type==='link_review'){
        await validateAnchor(w.passages.find(p=>p.revision_id===w.spans.find(s=>s.id===l.source_span)?.passage_revision),w.spans.find(s=>s.id===l.source_span));
        l.review_state='approved';l.reviewer='local-user';
      }else{if(!RELATIONS.includes(a.relation))throw Error('Unknown relation');l.relation=a.relation;l.justification=requireText(a.justification,'Justification');l.review_state='stale';l.reviewer=null;}
      invalidate(w,l.target_revision);break;
    }
    case 'bundle': {
      const r=editable(w,e),b=w.bundles.find(b=>b.target_revision===r.id);if(!b)throw Error('Attach evidence first');
      b.explanation=requireText(a.explanation,'Joint inference explanation');invalidate(w,r.id);break;
    }
    case 'review': {
      if(!e)throw Error('Unknown item');const r=revision(w,e.current);
      if(!['approved','rejected'].includes(a.decision))throw Error('Unknown review decision');
      requireText(a.notes,'Review note');
      if(a.decision==='approved'){
        if(r.kind==='conclusion'){
          const links=currentLinks(w,r.id),bundle=w.bundles.find(b=>b.target_revision===r.id);
          if(!links.some(l=>['supports','paraphrases'].includes(l.relation))||links.some(l=>l.review_state!=='approved'))throw Error('Review valid supporting evidence before approval');
          if(links.some(l=>['challenges','editorial_extrapolation'].includes(l.relation)))throw Error('Unresolved challenge or extrapolation prevents approval; resolve it explicitly');
          if(!bundle?.explanation.trim()||!r.scope.trim()||!r.practical_implication?.trim()||!r.qualifications.trim())throw Error('Scope, practical implication, qualifications and inference explanation are required');
          for(const l of links){const s=w.spans.find(s=>s.id===l.source_span);await validateAnchor(w.passages.find(p=>p.revision_id===s.passage_revision),s);}
        }else{
          if(!allGrounded(r.doc)||!r.dependencies.length||r.dependencies.some(id=>w.assessments[id]?.state!=='approved'||entity(w,revision(w,id)?.entity_id)?.current!==id))throw Error('Unsupported prose or an unapproved/stale meaning prevents expression approval');
        }
      }
      w.reviews.push({id:`${op}-review`,revision_id:r.id,decision:a.decision,notes:a.notes,reviewer:'local-user',at:command.at});w.assessments[r.id]={state:a.decision,notes:a.notes};
      for(const dep of w.revisions.filter(d=>d.dependencies.includes(r.id)))invalidate(w,dep.id);break;
    }
    case 'map_target': {
      const r=editable(w,e);if(r.kind!=='conclusion')throw Error('Map source evidence to a conclusion');
      const block=r.doc.content.find(b=>b.attrs.id===a.block_id),text=(block?.content??[]).map(n=>n.text??'').join('');
      if(!block||!Number.isInteger(a.start)||!Number.isInteger(a.end)||a.start<0||a.end<=a.start||a.end>scalarLength(text)||scalarSlice(text,a.start,a.end)!==a.exact)throw Error('Target clause does not match the saved revision');
      const available=new Set(currentLinks(w,r.id).map(l=>l.source_span));
      if(!Array.isArray(a.source_span_ids)||!a.source_span_ids.length||a.source_span_ids.some(id=>!available.has(id)))throw Error('Target mapping needs current source evidence');
      for(const sid of a.source_span_ids){const span=w.spans.find(s=>s.id===sid);await validateAnchor(w.passages.find(p=>p.revision_id===span.passage_revision),span);}
      w.target_mappings??=[];w.target_mappings.push({id:`${op}-mapping`,target_revision:r.id,block_id:a.block_id,start:a.start,end:a.end,exact:a.exact,source_span_ids:[...new Set(a.source_span_ids)],granularity:a.granularity==='whole_statement'?'whole_statement':'clause',justification:requireText(a.justification,'Mapping justification'),active:true});invalidate(w,r.id);break;
    }
    case 'lock':if(!e)throw Error('Unknown item');e.locked=!!a.locked;break;
    case 'preference':if(!w.passages.some(p=>p.id===a.passage_id))throw Error('Unknown passage');w.preferences[a.passage_id]={...(w.preferences[a.passage_id]??{}),...a.preference};break;
    default:throw Error('Unknown command');
  }
  w.version++;w.events.push({id:op,type:command.type,at:command.at,entity_id:a.entity_id??null});return w;
}

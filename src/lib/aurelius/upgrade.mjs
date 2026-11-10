/** Add new original examples without changing user work, reviewed revisions or old seed records. */
export function upgradeFixture(input,seed){
  if(input.corpus_kind!=='synthetic'||seed.corpus_kind!=='synthetic')throw Error('Fixture upgrades cannot touch a real corpus');
  if((input.fixture_revision??1)>=(seed.fixture_revision??1))return input;
  const w=structuredClone(input);
  for(const key of ['editions','passages','spans','conclusions','expressions','revisions','bundles','links','concepts','memberships','target_mappings']){
    w[key]??=[];const existing=new Map(w[key].map(item=>[item.id,item]));
    for(const item of seed[key]??[]){
      const prior=existing.get(item.id);
      if(prior){if(key==='passages'&&(prior.revision_id!==item.revision_id||prior.text_hash!==item.text_hash))throw Error('Fixture source identity conflict; existing source preserved');continue;}
      w[key].push(structuredClone(item));existing.set(item.id,item);
    }
  }
  for(const [id,assessment] of Object.entries(seed.assessments))if(!w.assessments[id])w.assessments[id]=structuredClone(assessment);
  w.fixture_revision=seed.fixture_revision;w.version++;
  w.events.push({id:`fixture-upgrade-${seed.fixture_revision}`,type:'fixture_upgrade',at:'2026-11-10T00:00:00Z',entity_id:null});return w;
}

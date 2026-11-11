"""Small, edition-specific manual pilot; every interpretation remains unreviewed."""
from copy import deepcopy


def extend_book_study(workspace, corpus):
    # Casaubon's numbered divisions and wording are not silently applied to Hays.
    if corpus['corpus_kind'] != 'public_domain_backup':
        return workspace
    from .study import doc

    w = workspace
    prefix = corpus['editions'][0]['id']
    refs = [('8', '12'), ('9', '13'), ('5', '16'), ('5', '20')]
    passages = {ref: next(p for p in corpus['passages'] if (p['book'], p['section']) == ref) for ref in refs}
    for passage in passages.values():
        if not any(p['id'] == passage['id'] for p in w['passages']):
            w['passages'].append(deepcopy(passage))

    # Use exact stored text, including original whitespace, with validated boundaries.
    anchors = {
        'examine': (('8', '12'), 'As every fancy', None),
        'verdict': (('9', '13'), 'The things themselves', None),
        'opinion': (('5', '16'), 'As for the things themselves', None),
        'feeling': (('5', '20'), 'But if at any time', None),
    }
    spans = {}
    for name, (ref, start_text, end_text) in anchors.items():
        p = passages[ref]; start = p['text'].index(start_text)
        end = p['text'].index(end_text, start) if end_text else len(p['text'])
        while end > start and p['text'][end - 1].isspace():
            end -= 1
        sid = f'{prefix}-judgment-{name}'; spans[name] = sid
        w['spans'].append({'id':sid, 'passage_revision':p['revision_id'], 'start':start, 'end':end,
                           'exact':p['text'][start:end], 'prefix':p['text'][max(0,start-32):start],
                           'suffix':p['text'][end:end+32], 'text_hash':p['text_hash'], 'validation':'valid'})

    def add(key, title, sentences, expression_parts, scope, bridge, limits, arguments):
        cid=f'{prefix}-{key}'; rid=f'{cid}:r1'; block=f'{cid}-meaning-block'; bundle=f'{cid}-bundle'
        statement=' '.join(text for text,_ in sentences)
        premises=[{'claim':summary,'source_span_ids':[spans[name]]} for name,_,summary,_ in arguments]
        notes={'method':'manual_editorial_study','meaning_revision':rid,'premises':premises,
               'interpretive_step':bridge,'what_changes':'The connection between these separate passages is an editorial reconstruction.',
               'not_claimed':limits,'expression_choice':'The explanation distinguishes Marcus’s reasons from the editorial connection.'}
        meaning={'id':rid,'entity_id':cid,'kind':'conclusion','sequence':1,'text':statement,'doc':doc(statement,block),
                 'scope':scope,'qualifications':limits,'assumptions':bridge,'practical_implication':bridge,
                 'interpretation':'multi_passage_synthesis','dependencies':[],'created_at':'2026-11-10T00:00:00Z','synthesis':notes}
        w['conclusions'].insert(0,{'id':cid,'title':title,'current':rid,'locked':False})
        w['revisions'].append(meaning)
        w['assessments'][rid]={'state':'awaiting_review','notes':'Hand-authored interpretation and bridge require human review; no approval is seeded.'}
        w['bundles'].append({'id':bundle,'target_revision':rid,'mode':'joint','explanation':bridge})
        for i,(name,kind,summary,qualification) in enumerate(arguments):
            sid=spans[name]
            w['links'].append({'id':f'{cid}-link-{i}','source_span':sid,'target_revision':rid,'bundle_id':bundle,'relation':'supports','justification':summary,'review_state':'proposed','reviewer':None,'active':True})
            w['propositions'].append({'id':f'{cid}-proposition-{i}','revision_id':f'{cid}-proposition-{i}:r1','statement':summary,'source_span_ids':[sid],'scope':scope,'modality':'proposed source interpretation','status':'proposed'})
            w['source_arguments'].append({'id':f'{cid}-reason-{i}','revision_id':f'{cid}-reason-{i}:r1','target_revision':rid,'kind':kind,'summary':summary,'source_span_ids':[sid],'limits':qualification,'status':'proposed'})
        for i,(text,names) in enumerate(sentences):
            start=statement.index(text)
            w['target_mappings'].append({'id':f'{cid}-clause-{i}','target_revision':rid,'block_id':block,'start':start,'end':start+len(text),'exact':text,'source_span_ids':[spans[n] for n in names],'granularity':'clause','justification':bridge,'active':True})
        eid=f'{cid}-expression'; expression=deepcopy(meaning)
        expression.update(id=f'{eid}:r1',entity_id=eid,kind='expression',text=''.join(text for text,_ in expression_parts),dependencies=[rid],
            doc={'type':'doc','content':[{'type':'paragraph','attrs':{'id':f'{eid}-block'},'content':[{'type':'text','text':text,'marks':[{'type':'grounding','attrs':{'conclusionRevision':rid,'sourceSpanIds':[spans[n] for n in names],'state':'proposed'}}]} for text,names in expression_parts]}]})
        expression.pop('synthesis')
        w['expressions'].insert(0,{'id':eid,'title':'Explanation with source reasons','current':expression['id'],'locked':False})
        w['revisions'].append(expression)
        w['assessments'][expression['id']]={'state':'awaiting_review','notes':'Editorial explanation, not a quotation; review its reasoning and limits.'}
        return cid

    distress=add('distress-and-threat','When an impression brings distress or threat',[
        ('When a distressing impression arises, examine it before treating its judgment as settled.', ['examine','opinion']),
        ('Recognize bodily feeling as natural rather than assuming that examination erases it.', ['feeling'])], [
        ('Marcus asks us to examine an impression, and holds that the mind’s opinions shape its response to events. ',['examine','opinion']),
        ('Read together, these suggest pausing over the judgment attached to a frightening impression. ',['examine','opinion']),
        ('He also says bodily sensations naturally reach the mind; the exercise is not a denial that pain is felt.', ['feeling'])],
        'A proposed response to distressing or threatening impressions, including bodily pain.',
        'The application to a frightening impression connects the instruction to examine appearances with Marcus’s account of opinion and feeling; it is an editorial bridge, not a single source argument.',
        'Marcus’s account of the mind and its power over distress is a philosophical claim, not proof that distress is voluntary or easily stopped. This is not a reason to ignore danger, pain, or needed care.', [
        ('examine','reason_not_stated','Marcus asks the reader to examine each impression where possible.','The brief instruction does not itself explain how to evaluate a threat.'),
        ('opinion','explicit_reason','Marcus argues that external things do not themselves move the soul, which responds according to its opinions.','This rests on his theory of the soul; it does not establish a clinical account of distress.'),
        ('feeling','explicit_reason','Marcus says feeling naturally reaches the mind in a united body, while distinguishing it from an added judgment of good or bad.','This distinction does not show that pain or fear can always be removed by judgment.')])
    ordinary=add('ordinary-impressions','Examine an ordinary impression',[
        ('Consider an impression and its qualities before accepting the judgment it suggests.', ['examine']),
        ('The understanding supplies a verdict about things outside it.', ['verdict'])], [
        ('Marcus tells himself to examine each impression, if possible, and reason about its nature. ',['examine']),
        ('He also distinguishes external things from the understanding that gives a verdict on them. ',['verdict']),
        ('Taken together, these passages suggest making the judgment visible for examination rather than letting the first appearance settle it.', ['examine','verdict'])],
        'Ordinary impressions and the judgments attached to them.',
        'The instruction to examine an impression and the account of judgment are read together as an editorial practice; neither passage states this combined procedure.',
        'Not every impression can be examined at leisure, and the passages give no complete method for deciding which judgment is correct. External facts still matter.', [
        ('examine','reason_not_stated','Marcus advises examining the nature and qualities of an impression, if possible.','The short instruction does not give a detailed procedure or its full justification.'),
        ('verdict','explicit_reason','Marcus distinguishes things outside from the understanding that passes judgment on them.','His division between things and judgment is a philosophical account, not a claim that external events have no effects.')])

    # Directive voice is a separately reviewed variant, never a Marcus quotation.
    for cid, parts in [
        (ordinary,[('When you can, examine what appears before you. ',['examine']),
                   ('Do not let the first appearance settle your judgment: the thing before you and the verdict you give it are not the same.', ['examine','verdict'])]),
        (distress,[('When an impression frightens you, examine the judgment within it where you can. ',['examine','opinion']),
                   ('Pain may still be felt. Do not mistake that feeling for a settled verdict on what is good or bad.', ['feeling'])]),
    ]:
        rid=f'{cid}:r1';eid=f'{cid}-constitution-voice'
        expression=deepcopy(next(r for r in w['revisions'] if r['id']==rid))
        expression.pop('synthesis')
        expression.update(id=f'{eid}:r1',entity_id=eid,kind='expression',dependencies=[rid],text=''.join(t for t,_ in parts),
            doc={'type':'doc','content':[{'type':'paragraph','attrs':{'id':f'{eid}-block'},'content':[{'type':'text','text':t,'marks':[{'type':'grounding','attrs':{'conclusionRevision':rid,'sourceSpanIds':[spans[n] for n in names],'state':'proposed'}}]} for t,names in parts]}]})
        w['revisions'].append(expression)
        w['expressions'].insert(0,{'id':eid,'title':'Personal constitution formulation','current':expression['id'],'locked':False})
        w['assessments'][expression['id']]={'state':'awaiting_review','notes':'Firm editorial voice; not Marcus’s words. Review scope, qualifications and fidelity independently of resonance.'}

    attention=f'{prefix}-attention-theme'; adversity=f'{prefix}-adversity-theme'
    w['concepts'].extend([
        {'id':attention,'name':'Judgment and attention','definition':'Examining impressions and the judgments attached to them.','inclusion':'An impression, assessment or exercise of attention.','exclusion':'A shared word alone is not evidence.','parents':[]},
        {'id':adversity,'name':'Distress and adversity','definition':'Responses to pain, distress and difficult events.','inclusion':'A claim about feelings or responses to adversity.','exclusion':'Not a substitute for safety or care.','parents':[]},
    ])
    for ref,concepts in [(('8','12'),[attention,adversity]),(('9','13'),[attention]),(('5','16'),[attention,adversity]),(('5','20'),[attention,adversity])]:
        for concept in concepts:
            p=passages[ref]
            w['memberships'].append({'id':f'{prefix}-judgment-membership-{ref[0]}-{ref[1]}-{concept.rsplit("-",2)[-2]}','passage_id':p['id'],'concept_id':concept,'rationale':'Proposed topical association; evidence is linked separately.','review_state':'proposed'})
    w['study_revision']=3
    w['study_catalog']['current_ids']=[ordinary,distress]+w['study_catalog']['current_ids']
    w['study_catalog']['default_id']=ordinary
    return w

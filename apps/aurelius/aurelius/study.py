"""A hand-authored, unapproved editorial study; not an unattended model result."""
from copy import deepcopy
from .importer import PARSER_VERSION

STATEMENT = 'Another person’s ingratitude does not release you from the work of cooperation. Respond without reproducing their wrongdoing; judge your response by what it contributes to shared life, rather than by the repayment it wins.'
EXPRESSION = 'Do not let another person’s failure decide the kind of person your next act makes you. Give what serves the shared life without turning generosity into a debt, or making a second wrong your answer to the first.'


def doc(text, block, marks=None):
    return {'type':'doc','content':[{'type':'paragraph','attrs':{'id':block},'content':[{'type':'text','text':text,**({'marks':marks} if marks else {})}]}]}


def legacy_manual_study(corpus, file_hash, public_slice=False):
    if public_slice and corpus['corpus_kind'] != 'public_domain_backup':
        raise ValueError('The modern translation cannot be bundled as a public study')
    source_refs = [('5','6'),('6','6'),('6','54')] if corpus['corpus_kind']=='hays' else [('5','6'),('6','5'),('6','49')]
    selected = [next(p for p in corpus['passages'] if (p['book'],p['section'])==ref) for ref in source_refs]
    prefix = corpus['editions'][0]['id']
    conclusion_id, expression_id = f'{prefix}-cooperation', f'{prefix}-cooperation-expression'
    rid, eid, uid = f'{conclusion_id}:r1', f'{expression_id}:r1', f'{expression_id}:overreach-r1'
    span_ids = [f'{prefix}-evidence-{i}' for i in range(3)]
    spans = [{'id': sid, 'passage_revision':p['revision_id'], 'start':0, 'end':len(p['text']), 'exact':p['text'], 'prefix':'', 'suffix':'', 'text_hash':p['text_hash'], 'validation':'valid'} for sid,p in zip(span_ids,selected)]
    premises = [
        {'claim':'A good turn need not leave the recipient in your debt; the reminder still concerns conscious social action.', 'source_span_ids':[span_ids[0]]},
        {'claim':'The reply to wrongdoing should not reproduce the wrongdoer’s character.', 'source_span_ids':[span_ids[1]]},
        {'claim':'The individual’s good is connected to the shared community’s good.', 'source_span_ids':[span_ids[2]]}]
    notes = {'method':'manual_editorial_study', 'meaning_revision':rid, 'premises':premises,
             'interpretive_step':'The first passage removes repayment as the criterion of a good action. The second places a limit on a retaliatory response. The third supplies a social criterion. Together they suggest how to choose the next action after ingratitude: cooperation without imitation of wrongdoing.',
             'what_changes':'Three separate reminders become one decision rule for a particular recurring situation. The sources do not themselves state this combined rule; that bridge is an editorial synthesis.',
             'not_claimed':'This does not establish that every favor serves the common good, that harm must be endured, or that one must keep helping a dangerous person. These passages do not supply a complete rule for setting boundaries.',
             'expression_choice':'“The kind of person your next act makes you” translates the response constraint into a question of character. It is editorial wording, not a quotation. The maxim is judged separately from fidelity.'}
    meaning = {'id':rid,'entity_id':conclusion_id,'kind':'conclusion','sequence':1,'text':STATEMENT,'doc':doc(STATEMENT,f'{prefix}-meaning-block'),
               'scope':'Choosing a response after an unacknowledged favor or another person’s wrongdoing; a three-passage interpretation, not a rule about every conflict.',
               'qualifications':notes['not_claimed'], 'assumptions':'Joins the no-repayment reminder, the non-imitation constraint and the hive analogy into one criterion for responding. No individual excerpt independently proves the whole conclusion.',
               'practical_implication':'Separate the wish to be repaid from what fair cooperation now requires. Concrete safety or boundary-setting tactics would be labeled modern applications and need their own review.',
               'interpretation':'multi_passage_synthesis','dependencies':[],'created_at':'2026-11-10T00:00:00Z','synthesis':notes}
    expression = {'id':eid,'entity_id':expression_id,'kind':'expression','sequence':1,'text':EXPRESSION,
                  'doc':doc(EXPRESSION,f'{prefix}-expression-block',[{'type':'grounding','attrs':{'conclusionRevision':rid,'sourceSpanIds':span_ids,'state':'proposed'}}]),
                  'scope':meaning['scope'],'qualifications':meaning['qualifications'],'assumptions':'Reader-facing editorial variant; not attributed as Marcus’s words.',
                  'practical_implication':meaning['practical_implication'],'interpretation':'multi_passage_synthesis','dependencies':[rid],'created_at':'2026-11-10T00:00:00Z'}
    overreach = {**deepcopy(expression),'id':uid,'entity_id':f'{expression_id}-overreach','text':'Keep helping everyone forever, and nobody can ever harm you.', 'doc':doc('Keep helping everyone forever, and nobody can ever harm you.',f'{prefix}-overreach-block')}
    reason_specs = [
        ('explicit_reason','Marcus accepts that rational, social beings should understand their social action, while disputing the move from that awareness to treating a good turn as a debt.',[span_ids[0]],'This is an objection-and-reply. His assent to conscious social action is not agreement with every part of the objection about recognition.'),
        ('analogy','The vine bearing fruit explains the proposed attitude toward helping: perform the social function and continue, without making repayment what completes the act.',[span_ids[0]],'This is an analogy and a functional view of human nature, not a demonstrated law about every practical situation.'),
        ('reason_not_stated','The revenge reminder directs the response away from imitation, but this short cited passage does not explain why that is the best revenge.',[span_ids[1]],'No additional justification is attributed to Marcus here. A further reason would need another cited passage or an explicit editorial label.'),
        ('analogy','The bee/hive comparison presents individual and shared good as connected.',[span_ids[2]],'The line supplies an analogy, not an argument that every demand by a community is just.')]
    arguments = [{'id':f'{prefix}-source-reason-{i}','revision_id':f'{prefix}-source-reason-{i}:r1','target_revision':rid,'kind':kind,'summary':summary,'source_span_ids':sources,'limits':limits,'status':'proposed'} for i,(kind,summary,sources,limits) in enumerate(reason_specs)]
    why_text = 'A good act need not wait for gratitude to become worthwhile. Marcus’s vine image treats helping as the fulfillment of a social function, rather than a loan awaiting repayment. Read alongside the hive analogy and the instruction not to imitate wrongdoing, this suggests a practical test: what response serves our shared life without reproducing the wrong?'
    why_id=f'{prefix}-cooperation-explanation'
    why_expression={**deepcopy(expression),'id':f'{why_id}:r1','entity_id':why_id,'text':why_text,'doc':doc(why_text,f'{prefix}-explanation-block',[{'type':'grounding','attrs':{'conclusionRevision':rid,'sourceSpanIds':span_ids,'state':'proposed'}}]),'assumptions':'The functional analogy belongs to the source; the combined practical test is an explicitly signaled editorial inference.'}
    bundle_id = f'{prefix}-cooperation-bundle'
    links = [{'id':f'{prefix}-link-{i}','source_span':sid,'target_revision':rid,'bundle_id':bundle_id,'relation':'supports' if i!=1 else 'qualifies','justification':premises[i]['claim'],'review_state':'proposed','reviewer':None,'active':True} for i,sid in enumerate(span_ids)]
    clauses = [('Another person’s ingratitude does not release you from the work of cooperation.',[span_ids[0],span_ids[2]]),('Respond without reproducing their wrongdoing;',[span_ids[1]]),('judge your response by what it contributes to shared life, rather than by the repayment it wins.',[span_ids[0],span_ids[2]])]
    mappings = [{'id':f'{prefix}-clause-{i}','target_revision':rid,'block_id':f'{prefix}-meaning-block','start':STATEMENT.index(text),'end':STATEMENT.index(text)+len(text),'exact':text,'source_span_ids':sources,'granularity':'clause','justification':notes['interpretive_step'],'active':True} for i,(text,sources) in enumerate(clauses)]
    edition = {**corpus['editions'][0],'edition':'2002 ebook, user-supplied OCR' if corpus['corpus_kind']=='hays' else 'Project Gutenberg 2680; Casaubon translation',
               'acquisition_status':'Private parsed candidate; import review pending' if corpus['corpus_kind']=='hays' else 'User-selected public-domain backup study',
               'available_format':'UTF-8 plain text','importability':'Exact numbered text parsed; edition-specific divisions retained','file_hash':file_hash,'parser_version':PARSER_VERSION}
    return {'schema_version':1,'fixture_revision':0,'study_revision':1,'source_arguments':arguments,'version':0,'corpus_kind':corpus['corpus_kind'], 'offset_convention':'unicode-scalar-half-open-v1',
            'editions':[edition],'passages':deepcopy(selected if public_slice else corpus['passages']),'spans':spans,
            'conclusions':[{'id':conclusion_id,'title':'Cooperate without becoming a creditor or an imitator','current':rid,'locked':False}],
            'expressions':[{'id':expression_id,'title':'Character in the next act','current':eid,'locked':False},{'id':f'{expression_id}-overreach','title':'Deliberate unsupported addition','current':uid,'locked':False},{'id':why_id,'title':'Explanation with source reasons','current':f'{why_id}:r1','locked':False}],
            'revisions':[meaning,expression,overreach,why_expression],'bundles':[{'id':bundle_id,'target_revision':rid,'mode':'joint','explanation':notes['interpretive_step']}],
            'links':links,'target_mappings':mappings,'assessments':{rid:{'state':'awaiting_review','notes':'Manual editorial proposal. Review the premises and interpretive bridge; no approval is seeded.'},eid:{'state':'awaiting_review','notes':'Expression needs separate fidelity review and a human clarity/resonance judgment.'},uid:{'state':'unsupported','notes':'Introduces unlimited obligation and invulnerability; neither is supported.'},f'{why_id}:r1':{'state':'awaiting_review','notes':'Check the source reasoning separately from the combined editorial decision rule.'}},
            'concepts':[{'id':f'{prefix}-social-conduct','name':'Reciprocity, character and common good','definition':'How social duty and the quality of a response constrain each other.','inclusion':'A claim about repayment, response or shared good.','exclusion':'Shared vocabulary alone is not evidence.','parents':[]}],
            'memberships':[{'id':f'{prefix}-membership-{i}','passage_id':p['id'],'concept_id':f'{prefix}-social-conduct','rationale':'Topical association; evidential role is stored separately.','review_state':'proposed'} for i,p in enumerate(selected)],
            'propositions':[{'id':f'{prefix}-proposition-{i}','revision_id':f'{prefix}-proposition-{i}:r1','statement':premise['claim'],'source_span_ids':premise['source_span_ids'],'scope':meaning['scope'],'modality':'editorial extraction of a recommendation/analogy','status':'proposed'} for i,premise in enumerate(premises)],
            'preferences':{},'reviews':[],'events':[]}


def manual_study(corpus, file_hash, public_slice=False):
    """Keep the first proposal inspectable; add narrower, separately supported studies."""
    import re
    w = legacy_manual_study(corpus, file_hash, public_slice)
    prefix = corpus['editions'][0]['id']
    fellow_ref = ('2', '1') if corpus['corpus_kind']=='hays' else ('1', '15')
    fellow = next(p for p in corpus['passages'] if (p['book'],p['section'])==fellow_ref)
    generosity = next(p for p in w['passages'] if (p['book'],p['section'])==('5','6'))
    if not any(p['id']==fellow['id'] for p in w['passages']):
        w['passages'].append(deepcopy(fellow))

    def excerpt(p, name, pattern=None, end_pattern=None):
        text=p['text']; match=re.search(pattern,text,re.I) if pattern else None
        if pattern and not match: raise ValueError(f'Exact evidence boundary missing: {name}')
        start=match.start() if match else 0
        ending=re.search(end_pattern,text[start:],re.I) if end_pattern else None
        if end_pattern and not ending: raise ValueError(f'Exact evidence boundary missing: {name}')
        end=start+ending.start() if ending else len(text)
        while end>start and text[end-1].isspace():end-=1
        sid=f'{prefix}-focused-{name}'
        w['spans'].append({'id':sid,'passage_revision':p['revision_id'],'start':start,'end':end,'exact':text[start:end],
                          'prefix':text[max(0,start-32):start],'suffix':text[end:end+32],'text_hash':p['text_hash'],'validation':'valid'})
        return sid

    fellow_span=excerpt(fellow,'fellow-workers',r'We were born' if corpus['corpus_kind']=='hays' else r'for we are all born')
    # Read against the entire source context; the shorter colored span is the actual premise.
    vine=excerpt(generosity,'vine',r'But others' if corpus['corpus_kind']=='hays' else r'Others again',
                 r'—Yes\.' if corpus['corpus_kind']=='hays' else r"'Nay but,'")
    objection=excerpt(generosity,'objection',r'—Yes\.' if corpus['corpus_kind']=='hays' else r"'Nay but,'")
    legacy_ids=[c['id'] for c in w['conclusions']]
    new_conclusions=[];new_expressions=[]

    def add_study(key,title,statement,formulation,scope,premises,bridge,addition,limits,why,reason_specs,clauses,interpretation='multi_passage_synthesis'):
        cid=f'{prefix}-{key}';rid=f'{cid}:r1';block=f'{cid}-meaning-block';bundle=f'{cid}-bundle'
        notes={'method':'manual_editorial_study','meaning_revision':rid,'premises':[{'claim':claim,'source_span_ids':ids} for claim,ids,_ in premises],
               'interpretive_step':bridge,'what_changes':addition,'not_claimed':limits,'expression_choice':why}
        meaning={'id':rid,'entity_id':cid,'kind':'conclusion','sequence':1,'text':statement,'doc':doc(statement,block),
                 'scope':scope,'qualifications':limits,'assumptions':bridge,'practical_implication':addition,
                 'interpretation':interpretation,'dependencies':[],'created_at':'2026-11-10T00:00:00Z','synthesis':notes}
        w['revisions'].append(meaning);new_conclusions.append({'id':cid,'title':title,'current':rid,'locked':False})
        w['assessments'][rid]={'state':'awaiting_review','notes':'Revised hand-authored proposal. Exact anchors are validated; philosophical fidelity still needs human review.'}
        w['bundles'].append({'id':bundle,'target_revision':rid,'mode':'joint' if len(premises)>1 else 'independent','explanation':bridge})
        for i,(claim,ids,relation) in enumerate(premises):
            for j,sid in enumerate(ids):
                w['links'].append({'id':f'{cid}-link-{i}-{j}','source_span':sid,'target_revision':rid,'bundle_id':bundle,'relation':relation,'justification':claim,'review_state':'proposed','reviewer':None,'active':True})
            w['propositions'].append({'id':f'{cid}-proposition-{i}','revision_id':f'{cid}-proposition-{i}:r1','statement':claim,'source_span_ids':ids,'scope':scope,'modality':'proposed source interpretation','status':'proposed'})
        for i,(kind,summary,ids,qualification) in enumerate(reason_specs):
            w['source_arguments'].append({'id':f'{cid}-reason-{i}','revision_id':f'{cid}-reason-{i}:r1','target_revision':rid,'kind':kind,'summary':summary,'source_span_ids':ids,'limits':qualification,'status':'proposed'})
        for i,(text,ids) in enumerate(clauses):
            start=statement.index(text)
            w['target_mappings'].append({'id':f'{cid}-clause-{i}','target_revision':rid,'block_id':block,'start':start,'end':start+len(text),'exact':text,'source_span_ids':ids,'granularity':'clause','justification':bridge,'active':True})
        # Separate sentences receive only their own contributor sets, rather than an all-source wash.
        eid=f'{cid}-expression';segments=[]
        for text,ids in formulation:
            segments.append({'type':'text','text':text,'marks':[{'type':'grounding','attrs':{'conclusionRevision':rid,'sourceSpanIds':ids,'state':'proposed'}}]})
        expression={**deepcopy(meaning),'id':f'{eid}:r1','entity_id':eid,'kind':'expression','text':''.join(text for text,_ in formulation),
                    'doc':{'type':'doc','content':[{'type':'paragraph','attrs':{'id':f'{eid}-block'},'content':segments}]},'dependencies':[rid]}
        expression.pop('synthesis')
        w['revisions'].append(expression);new_expressions.append({'id':eid,'title':'Explanation with source reasons','current':expression['id'],'locked':False})
        w['assessments'][expression['id']]={'state':'awaiting_review','notes':'Editorial wording, not a Marcus quotation. Check each clause and the stated limits separately.'}
        return cid,rid,eid

    first='Cooperation belongs to our nature as fellow-workers.'
    second='A good turn fulfills that social work; it need not leave its recipient in our debt.'
    third='This is not a demand for mindless action: Marcus retains conscious social action while challenging the wish to keep a moral account.'
    main=add_study('social-purpose','Cooperation without a debt',f'{first} {second} {third}',[
        ('Cooperation is part of what Marcus thinks a human being is for. ',[fellow_span]),
        ('A vine completes its work by bearing fruit, not by collecting thanks; his image asks us to see a good act in that spirit. ',[vine]),
        ('Read together, these passages make gratitude a possible response to kindness, rather than the payment that completes it. ',[fellow_span,vine]),
        ('The objection about rational awareness remains: acting without keeping score need not mean acting without understanding.',[objection])],
        'The motivation and self-understanding of social action, especially after an unacknowledged good turn.',[
            ('People are fellow-workers by nature; Marcus illustrates this with parts of a body working together.',[fellow_span],'supports'),
            ('The vine comparison presents a good act as the exercise of a natural function, without a further claim for repayment.',[vine],'supports'),
            ('The objection-and-reply prevents reading the image as a demand for unconscious or thoughtless helping.',[objection],'qualifies')],
        'The fellow-worker passage supplies the social-purpose premise. The vine passage applies a functional comparison to giving. Together they support a reason not to make repayment the completion of a good act. Neither revenge nor the hive aphorism is needed for this inference.',
        'The passages do not themselves state this combined explanation. The reconstruction connects a reason for cooperation to an attitude toward doing good, while keeping the rational-awareness qualification.',
        'Marcus’s account relies on a normative view of human nature and, in the surrounding fellow-worker passage, shared reason and the divine. The analogy does not prove that every request deserves help, or that one must keep helping a dangerous person. It is not a universal rule about boundaries.',
        'The expression explains the social-purpose premise and the vine comparison before giving the editorial connection. It does not add revenge as a second conclusion.',[
            ('explicit_reason','Marcus treats human beings as fellow-workers by nature. This supplies a reason for cooperation, rather than merely an instruction to be helpful.',[fellow_span],'The surrounding passage invokes shared reason and a share in the divine. This is his philosophical premise, not an empirically established biological law.'),
            ('analogy','The vine’s fruit illustrates a good act fulfilling its function without an extra reward being owed.',[vine],'A functional analogy motivates the attitude. It does not establish that every favor is wise or owed.'),
            ('explicit_reason','The objection-and-reply retains the importance of knowing that one acts socially; the criticism concerns how that awareness is understood.',[objection],'Marcus disputes a probable appearance of reason. His assent is not agreement with every demand for the recipient’s recognition.')],
        [(first,[fellow_span]),(second,[fellow_span,vine]),(third,[objection])])
    revenge=w['spans'][1]['id'];hive=w['spans'][2]['id']
    revenge_text='When answering wrongdoing, do not make the wrongdoer’s character your model.'
    add_study('non-imitation','Answer wrongdoing without imitation',revenge_text,[(
        'An injury does not provide a model for your next act. Marcus calls refusing that imitation the best revenge; this brief passage gives no further argument for the ranking.',[revenge])],
        'A reminder about responding to wrongdoing, not a general instruction about giving or communal duty.',[
            ('The brief prescription identifies non-imitation as the best revenge.',[revenge],'supports')],
        'This is a close paraphrase of a single prescription. It does not derive an obligation to help the offender.',
        'A response can be assessed for imitation of the wrongdoer without making this passage support a theory of gratitude.',
        'The aphorism does not define every forbidden response or supply a complete account of punishment, protection or reconciliation.',
        'The explanation keeps the absence of an argument visible, instead of borrowing the vine or hive as if Marcus supplied them here.',[
            ('reason_not_stated','Marcus calls non-imitation the best revenge, but this cited sentence does not explain why it is best.',[revenge],'A further reason requires further evidence. It is not silently supplied by nearby social-duty passages.')],
        [(revenge_text,[revenge])],interpretation='close_paraphrase')
    hive_text='Marcus treats the individual’s good as connected to the good of the community to which the individual belongs.'
    add_study('shared-good','The part and the shared good',hive_text,[(
        'A bee’s good cannot be severed from its hive’s good: this is Marcus’s image of part and whole. It leaves open how the common good is identified, and who may claim to speak for it.',[hive])],
        'The relationship between individual and shared good, expressed through an analogy.',[
            ('The bee/hive comparison connects the good of the part to that of its whole.',[hive],'supports')],
        'The interpretation reads the bee/hive comparison as an analogy of membership. Its application to every political demand would be a further inference.',
        'The question becomes whether an alleged individual benefit undermines the shared whole, rather than whether an individual must repay a favor.',
        'The line does not demonstrate that every collective demand is just, or explain how to resolve a disagreement about the community’s good.',
        'The formulation keeps the analogy and its unanswered question together; it does not turn the line into a slogan for unconditional obedience.',[
            ('analogy','The bee depends on a hive; Marcus uses their linked good to express the relation between a part and its whole.',[hive],'The comparison alone supplies no procedure for deciding which institution or demand represents the common good.')],
        [(hive_text,[hive])],interpretation='close_paraphrase')
    # A new unsupported variant targets the new meaning, while the old one stays in history.
    unsupported_id=f'{prefix}-social-purpose-overreach';text='Always help everyone, without thought or boundaries, and expect no harm.'
    template=deepcopy(next(r for r in w['revisions'] if r['entity_id']==main[2]))
    template.update(id=f'{unsupported_id}:r1',entity_id=unsupported_id,text=text,doc=doc(text,f'{unsupported_id}-block'))
    w['revisions'].append(template);new_expressions.insert(1,{'id':unsupported_id,'title':'Deliberate unsupported addition','current':template['id'],'locked':False})
    w['assessments'][template['id']]={'state':'unsupported','notes':'Adds universal obligation, thoughtlessness and invulnerability; no mapped support.'}
    maxim_id=f'{prefix}-social-purpose-maxim'
    maxim=deepcopy(next(r for r in w['revisions'] if r['entity_id']==main[2]))
    parts=[('Cooperate because you are a fellow-worker. ',[fellow_span]),('Let a good act bear its fruit without leaving a debt behind.',[vine])]
    maxim.update(id=f'{maxim_id}:r1',entity_id=maxim_id,text=''.join(t for t,_ in parts),
                 doc={'type':'doc','content':[{'type':'paragraph','attrs':{'id':f'{maxim_id}-block'},'content':[{'type':'text','text':t,'marks':[{'type':'grounding','attrs':{'conclusionRevision':main[1],'sourceSpanIds':ids,'state':'proposed'}}]} for t,ids in parts]}]})
    w['revisions'].append(maxim);new_expressions.insert(2,{'id':maxim_id,'title':'Concise formulation','current':maxim['id'],'locked':False})
    w['assessments'][maxim['id']]={'state':'awaiting_review','notes':'An editorial maxim, not a quotation. The longer explanation retains the functional premise and conscious-action qualification.'}
    w['conclusions']=new_conclusions+w['conclusions'];w['expressions']=new_expressions+w['expressions']
    w['study_revision']=2
    w['study_catalog']={'default_id':main[0],'current_ids':[c['id'] for c in new_conclusions],'previous_ids':legacy_ids,
                        'revision_note':'The first proposal forced reciprocity, revenge and common good into one rule. It is retained for comparison; the revised studies separate their evidential roles.'}
    w['concepts'].extend([{'id':f'{prefix}-social-purpose-theme','name':'Social purpose and giving','definition':'Cooperation as a natural function and the motivation of a good turn.','inclusion':'A claim about cooperation, giving or conscious social action.','exclusion':'Revenge and shared-good analogies need their own evidential roles.','parents':[]}])
    w['memberships'].append({'id':f'{prefix}-fellow-membership','passage_id':fellow['id'],'concept_id':f'{prefix}-social-purpose-theme','rationale':'Source premise about cooperation.','review_state':'proposed'})
    from .book_study import extend_book_study
    return extend_book_study(w, corpus)

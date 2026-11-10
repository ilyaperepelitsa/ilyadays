"""A hand-authored, unapproved editorial study; not an unattended model result."""
from copy import deepcopy
from .importer import PARSER_VERSION

STATEMENT = 'Another person’s ingratitude does not release you from the work of cooperation. Respond without reproducing their wrongdoing; judge your response by what it contributes to shared life, rather than by the repayment it wins.'
EXPRESSION = 'Do not let another person’s failure decide the kind of person your next act makes you. Give what serves the shared life without turning generosity into a debt, or making a second wrong your answer to the first.'


def doc(text, block, marks=None):
    return {'type':'doc','content':[{'type':'paragraph','attrs':{'id':block},'content':[{'type':'text','text':text,**({'marks':marks} if marks else {})}]}]}


def manual_study(corpus, file_hash, public_slice=False):
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

"""The acceptance gates (scripts/aurelius-qa.py) pass the real articles and catch each known fault.

Every fault below is one that happened, or that the plan names as a risk: a fused claim that paraphrases one passage,
an archaic form, a straight quote, a Seneca clause that does not continue its sentence, a limiting clause that does
not come from a qualified item, a missing audit part, a Latin letter typed inside Greek (seen from the API on
23 Nov 2026), a statement that repeats another article."""
import copy
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('qa', ROOT / 'scripts/aurelius-qa.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
RECORD = json.loads((ROOT / 'content/aurelius/constitution.json').read_text())
GOOD_AUDIT = '## (a) For the owner\n…\n## (b) Words two passages share\n…\n## (c) 4 of 12 components\n## (d) Near Article 3\n## (e) Seneca: 5 read, 2 used'


def article(n=6):
    return copy.deepcopy(next(a for a in RECORD['articles'] if a['number'] == n))


def rules(found, level='BLOCKING'):
    return {f['rule'] for f in found if f['level'] == level}


def test_every_article_in_the_record_passes():
    for a in RECORD['articles']:
        assert not rules(qa.check_article(a, RECORD['articles'])), a['number']


def test_a_clean_article_with_its_audit_passes():
    assert not rules(qa.check_article(article(), RECORD['articles'], GOOD_AUDIT, with_audit=True))


def test_a_claim_backed_by_one_passage_is_not_a_fusion():
    a = article()
    claim = a['claims'][0]
    first = claim['support'][0]['id'].rstrip('abcdefghijklmnopqrstuvwxyz')
    for p in claim['support']:
        if not p['id'].startswith(first):
            p.pop('gives', None)
            p['note'] = 'backs the claim as a whole'
    assert 'fusion' in rules(qa.gate_fusion(a))


def test_archaic_forms_and_straight_quotes_are_caught_but_quoted_words_are_not():
    a = article()
    a['claims'][0]['t'] = 'What the whole brings unto me is good for me.'
    a['single'][0]['why'] = "Only this passage says it, and it's alone."
    found = qa.gate_typography(a)
    assert {'plain words', 'typography'} <= rules(found)
    b = article()
    b['decisions'][0] = 'Casaubon wrote “thou” here; the Greek has the second person.'
    assert not rules(qa.gate_typography(b))


def test_statement_length_and_person():
    a = article()
    a['statement']['t'] = 'The whole brings what is good, and it comes at the right time, and so all is well with the world and the stars and the sea and the gods and the cities of the earth.'
    assert {'statement length', 'first person'} <= rules(qa.gate_voice(a))


def test_what_follows_must_be_one_short_sentence():
    a = article()
    a['claims'][0]['support'][0]['follows'] = 'Too short'
    assert 'what follows' in rules(qa.gate_follows(a))


def test_seneca_clauses_continue_the_sentence_and_limits_come_from_qualified_items():
    a = article()
    v = a['voices']['seneca']
    v['amend'][0]['t'] = 'What is hard I pay willingly.'
    assert 'seneca clause' in rules(qa.gate_seneca(a))
    b = article()
    wider = next(it['key'] for it in b['voices']['seneca']['items'] if it['effect'] == 'wider')
    lim = next(x for x in b['voices']['seneca']['amend'] if x['kind'] == 'limits')
    lim['from'] = [wider]
    assert 'seneca clause' in rules(qa.gate_seneca(b))


def test_seneca_context_and_strip_sentences():
    a = article()
    v = a['voices']['seneca']
    v['becomes'] = 'Seneca adds things.'
    next(it for it in v['items'] if 'quote' in it)['context'] = 'short'
    assert {'seneca', 'seneca context'} <= rules(qa.gate_seneca(a))


def test_an_empty_label_says_why_in_one_sentence():
    a = article()
    a['groups']['doubt'] = []
    a.setdefault('empty', {})['doubt'] = 'No passage in this section doubts it; the article states it and does not argue for it.'
    assert 'empty label' not in rules(qa.gate_accounting(a))
    a['empty']['doubt'] = 'No passage in this section doubts it. The article states it and does not argue for it.'
    assert 'empty label' in rules(qa.gate_accounting(a))


def test_a_seneca_context_names_its_letter_instead_of_pointing_back():
    a = article()
    piece = next(it for it in a['voices']['seneca']['items'] if 'quote' in it)
    assert 'seneca context' not in rules(qa.gate_seneca(a))
    piece['context'] = 'The same letter, on the death of a friend: grief has its measure.'
    assert 'seneca context' in rules(qa.gate_seneca(a))


def test_an_empty_label_needs_its_reason_and_every_article_quotes_the_new_english():
    a = article()
    a['empty']['doubt'] = ''
    a.pop('edition')
    assert {'empty label', 'edition'} <= rules(qa.gate_accounting(a))


def test_a_statement_that_repeats_another_article_is_caught_unless_the_limit_names_it():
    a = article()
    other = article(1)
    a['statement']['t'] = other['statement']['t']
    assert 'repetition' in rules(qa.gate_repetition(a, [other]))
    a['limit'] += ' It shares its ground with Article 1.'
    assert 'repetition' in rules(qa.gate_repetition(a, [other]), 'WARNING')
    assert 'repetition' not in rules(qa.gate_repetition(a, [other]))


def test_the_audit_must_have_all_its_parts():
    assert 'audit' in rules(qa.gate_audit(article(), None))
    assert 'audit' in rules(qa.gate_audit(article(), '## (a) For the owner\nnothing else'))
    assert not rules(qa.gate_audit(article(), GOOD_AUDIT))


@pytest.fixture
def passage():
    store = json.loads((ROOT / 'content/aurelius/translation/project-v1.json').read_text())
    return copy.deepcopy(next(p for p in store['passages'] if p['standard_ref'] == '10.21'))


def test_the_stored_translation_passes(passage):
    assert not rules(qa.check_passages([passage], 't'))


def test_a_latin_letter_inside_greek_is_caught(passage):
    passage['notes'][0]['greek'] = passage['notes'][0]['greek'][:2] + 'n' + passage['notes'][0]['greek'][3:]
    assert 'greek' in rules(qa.check_passages([passage], 't'))


def test_archaic_english_and_a_passage_without_notes_are_caught(passage):
    passage['english'] = passage['english'] + ' Thou knowest it.'
    passage['notes'] = []
    assert {'plain words', 'notes'} <= rules(qa.check_passages([passage], 't'))

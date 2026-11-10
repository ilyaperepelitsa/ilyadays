"""Only original miniature fixtures; no copyrighted book or credentials in tests."""
import hashlib
import pytest
from aurelius.importer import ORDINALS, import_file, parse_text

EDITION = {'id': 'test-edition', 'translator': 'Fixture author', 'source_location': 'fixture://own-text', 'rights_notes': 'Original test fixture'}


def source(kind='hays'):
    if kind == 'hays':
        return 'Introduction\n1. Commentary must not be imported.\n'+''.join(f'Book {i}\n\n1. Original 🏛️ cafe\u0301 passage {i}.\n\n2. A qualification, not a universal rule.\n' for i in range(1, 13))+'Notes\n1. Not author text.\n'
    return 'CONTENTS\n     FIRST BOOK\nIntroduction\n'+''.join(f'THE {name} BOOK\n\nI. Original test passage.\n\nII. A qualifying test passage.\n' for name in ORDINALS)+'APPENDIX\nCommentary excluded.\n'


def test_import_preserves_order_exact_unicode_substrings_and_excludes_commentary():
    raw = source()
    passages, report = parse_text(raw, EDITION, 'hays')
    assert len(passages) == 24
    assert [(p['book'], p['section']) for p in passages] == [(str(i), str(j)) for i in range(1, 13) for j in [1, 2]]
    for p, locator in zip(passages, report['segments']):
        assert raw[locator['source_start']:locator['source_end']] == p['text'] == p['raw_text']
        assert hashlib.sha256(p['text'].encode()).hexdigest() == p['text_hash']
        assert 'Commentary' not in p['text'] and 'Not author text' not in p['text']
    assert report['segmentation_status'] == 'awaiting_review'
    assert len(report['excluded']) == 2


def test_ocr_boundary_recognition_never_changes_source_wording():
    raw = source().replace('2. A qualification', '2.A qualification', 1)
    passages, report = parse_text(raw, EDITION, 'hays')
    assert passages[1]['text'].startswith('A qualification')
    assert report['warnings'][0]['kind'] == 'ocr_section_marker'
    assert raw[report['segments'][1]['source_start']:report['segments'][1]['source_end']] == passages[1]['text']


def test_backup_roman_inline_and_missing_dot_are_audited_not_silently_merged():
    raw = source('backup').replace('\n\nII. A qualifying', ' II. A qualifying', 1)
    # A separate book loses its period; the first has a label on the previous line.
    at = raw.index('THE SECOND BOOK')
    raw = raw[:at]+raw[at:].replace('II. A qualifying', 'II A qualifying', 1)
    passages, report = parse_text(raw, EDITION, 'public_domain_backup')
    assert len(passages) == 24
    assert [s['raw_label'] for s in report['segments'][:2]] == ['I', 'II']
    assert len([w for w in report['warnings'] if w['kind']=='nonstandard_section_marker']) == 2


def test_missing_labels_remain_visible_and_ambiguous_boundaries_fail():
    _, report = parse_text(source().replace('2. A qualification', '3. A qualification', 1), EDITION, 'hays')
    assert any(w['kind']=='section_sequence' for w in report['warnings'])
    with pytest.raises(ValueError, match='Duplicate canonical'):
        parse_text(source().replace('2. A qualification', '1. A qualification', 1), EDITION, 'hays')
    with pytest.raises(ValueError, match='ambiguous'):
        parse_text(source()+source(), EDITION, 'hays')
    with pytest.raises(ValueError, match='HTML viewer'):
        parse_text('<html>Untrusted viewer markup</html>', EDITION, 'hays')


def test_import_restart_is_idempotent_and_keeps_original_bytes(tmp_path):
    path = tmp_path/'own.txt'
    path.write_text(source())
    directory, report = import_file(path, tmp_path/'corpora', EDITION, 'hays')
    again, second = import_file(path, tmp_path/'corpora', EDITION, 'hays')
    assert again == directory and second == report
    assert (directory/'source.txt').read_bytes() == path.read_bytes()
    assert (directory/'corpus.json').stat().st_mode & 0o077 == 0

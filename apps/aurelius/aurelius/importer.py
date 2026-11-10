"""Deterministic text import. Canonical numbering, exact source offsets, no OCR repair."""
import hashlib
import json
import re
from pathlib import Path

PARSER_VERSION = 'numbered-text-v2'
ORDINALS = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH',
            'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH', 'ELEVENTH', 'TWELFTH']


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def roman(number):
    result = ''
    for n, letter in [(100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'),
                      (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')]:
        while number >= n:
            result += letter
            number -= n
    return result


def roman_number(label):
    return next((n for n in range(1, 201) if roman(n) == label), None)


def parse_text(text, edition, kind):
    if kind not in {'hays', 'public_domain_backup'}:
        raise ValueError('Choose the actual edition parser, never infer a translation from similarity')
    if text.lstrip().lower().startswith(('<!doctype', '<html')):
        raise ValueError('HTML viewer supplied instead of plain text; use the actual download')
    if not edition.get('id') or not edition.get('translator'):
        raise ValueError('Edition identity and translator are required')
    lines = list(re.finditer(r'^.*(?:\n|$)', text, re.MULTILINE))
    lines = [m for m in lines if m.start() < len(text)]
    headings = []
    for i, line in enumerate(lines):
        label = line.group().strip()
        if kind == 'hays':
            match = re.fullmatch(r'Book (\d+)', label)
            if match:
                headings.append((int(match[1]), i, line.start(), line.end()))
        elif label in [f'THE {name} BOOK' for name in ORDINALS]:
            headings.append((ORDINALS.index(label[4:-5]) + 1, i, line.start(), line.end()))
    # Contents entries are deliberately excluded by selecting the complete body sequence.
    sequences = [headings[i:i+12] for i in range(len(headings))
                 if [h[0] for h in headings[i:i+12]] == list(range(1, 13))]
    if len(sequences) != 1:
        raise ValueError('Book boundaries are ambiguous: need exactly one complete 1–12 body sequence')
    books = sequences[0]
    last = books[-1]
    end_labels = {'Notes'} if kind == 'hays' else {'APPENDIX'}
    ending = next((line.start() for line in lines[last[1]+1:]
                   if line.group().strip() in end_labels), None)
    if ending is None:
        raise ValueError('Cannot identify the boundary between author text and appended commentary')
    passages, segments, warnings, boundaries = [], [], [], []
    for index, (book, line_index, book_start, body_start) in enumerate(books):
        end = books[index+1][2] if index < 11 else ending
        markers = []
        for line in lines[line_index+1:]:
            if line.start() >= end:
                break
            value = line.group().rstrip('\r\n')
            # OCR sometimes drops the space after '.', or reads 11 as ll. Neither
            # correction changes the preserved source text; the marker decision is audited.
            pattern = r'^\s*(\d{1,3}|[Il]{2})\.(.*)' if kind == 'hays' else r'^\s*([IVXLCDM]+)\.\s+(.*)'
            match = re.match(pattern, value)
            if not match:
                continue
            label = match[1]
            number = (11 if label in {'ll', 'Il', 'lI', 'II'} else int(label)) if kind == 'hays' else roman_number(label)
            if not number:
                warnings.append({'kind': 'invalid_section_label', 'book': book, 'line': line_index+1})
                continue
            offset = line.start() + match.start(2)
            markers.append((number, label, line.start(), offset, line.end()))
            if kind == 'hays' and (not label.isdigit() or (match[2] and not match[2][0].isspace())):
                warnings.append({'kind': 'ocr_section_marker', 'book': book, 'section': str(number), 'raw_label': label+'.', 'source_offset': line.start(), 'decision': 'Recognized boundary only; source wording remains untouched.'})
        if kind == 'public_domain_backup':
            markers = []
            # This file has canonical labels embedded after the previous paragraph
            # and three labels without their dot. Accept unusual forms only when
            # their number is the next canonical one; retain and report the decision.
            pattern = r'(?m)(?:^([IVXLCDM]+)\.[ \t]+|^([IVXLCDM]{2,})[ \t]+(?=[A-Z])|(?<=[.!?])[ \t]+([IVXLCDM]+)\.[ \t]+(?=[A-Z]))'
            for match in re.finditer(pattern, text[body_start:end]):
                label = next(g for g in match.groups() if g is not None)
                number = roman_number(label)
                unusual = match[1] is None
                expected = markers[-1][0]+1 if markers else 1
                if number is None or (unusual and number != expected):
                    continue
                marker_start, content_start = body_start+match.start(), body_start+match.end()
                markers.append((number, label, marker_start, content_start, content_start))
                if unusual:
                    warnings.append({'kind': 'nonstandard_section_marker', 'book': book, 'section': str(number), 'raw_label': match.group().strip(), 'source_offset': marker_start, 'decision': 'Recognized sequential boundary; original text is unchanged.'})
        numbers = [m[0] for m in markers]
        if not numbers or numbers[0] != 1:
            warnings.append({'kind': 'missing_initial_section', 'book': book})
        seen = set()
        expected = 1
        for number in numbers:
            if number in seen:
                warnings.append({'kind': 'duplicate_section', 'book': book, 'section': str(number)})
            if number != expected:
                warnings.append({'kind': 'section_sequence', 'book': book, 'expected': expected, 'actual': number})
            seen.add(number)
            expected = number+1
        first_marker = markers[0][2] if markers else end
        if text[body_start:first_marker].strip():
            boundaries.append({'book': book, 'start': body_start, 'end': first_marker, 'classification': 'book_heading_or_epigraph', 'review_required': True})
        for j, (number, label, marker_start, content_start, _) in enumerate(markers):
            content_end = markers[j+1][2] if j+1 < len(markers) else end
            while content_start < content_end and text[content_start].isspace():
                content_start += 1
            while content_end > content_start and text[content_end-1].isspace():
                content_end -= 1
            raw = text[content_start:content_end]
            if not raw:
                warnings.append({'kind': 'empty_section', 'book': book, 'section': str(number)})
            identity = f"{edition['id']}-{book}-{number}"
            text_hash = digest(raw)
            passage = {'id': identity, 'revision_id': f'{identity}:{text_hash[:16]}',
                       'edition_id': edition['id'], 'book': str(book), 'section': str(number),
                       'locator': f"{edition['source_location']}#book-{book}-section-{label};scalar={content_start}:{content_end}",
                       'text': raw, 'raw_text': raw, 'text_hash': text_hash,
                       'normalization': 'identity-v1', 'authorship': f"Marcus Aurelius; translated by {edition['translator']}"}
            passages.append(passage)
            segments.append({'passage_revision': passage['revision_id'], 'raw_label': label,
                             'source_start': content_start, 'source_end': content_end,
                             'marker_start': marker_start, 'text_hash': text_hash})
            if re.search(r'\[\d+\]|\*|\ufffd|<[^>]+>', raw):
                warnings.append({'kind': 'possible_artifact_or_note_marker', 'book': book, 'section': str(number), 'passage_revision': passage['revision_id']})
    if len({p['id'] for p in passages}) != len(passages):
        raise ValueError('Duplicate canonical IDs; inspect the reported section boundaries')
    report = {'parser_version': PARSER_VERSION, 'source_hash': digest(text),
              'offset_convention': 'unicode-scalar-half-open-v1', 'normalization': 'identity-v1',
              'corpus_kind': kind, 'edition': edition, 'chunk_count': len(passages),
              'books': [{'book': b, 'sections': sum(p['book']==str(b) for p in passages)} for b in range(1, 13)],
              'excluded': [{'start': 0, 'end': books[0][2], 'reason': 'front matter, introduction, translator notes and contents'},
                           {'start': ending, 'end': len(text), 'reason': 'end notes, appendix, glossary, publisher and license material'}],
              'book_front_matter': boundaries, 'warnings': warnings, 'segments': segments,
              'segmentation_status': 'awaiting_review', 'source_order_preserved': True,
              'rights_status': edition.get('rights_notes', 'User must supply processing/reuse notes')}
    return passages, report


def import_file(path: Path, destination: Path, edition, kind):
    # No mutation of existing corpora. Re-running the same import is idempotent.
    raw_bytes = path.read_bytes()
    text = raw_bytes.decode('utf-8-sig')
    passages, report = parse_text(text, edition, kind)
    report['file_hash'] = hashlib.sha256(raw_bytes).hexdigest()
    edition_hash = hashlib.sha256(json.dumps(edition, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:8]
    report['import_id'] = f"{edition['id']}-{report['file_hash'][:16]}-{PARSER_VERSION}-{edition_hash}"
    target = destination / report['import_id']
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    for name, value in [('corpus.json', {'corpus_kind': kind, 'editions': [edition], 'passages': passages}), ('inspection.json', report)]:
        output = json.dumps(value, ensure_ascii=False, indent=2)+'\n'
        p = target/name
        if p.exists() and p.read_text() != output:
            raise ValueError('Immutable import identity conflict; create a new parser version')
        p.write_text(output)
        p.chmod(0o600)
    (target/'source.txt').write_bytes(raw_bytes)
    (target/'source.txt').chmod(0o600)
    return target, report

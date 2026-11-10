"""Offsets are Python Unicode scalar indices; never UTF-16 units or grapheme counts."""
import hashlib


def utf16_to_scalar(text: str, offset: int) -> int:
    raw = text.encode('utf-16-le')
    if not isinstance(offset, int) or offset < 0 or offset * 2 > len(raw):
        raise ValueError('Invalid UTF-16 offset')
    try:
        return len(raw[:offset * 2].decode('utf-16-le'))
    except UnicodeDecodeError as error:
        raise ValueError('Offset splits a surrogate pair') from error


def scalar_to_utf16(text: str, offset: int) -> int:
    if not isinstance(offset, int) or offset < 0 or offset > len(text):
        raise ValueError('Invalid scalar offset')
    return len(text[:offset].encode('utf-16-le')) // 2


def validate_anchor(passage: dict, span: dict) -> None:
    text = passage['text']
    if span['passage_revision'] != passage['revision_id'] or span['text_hash'] != passage['text_hash'] or hashlib.sha256(text.encode()).hexdigest() != passage['text_hash']:
        raise ValueError('Source hash/revision mismatch')
    start, end = span['start'], span['end']
    if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(text) or text[start:end] != span['exact']:
        raise ValueError('Invalid quotation anchor')
    if text[max(0, start-len(span['prefix'])):start] != span['prefix'] or text[end:end+len(span['suffix'])] != span['suffix']:
        raise ValueError('Source context mismatch')

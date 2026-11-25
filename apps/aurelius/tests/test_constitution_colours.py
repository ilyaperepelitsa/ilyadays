"""Passages sharing a phrase or claim must remain distinguishable in a five-colour reader."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    'constitution', Path(__file__).resolve().parents[3] / 'scripts/aurelius-constitution.py'
)
constitution = importlib.util.module_from_spec(spec)
spec.loader.exec_module(constitution)


def graph(groups):
    refs = list(dict.fromkeys(ref for group in groups for ref in group))
    neighbours = {ref: set() for ref in refs}
    for group in groups:
        for ref in group:
            neighbours[ref].update(set(group) - {ref})
    return refs, neighbours


def test_recover_article_19_passage_colours():
    groups = [
        ['1.15', '11.16', '12.12', '7.34', '9.43'], ['9.25', '9.9'],
        ['10.4', '11.12', '8.56', '9.43', '9.9'], ['11.12', '7.34', '9.25'],
        ['10.30', '11.16', '7.19', '9.25'], ['1.15', '11.16', '11.8', '7.18'],
    ]
    refs, neighbours = graph(groups)
    positions = {'7.34': 0, '11.16': 0, '1.15': 36, '9.43': 36,
                 '10.4': 73, '9.9': 73, '8.56': 96}
    colours = constitution.recover_five_colours(refs, neighbours, positions)
    assert set(colours) == set(refs)
    assert set(colours.values()) == set(range(1, 6))
    for group in groups:
        assert len({colours[ref] for ref in group}) == len(group)


def test_six_mutually_conflicting_passages_still_fail():
    refs, neighbours = graph([list('abcdef')])
    assert constitution.recover_five_colours(refs, neighbours, {}) == {}

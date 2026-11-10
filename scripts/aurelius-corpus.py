#!/usr/bin/env python3
"""Private import → inspect → approved cached embeddings → real PCA. No default API calls."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import signal
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'apps/aurelius'))
from aurelius.analysis import analyze_embeddings, corpus_identity
from aurelius.embeddings import CONFIG, PRODUCTION_CONFIG, EmbeddingCache
from aurelius.importer import import_file

EDITIONS = {
    'hays': {'id': 'hays-archive-2002', 'work': 'Meditations: A New Translation',
             'translator': 'Gregory Hays', 'publisher': 'Modern Library', 'isbn': '9781588361738',
             'source_location': 'https://archive.org/download/meditation-GeorgeHays/meditations-GeorgeHays_djvu.txt',
             'rights_notes': 'User-provided copy requested for private study/extraction. Internal title, 2002 copyright and ebook ISBN match Hays; archive is not publisher-authenticated. No source redistribution authorization.'},
    'backup': {'id': 'casaubon-gutenberg-2680', 'work': 'Meditations', 'translator': 'Meric Casaubon',
               'publisher': 'Project Gutenberg', 'isbn': None,
               'source_location': 'https://www.gutenberg.org/cache/epub/2680/pg2680.txt',
               'rights_notes': 'Project Gutenberg 2680, public domain in USA per source; retain full license privately. Separately selected backup; not Gregory Hays. Numbering is edition-specific.'}}


def server_api_key():
    key = os.environ.get('OPENAI_API_KEY')
    if key:
        return key
    # The same ignored server-only local config used by Next. Parse one value;
    # never execute shell content, print credentials, or expose NEXT_PUBLIC keys.
    local = ROOT/'.env.local'
    if local.exists():
        match = re.search(r'''(?m)^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s#]+))''', local.read_text())
        if match:
            return next((group for group in match.groups() if group), None)
    return None


def private_path(path):
    path = Path(path).resolve()
    if not path.is_relative_to(ROOT/'.aurelius'):
        raise ValueError('Book/corpus files must stay under ignored .aurelius/ storage')
    return path


def read_import(directory):
    directory = private_path(directory)
    corpus = json.loads((directory/'corpus.json').read_text())
    report = json.loads((directory/'inspection.json').read_text())
    data = (directory/'source.txt').read_bytes()
    raw = data.decode('utf-8-sig')
    if hashlib.sha256(data).hexdigest() != report['file_hash'] or hashlib.sha256(raw.encode()).hexdigest() != report['source_hash']:
        raise ValueError('Imported file identity changed')
    segments = {s['passage_revision']: s for s in report['segments']}
    if len(corpus['passages']) != report['chunk_count'] or len(segments) != len(corpus['passages']):
        raise ValueError('Import coverage mismatch')
    for p in corpus['passages']:
        segment = segments[p['revision_id']]
        if raw[segment['source_start']:segment['source_end']] != p['text'] or hashlib.sha256(p['text'].encode()).hexdigest() != p['text_hash']:
            raise ValueError('Source locator/text/hash mismatch')
    return directory, corpus, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    imp = sub.add_parser('import')
    imp.add_argument('--source', required=True)
    imp.add_argument('--edition', choices=EDITIONS, required=True)
    for name in ['preview', 'embed', 'embed-production', 'project', 'export-map', 'study']:
        item = sub.add_parser(name)
        item.add_argument('--corpus-dir', required=True)
        if name in ['embed', 'embed-production']:
            item.add_argument('--review-import', action='store_true')
            item.add_argument('--allow-openai', action='store_true')
            item.add_argument('--corpus-hash', required=True)
            item.add_argument('--token-budget', type=int, required=True)
            item.add_argument('--cost-budget-usd', type=float, required=True)
        if name in ['preview','project']:
            item.add_argument('--production',action='store_true')
        if name == 'embed-production':
            item.add_argument('--deployment-url',required=True)
            item.add_argument('--access-file',required=True)
        if name == 'export-map':
            item.add_argument('--output', default=str(ROOT/'content/aurelius/real-map.json'))
        if name == 'study':
            item.add_argument('--public-backup-excerpts', action='store_true')
    args = parser.parse_args()
    if args.action == 'import':
        kind = 'hays' if args.edition == 'hays' else 'public_domain_backup'
        target, report = import_file(private_path(args.source), ROOT/'.aurelius/corpora', EDITIONS[args.edition], kind)
        print(json.dumps({'directory': str(target.relative_to(ROOT)), 'chunks': report['chunk_count'], 'warnings': report['warnings'], 'status': report['segmentation_status']}, indent=2))
        return
    directory, corpus, report = read_import(args.corpus_dir)
    configuration = json.loads((ROOT/'content/aurelius/production-inputs.json').read_text())['configuration'] if args.action=='embed-production' or getattr(args,'production',False) else CONFIG
    cache = EmbeddingCache(ROOT/'.aurelius/vectors', configuration)
    if args.action == 'preview':
        plan = cache.plan(corpus['passages'])
        plan.pop('batches')
        print(json.dumps({**plan, 'edition': corpus['editions'][0], 'inspection': {'file_hash': report['file_hash'], 'books': report['books'], 'warnings': report['warnings'], 'book_front_matter': report['book_front_matter'], 'status': report['segmentation_status']}, 'api_requests_made': 0}, indent=2))
    elif args.action in ['embed','embed-production']:
        if args.corpus_hash != corpus_identity(corpus['passages']):
            raise ValueError('Approval refers to a different corpus revision')
        if any(w['kind'] in {'duplicate_section', 'section_sequence', 'missing_initial_section', 'empty_section'} for w in report['warnings']):
            raise ValueError('Unresolved canonical section boundaries; repair/review import before approval')
        if not args.review_import or not args.allow_openai:
            raise ValueError('Review inspection.json and explicitly approve import and external processing')
        key = server_api_key() if args.action=='embed' else None
        if args.action=='embed' and not key:
            raise ValueError('Set OPENAI_API_KEY in the server environment or ignored .env.local; never paste it into chat or source code')
        approval = {'corpus_hash': args.corpus_hash, 'source_file_hash': report['file_hash'],
                    'parser_version': report['parser_version'], 'segmentation_reviewed': args.review_import,
                    'external_processing_approved': args.allow_openai, 'token_budget': args.token_budget,
                    'cost_budget_usd': args.cost_budget_usd, 'reviewer': 'explicit CLI operator approval'}
        if args.action=='embed-production':
            from aurelius.production_client import ProductionClient
            manifest=json.loads((ROOT/'content/aurelius/production-inputs.json').read_text())
            if not any(c['corpus_hash']==args.corpus_hash for c in manifest['corpora']):
                raise ValueError('Corpus is not in the production allowlist')
            if args.cost_budget_usd>manifest['combined_cap_usd']/len(manifest['corpora']):
                raise ValueError('Per-corpus production cap would exceed the disclosed combined budget')
            client=ProductionClient(args.deployment_url,private_path(args.access_file),manifest['id'],configuration['wire_model'])
            approval['processing_environment']='protected_vercel_production'
        else:
            from openai import OpenAI
            client=OpenAI(api_key=key,base_url='https://api.openai.com/v1',max_retries=0,timeout=60)
        (directory/'processing-approval.json').write_text(json.dumps(approval,indent=2)+'\n')
        (directory/'processing-approval.json').chmod(0o600)
        canceled = False
        def stop(*_):
            nonlocal canceled
            canceled = True
        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)
        result = cache.embed(corpus['passages'], client, approval, cancel=lambda: canceled)
        print(json.dumps(result, indent=2))
    elif args.action == 'project':
        import numpy as np
        artifact, arrays = analyze_embeddings(corpus, cache.matrix(corpus['passages']), configuration)
        (directory/'projection.json').write_text(json.dumps(artifact, indent=2)+'\n')
        np.savez_compressed(directory/'projection-arrays.npz', **arrays)
        print(json.dumps({'run_id': artifact['run_id'], 'chunks': artifact['chunk_count'], 'model': configuration['model'], 'dimensions': configuration['dimensions'], 'excluded': 0, 'sampled': False}, indent=2))
    elif args.action == 'study':
        from aurelius.study import manual_study
        from aurelius.store import validate_workspace
        audit = {'source_chunk_count': report['chunk_count'], 'parser_version': report['parser_version'], 'status': report['segmentation_status'], 'warnings': report['warnings'], 'excluded_ranges': len(report['excluded'])}
        workspace = validate_workspace({**manual_study(corpus, report['file_hash']), 'import_audit': audit})
        (directory/'workspace.json').write_text(json.dumps(workspace, ensure_ascii=False, indent=2)+'\n')
        (directory/'workspace.json').chmod(0o600)
        if args.public_backup_excerpts:
            sample = validate_workspace({**manual_study(corpus, report['file_hash'], public_slice=True), 'import_audit': audit})
            (ROOT/'content/aurelius/backup-study.json').write_text(json.dumps(sample, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps({'workspace': str((directory/'workspace.json').relative_to(ROOT)), 'chunks': len(workspace['passages']), 'study': 'manual editorial proposal; no model call or human approval', 'public_backup_excerpt_study': args.public_backup_excerpts}, indent=2))
    else:
        artifact = json.loads((directory/'projection.json').read_text())
        if artifact['corpus_hash'] != corpus_identity(corpus['passages']) or artifact['vector_origin'] != 'openai' or artifact['chunk_count'] != len(corpus['passages']):
            raise ValueError('Projection is stale or incomplete')
        # References/coordinates only: never copy the modern translation or full
        # source vectors into a public artifact to make the hosted plot work.
        public_keys = ['schema_version','pipeline_version','run_id','corpus_kind','corpus_hash',
                       'vector_origin','vector_description','embedding_configuration','configuration_hash',
                       'dimensions','vector_hash','sampled','chunk_count','excluded_chunks',
                       'preprocessing','pca','clustering','software','points']
        artifact = {k: artifact[k] for k in public_keys}
        artifact['share_mode'] = 'references_and_projection_only'
        artifact['edition'] = {k: corpus['editions'][0].get(k) for k in ['id', 'work', 'translator', 'publisher', 'isbn', 'source_location']}
        if any('text' in p or 'raw_text' in p for p in artifact['points']):
            raise ValueError('Source text cannot appear in the shareable map')
        target = Path(args.output).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(artifact, indent=2)+'\n')
        print(json.dumps({'output': str(target), 'chunks': artifact['chunk_count'], 'source_text_included': False}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileNotFoundError) as error:
        raise SystemExit(str(error)) from None

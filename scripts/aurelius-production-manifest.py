#!/usr/bin/env python3
"""Hash-only allowlist for the exact inspected production embedding inputs; no book text."""
import importlib.util
import json
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/aurelius'))
from aurelius.embeddings import PRODUCTION_CONFIG,EmbeddingCache,fingerprint
spec=importlib.util.spec_from_file_location('corpus_cli',ROOT/'scripts/aurelius-corpus.py')
cli=importlib.util.module_from_spec(spec);spec.loader.exec_module(cli)
jobs=json.loads((ROOT/'.aurelius/processing-next.json').read_text())
inputs={};corpora=[]
cache=EmbeddingCache(ROOT/'.aurelius/vectors',PRODUCTION_CONFIG)
for item in jobs['items']:
    directory,corpus,report=cli.read_import(item['corpus_dir'])
    plan=cache.plan(corpus['passages'])
    if plan['invalid_inputs']:raise SystemExit('Unresolved input limits')
    import tiktoken
    encoder=tiktoken.encoding_for_model(PRODUCTION_CONFIG['model'])
    for p in corpus['passages']:
        inputs[p['text_hash']]={'tokens':len(encoder.encode(p['text'],disallowed_special=())),'bytes':len(p['text'].encode())}
    corpora.append({'edition_id':corpus['editions'][0]['id'],'file_hash':report['file_hash'],'corpus_hash':plan['corpus_hash'],'sections':len(corpus['passages']),'input_tokens':plan['input_tokens']})
manifest={'version':'production-embedding-inputs-v1','configuration':PRODUCTION_CONFIG,'combined_cap_usd':.1,'max_batch_tokens':16000,'max_batch_items':32,'execution_enabled':True,'expires_at':'2026-11-11T00:00:00Z','corpora':corpora,'inputs':inputs}
manifest['id']=fingerprint(manifest)
(ROOT/'content/aurelius/production-inputs.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'manifest':manifest['id'],'corpora':corpora,'input_count':len(inputs),'source_text_included':False},indent=2))

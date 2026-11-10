"""Reproducible local numerical discovery. Fixture features are NOT OpenAI embeddings."""
import hashlib
import json
from pathlib import Path

import numpy as np
import sklearn
from sklearn.cluster import AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer

PIPELINE_VERSION = 'aurelius-local-discovery-v1'
DIMENSIONS = 3072


def corpus_identity(passages):
    return hashlib.sha256(json.dumps([[p['revision_id'], p['text_hash']] for p in passages], separators=(',', ':')).encode()).hexdigest()


def project_vectors(vectors):
    x = np.asarray(vectors, dtype=np.float64)
    if x.ndim != 2 or x.shape[0] < 3 or x.shape[1] < 2:
        raise ValueError('PCA discovery needs at least three chunks and two features')
    if not np.isfinite(x).all() or np.any(np.linalg.norm(x, axis=1) == 0):
        raise ValueError('Non-finite or zero vectors cannot be projected')
    if np.linalg.matrix_rank(x - x.mean(axis=0)) < 2:
        raise ValueError('The input has fewer than two informative principal directions')
    fit = PCA(n_components=2, svd_solver='full')
    coordinates = fit.fit_transform(x)
    hierarchy = AgglomerativeClustering(n_clusters=None, distance_threshold=0, metric='cosine', linkage='average', compute_distances=True).fit(x)
    assignments = {}
    for k in range(2, min(12, len(x)) + 1):
        labels = AgglomerativeClustering(n_clusters=k, metric='cosine', linkage='average').fit_predict(x)
        # Canonical numeric labels follow first occurrence; they are not curated concepts.
        label_map = {}
        assignments[str(k)] = [label_map.setdefault(int(label), len(label_map)) for label in labels]
    return fit, coordinates, hierarchy, assignments


def analyze_fixture(workspace):
    if workspace.get('corpus_kind') != 'synthetic':
        raise ValueError('This local lexical demonstration cannot replace the requested real-corpus embedding index')
    passages = workspace['passages']
    if len({p['revision_id'] for p in passages}) != len(passages):
        raise ValueError('Every chunk must have a unique source revision')
    for p in passages:
        if hashlib.sha256(p['text'].encode()).hexdigest() != p['text_hash']:
            raise ValueError('Chunk text/hash mismatch')
    counts = HashingVectorizer(n_features=DIMENSIONS, alternate_sign=False, norm=None, ngram_range=(1, 2), stop_words='english').transform([p['text'] for p in passages])
    tfidf = TfidfTransformer(norm='l2')
    vectors = tfidf.fit_transform(counts).toarray().astype(np.float32)
    fit, coords, hierarchy, assignments = project_vectors(vectors)
    identity = corpus_identity(passages)
    vector_hash = hashlib.sha256(vectors.tobytes()).hexdigest()
    run_hash = hashlib.sha256((identity + PIPELINE_VERSION + vector_hash + np.__version__ + sklearn.__version__).encode()).hexdigest()
    artifact = {
        'schema_version': 1, 'pipeline_version': PIPELINE_VERSION,
        'run_id': f'fixture-pca-{run_hash[:16]}', 'corpus_kind': 'synthetic',
        'corpus_hash': identity, 'fixture_revision': workspace.get('fixture_revision', 1),
        'vector_origin': 'local_hashed_tfidf', 'vector_description': 'Local word/bigram TF-IDF on original synthetic text; not OpenAI embeddings',
        'dimensions': DIMENSIONS, 'vector_hash': vector_hash, 'sampled': False,
        'chunk_count': len(passages), 'excluded_chunks': [],
        'preprocessing': {'ngrams': [1, 2], 'hashing_alternate_sign': False, 'row_norm': 'l2', 'centered_for_pca': True, 'feature_standardization': False},
        'pca': {'solver': 'full', 'explained_variance': fit.explained_variance_.tolist(), 'explained_variance_ratio': fit.explained_variance_ratio_.tolist(), 'singular_values': fit.singular_values_.tolist()},
        'clustering': {'linkage': 'average', 'distance': 'cosine', 'input_dimensions': DIMENSIONS, 'input_space': 'full_feature_space', 'labels_by_k': assignments, 'children': hierarchy.children_.tolist(), 'distances': hierarchy.distances_.tolist()},
        'software': {'numpy': np.__version__, 'scikit_learn': sklearn.__version__},
        'points': [{'passage_id': p['id'], 'revision_id': p['revision_id'], 'text_hash': p['text_hash'], 'reference': f"Demo {p['book']}.{p['section']}", 'x': float(coords[i, 0]), 'y': float(coords[i, 1])} for i, p in enumerate(passages)],
    }
    arrays = {'vectors': vectors, 'components': fit.components_, 'mean': fit.mean_, 'coordinates': coords, 'idf': tfidf.idf_, 'row_ids': np.array([p['revision_id'] for p in passages])}
    return artifact, arrays


def write_fixture_analysis(workspace, metadata_path: Path, arrays_path: Path):
    artifact, arrays = analyze_fixture(workspace)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    arrays_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + '\n')
    np.savez_compressed(arrays_path, **arrays)
    return artifact


def analyze_embeddings(corpus, vectors, embedding_configuration):
    """Real source vectors only. This entry point never invokes lexical feature extraction."""
    if corpus.get('corpus_kind') not in {'hays', 'public_domain_backup'}:
        raise ValueError('A real edition corpus is required')
    if embedding_configuration.get('model') != 'text-embedding-3-large' or embedding_configuration.get('dimensions') != DIMENSIONS:
        raise ValueError('The selected full embedding model/dimensions must be preserved')
    passages = corpus['passages']
    x = np.asarray(vectors, dtype=np.float32)
    if x.shape != (len(passages), DIMENSIONS) or len({p['revision_id'] for p in passages}) != len(passages):
        raise ValueError('Exactly one full vector per canonical chunk is required')
    for p in passages:
        if hashlib.sha256(p['text'].encode()).hexdigest() != p['text_hash']:
            raise ValueError('Source/hash mismatch')
    fit, coords, hierarchy, assignments = project_vectors(x)
    vector_hash = hashlib.sha256(x.tobytes()).hexdigest()
    identity = corpus_identity(passages)
    pipeline = 'aurelius-source-embedding-discovery-v1'
    config_hash = hashlib.sha256(json.dumps(embedding_configuration, sort_keys=True).encode()).hexdigest()
    run_hash = hashlib.sha256((identity+pipeline+vector_hash+config_hash+np.__version__+sklearn.__version__).encode()).hexdigest()
    edition = corpus['editions'][0]
    artifact = {'schema_version': 1, 'pipeline_version': pipeline,
                'run_id': f'source-pca-{run_hash[:16]}', 'corpus_kind': corpus['corpus_kind'],
                'corpus_hash': identity, 'vector_origin': 'openai',
                'vector_description': 'OpenAI text-embedding-3-large, full 3072-dimensional cached source vectors',
                'embedding_configuration': embedding_configuration, 'configuration_hash': config_hash,
                'edition': edition, 'dimensions': DIMENSIONS, 'vector_hash': vector_hash,
                'sampled': False, 'chunk_count': len(passages), 'excluded_chunks': [],
                'preprocessing': {'input': 'exact_source_text', 'centered_for_pca': True, 'feature_standardization': False},
                'pca': {'solver': 'full', 'explained_variance': fit.explained_variance_.tolist(), 'explained_variance_ratio': fit.explained_variance_ratio_.tolist(), 'singular_values': fit.singular_values_.tolist()},
                'clustering': {'linkage': 'average', 'distance': 'cosine', 'input_dimensions': DIMENSIONS, 'input_space': 'full_feature_space', 'labels_by_k': assignments, 'children': hierarchy.children_.tolist(), 'distances': hierarchy.distances_.tolist()},
                'software': {'numpy': np.__version__, 'scikit_learn': sklearn.__version__},
                'points': [{'passage_id': p['id'], 'revision_id': p['revision_id'], 'text_hash': p['text_hash'], 'reference': f"{p['book']}.{p['section']}", 'x': float(coords[i, 0]), 'y': float(coords[i, 1])} for i, p in enumerate(passages)]}
    arrays = {'vectors': x, 'components': fit.components_, 'mean': fit.mean_,
              'coordinates': coords, 'row_ids': np.array([p['revision_id'] for p in passages])}
    return artifact, arrays

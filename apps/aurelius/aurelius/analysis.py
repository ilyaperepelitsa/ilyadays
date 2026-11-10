"""Reproducible local numerical discovery. Fixture features are NOT OpenAI embeddings."""
import hashlib
import json
from pathlib import Path

import numpy as np
import sklearn
from sklearn.cluster import AgglomerativeClustering
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer
from sklearn.metrics import pairwise_distances, silhouette_score

PIPELINE_VERSION = 'aurelius-local-discovery-v1'
DIMENSIONS = 3072


def cut_hierarchy(children, n, k):
    if not 1 <= k <= n:
        raise ValueError('Invalid hierarchy cut')
    active = {2*n-2}
    while len(active) < k:
        node = max(active)
        active.remove(node)
        active.update(children[node-n])
    labels = np.empty(n, dtype=int)
    for group, node in enumerate(sorted(active)):
        todo = [node]
        while todo:
            current = todo.pop()
            if current < n:
                labels[current] = group
            else:
                todo.extend(children[current-n])
    canonical = {}
    return [canonical.setdefault(int(label), len(canonical)) for label in labels]


def analyze_hierarchy(vectors, baseline):
    """Compare full-space trees without refitting PCA or changing cached embeddings."""
    original = np.asarray(vectors, dtype=np.float32)
    if original.ndim != 2 or len(original) < 3 or original.shape[1] != DIMENSIONS:
        raise ValueError('Hierarchy comparison requires the complete 3072-dimensional matrix')
    if not np.isfinite(original).all() or np.any(np.linalg.norm(original, axis=1) == 0):
        raise ValueError('Invalid source vectors')
    if baseline.get('linkage')!='average' or baseline.get('distance')!='cosine' or baseline.get('input_dimensions')!=DIMENSIONS:
        raise ValueError('The original full-dimensional average/cosine baseline is required')
    x = original.astype(np.float64)
    n = len(x)
    distance = np.maximum(0, pairwise_distances(x, metric='cosine'))
    np.fill_diagonal(distance, 0)
    methods = {}
    for method in ['average', 'complete']:
        if method == 'average':
            children = baseline['children']
            distances = baseline['distances']
        else:
            fit = AgglomerativeClustering(n_clusters=None, distance_threshold=0,
                                         metric='cosine', linkage=method, compute_distances=True).fit(x)
            children, distances = fit.children_.tolist(), fit.distances_.tolist()
        if len(children) != n-1 or len(distances) != n-1:
            raise ValueError('Incomplete hierarchy')
        members = [[i] for i in range(n)]
        representatives = list(range(n))
        used_children=set()
        for i, pair in enumerate(children):
            if len(pair) != 2 or pair[0] == pair[1] or any(not isinstance(child,int) or not 0 <= child < n+i or child in used_children for child in pair):
                raise ValueError('Invalid hierarchy merge')
            used_children.update(pair)
            leaves = sorted(members[pair[0]]+members[pair[1]])
            members.append(leaves)
            representatives.append(leaves[int(np.argmin(distance[np.ix_(leaves, leaves)].mean(axis=1)))])
        if len(members[-1])!=n or len(set(members[-1]))!=n:
            raise ValueError('Hierarchy loses source leaves')
        assignments, diagnostics = {}, {}
        for k in range(2, min(24, n-1)+1):
            labels = cut_hierarchy(children, n, k)
            sizes = np.bincount(labels).tolist()
            assignments[str(k)] = labels
            diagnostics[str(k)] = {'sizes': sizes, 'largest_fraction': max(sizes)/n,
                                    'singletons': sizes.count(1),
                                    'cosine_silhouette': float(silhouette_score(distance, labels, metric='precomputed'))}
        methods[method] = {'linkage': method, 'distance': 'cosine', 'input_dimensions': DIMENSIONS,
                           'input_space': 'full_feature_space', 'children': children, 'distances': distances,
                           'representatives': representatives, 'labels_by_k': assignments,
                           'diagnostics_by_k': diagnostics}
    neighbors = [[{'index': int(j), 'cosine_similarity': float(np.clip(1-distance[i, j], -1, 1))}
                  for j in np.argsort(distance[i], kind='stable') if j != i][:8] for i in range(n)]
    vector_hash = hashlib.sha256(original.tobytes()).hexdigest()
    version = 'source-hierarchy-explorer-v1'
    identity = hashlib.sha256((vector_hash+version+np.__version__+sklearn.__version__).encode()).hexdigest()
    return {'version': version, 'run_id': f'source-hierarchy-{identity[:16]}', 'vector_hash': vector_hash,
            'evaluation_space': 'full_3072_cosine', 'methods': methods, 'neighbors': neighbors}


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
                'vector_description': 'OpenAI text-embedding-3-large, full 3072-dimensional cached source vectors'+(' via Vercel production AI Gateway (Azure endpoint)' if embedding_configuration.get('transport')=='vercel_ai_gateway_production' else ''),
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
    artifact['hierarchy'] = analyze_hierarchy(x, artifact['clustering'])
    return artifact, arrays

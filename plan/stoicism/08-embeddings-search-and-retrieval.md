# Embeddings, literal search and retrieval plan

## Retrieval is an independent capability

The user must be able to find a canonical passage, search exact language and inspect neighboring material before any cluster or synthesis exists. Clustering proposes organization; retrieval provides candidates; neither certifies that a conclusion is supported exhaustively.

Maintain source retrieval separately from generated material. The original-source index must never be replaced by embeddings of summaries because those summaries are shorter or easier to organize.

## Fixed source embedding contract

```yaml
provider: openai
model: text-embedding-3-large
dimensions: 3072
similarity: cosine
cache: true
```

The full requested dimensions are mandatory for this initial source index. Do not silently use a small model, shortened vectors, a different provider or TF-IDF while keeping the requested model label. Large vectors are a starting configuration, not evidence of superior philosophical discrimination.

Use separate typed collections for canonical passages, selected source spans, reviewed propositions and concept descriptions. Their input construction, revisions and evaluation purposes differ. A search result must state which collection produced it.

## Processing entry conditions

Before sending any source text, verify approved import/segmentation, applicable external-processing consent, account credentials, model availability, current API limits and a bounded budget. None is implied by the existence of this plan or the development session.

Use official OpenAI documentation during implementation to verify token limits, accepted request shape, dimensions and batching. Record the verification date. Do not freeze an uncertain limit from memory into the worker or silently truncate inputs to make requests succeed.

## Input construction and identity

Persist the complete embedding input or a privately recoverable input artifact, source/entity revision, text hash, normalization version, model, dimensions, request parameters and input-construction version. Cache using the complete input and configuration, not a mutable passage ID.

Decide explicitly whether a source reference prefix is included in embedding text. If included, it is part of the cache identity and a versioned experiment. Do not accidentally embed publisher marketing, footnotes or unrelated neighboring passages under one canonical section’s identity.

Long sections retain canonical identity. If an input exceeds a verified limit, stop or create meaningfully bounded child chunks with exact parent ranges. The application must not silently cut the end of a passage or replace its canonical unit with arbitrary windows.

## Exact cosine baseline

Store full float32 vectors with typed revision metadata. Validate dimension, finiteness, norm and model/configuration before indexing. Reject missing/zero/non-finite vectors with an explicit per-item error. Do not fill failures with random vectors or zeros.

Use exact cosine similarity as the first retrieval implementation. Keep the original vectors; any normalized matrix used for efficient search is a reproducible derived representation. Record how ties, exclusions and missing records are handled.

A nearest-neighbor result is a candidate, not an evidence link. The user or grounded synthesis workflow must inspect actual spans and determine supports, qualifies, challenges or another relation. Similarity scores should not be labeled probabilities of entailment.

## Literal and canonical lookup

Support text search, exact-phrase search and edition-aware book/section navigation. Normalize the query for search as needed, but show results in exact source text and keep a route to canonical anchors.

Handle punctuation, accented characters, repeated phrases and alternate numbering subdivisions deliberately. A search normalization must not become the source quotation representation. Search across the whole author corpus even when the current concept filter is narrow.

Provide context expansion and source-order navigation. Empty results should suggest a different query or reference format, not invent a plausible passage or silently search another translation.

## Queue, batching and restart

Before each request, tokenize with the selected model’s verified tokenizer/configuration and record the count. Batch conservatively within verified request/input limits. Persist successful results immediately and checkpoint the next item. A restart should identify completed input/configuration hashes and avoid re-embedding them.

Retry transient failures with bounded backoff. Treat authentication, unsupported model/settings, input-length and dimension errors as different classes. Cancellation stops new requests but still records the known outcome of in-flight work. Unknown outcomes after connection loss remain unknown rather than being described as free or exactly-once billed.

Reserve budget before dispatch. Keep estimated and observed usage/cost separate. Do not permit the model or worker to increase its own authorization.

## Retrieval evaluation

After real import, create human-reviewed queries with relevant passages, difficult non-relevant near neighbors and qualifying/conflicting material. Include direct language, conceptual queries, short and long passages, negation, shared vocabulary with disagreement and material spanning books.

Keep a held-out portion outside prompt/query tuning. Measure recall at declared cutoffs, failure categories and whether qualifications are retrieved, not only whether a convenient supporting example appears near the top. Do not use synthetic fixture retrieval scores as evidence of real-corpus quality.

## Completion gate

Literal and reference search work independently. Semantic search uses the fixed full-dimensional source vectors, returns exact source identities, resumes without re-embedding unchanged inputs, and has an honest human-reviewed evaluation report. No nearest-neighbor result automatically becomes a reviewed philosophical conclusion.

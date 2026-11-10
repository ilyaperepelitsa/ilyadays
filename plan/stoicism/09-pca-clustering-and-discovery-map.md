# PCA, clustering and the two-dimensional discovery map

## Required product correction

A real discovery map is a requested capability, not an optional decorative diagram. The current implementation has no PCA/cluster explorer. Add an explicit discovery route or workspace tab with a linked map, cluster list, source inspector and route back to the evidence editor.

The chart must plot coordinates produced by a recorded PCA fit. Cluster colors must come from a recorded clustering run in the declared computational space. A map with hand-positioned points or synthetic coordinates labeled as source embeddings is not an acceptable shortcut.

## Data modes and honest availability

Real-corpus mode requires an approved selected corpus and the requested full-dimensional embeddings, with consent/budget gates satisfied. Before that, a fixture mode may use declared synthetic vectors and original synthetic text to demonstrate the actual mathematics and interaction.

The fixture label must state that its vectors are not OpenAI embeddings and that its clusters are not findings about Marcus. Do not quietly use lexical features as a substitute for the requested production embedding model. If a demonstration uses another mathematical input, name it plainly and keep its records separate.

A public fixture explorer may use precomputed artifacts produced by real local PCA/clustering code over the declared fixture data. Do not generate a new random map on every page load. Private corpus vectors and full source text stay out of hosted public assets.

## Input matrix contract

Each row identifies an immutable source or derived-entity revision. A run records ordered row IDs, input vector hashes, origin/model, dimensions, normalization, excluded/error rows and software/configuration versions.

Validate finite values, nonzero norms, consistent dimensions and adequate sample count. Define the policy for missing vectors explicitly: omit with a visible report or block the run. Never silently replace missing rows with zero/random values or drop awkward outliers because they harm the visual appearance.

Canonical passages are the baseline collection. Smaller spans, propositions and concepts are separate layers. Do not mix them in one unlabeled point cloud or count repeated translations of one passage as independent recurrence.

## PCA computation

Use an explicit preprocessing pipeline. For cosine-based embeddings, row normalization can make the angular interpretation consistent, but record whether it was applied. Center the chosen input for ordinary PCA. Do not confuse row normalization with per-feature standardization, and do not turn standardization on without a justified experiment.

Fit a real two-component projection when rank and sample count permit it. Persist the mean, components/loadings, singular values or relevant fitted state, explained variance and explained-variance ratio. Report PC1 and PC2 values from that fit. If rank is inadequate, show the limitation rather than fabricating a second informative axis.

Persist projected coordinates together with the fit identity. PCA signs may reverse without changing the geometry; compare equivalent fits appropriately and preserve an accepted stored orientation for continuity. Near-degenerate eigenspaces may rotate, so a changed visual orientation is not automatically a new philosophical result.

The initial implementation should prefer a predictable solver/configuration for this corpus size. When a randomized solver is used, persist its seed and explain reproducibility limits across software/BLAS versions. Do not make up a variance percentage for a screenshot.

## Clustering baseline

Use average-linkage agglomerative clustering with cosine distance as the initial hierarchy proposal. The full-dimensional vector space is the baseline. Ward linkage is not the cosine option. Follow the verified scikit-learn API for the pinned version and record the exact configuration.

The two-dimensional projection is for exploration, not the authoritative clustering space. Optional moderate-dimensional PCA clustering comparisons must be labeled as separate experiments and compared with the full-space baseline. Store the representation and retained variance used by each comparison.

Persist the hierarchy, merge distances where available, row ordering and cut configuration. Changing the cluster count/cut should create or select a reproducible assignment artifact; it must not erase curated labels, accepted memberships or manual exclusions.

## Map interaction

The map view should provide:

- Axes labeled PC1/PC2 with explained variance and a compact run/corpus summary.
- Clearly identified cluster proposals and unassigned/error rows.
- Point hover/focus with canonical reference, excerpt preview and run identity.
- Point selection linked to the exact source inspector and the writing desk.
- Cluster selection linked to a sortable passage list and representative/borderline material.
- Search/reference lookup that highlights a point even when its cluster is not currently selected.
- Zoom/pan and a reset action without losing the selected source.
- Keyboard-accessible point or linked-list navigation and a table alternative.

Lasso/brush selection can be a later enhancement, but it should create a selection set, not automatically accept concept memberships. Plot proximity is a geometric observation; support and disagreement require textual review.

## Visual encodings

Use cluster colors only for computational cluster identity in this view. Curated concepts and source-provenance colors need distinct selectable modes or separate labels. Do not overload a point’s fill to mean cluster, evidential support, centrality and personal importance at once.

A passage with multiple curated memberships may show compact labeled chips, an accessible multi-membership marker or a selected-layer outline. Do not assume it must sit midway between two concepts or that those concepts must be adjacent in 2D.

Avoid decorative density contours or confident cluster names before there is enough evidence to interpret them. Representative source references, disagreement flags and a list of inspected material are more useful than an authoritative-sounding label.

## Run/artifact schema

```text
ProjectionRun
  id, corpus_revision, collection_type, ordered_entity_revisions
  vector_input_hash, vector_origin, model, dimensions
  preprocessing_version, solver/configuration, seed_if_used
  fitted_artifact_hash, coordinates_hash
  explained_variance, explained_variance_ratio
  software_versions, created_at, exclusions, validation_report

ClusterRun
  id, vector_input_hash, representation_run_if_any
  distance=cosine, linkage=average
  hierarchy_artifact_hash, cut_configuration, assignment_hash
  software_versions, created_at, validation_report
```

References to fitted private artifacts are preferable to embedding large arrays in UI metadata. A public demonstration artifact may include the small declared synthetic input needed to reproduce its computations.

## Numerical and interaction checks

Compare projected coordinates with the stored fit, allowing mathematically equivalent sign changes in independent recomputations. Verify explained variance against the fitted matrix and check that repeated identical input/configuration yields an identifiable reusable run.

Test non-finite/zero vectors, insufficient sample/rank, duplicate vectors, equal-distance ties, outliers, missing vectors, dimension mismatch and changed row order. Verify clustering receives the intended full-dimensional matrix rather than the chart’s two columns.

Browser tests must select a point and resolve its exact source, change a cluster cut without changing accepted concepts, use search and keyboard/list alternatives, and retain selection after resize. A fresh page and an old upgraded workspace both need the map.

## Completion gate

The user can explore a genuine computed PCA view with cluster proposals, inspect the exact inputs and limitations, and move from a point or cluster into source-grounded editing. The system neither labels a fixture as real-corpus analysis nor treats a visually neat plot as proof of a neat philosophy.

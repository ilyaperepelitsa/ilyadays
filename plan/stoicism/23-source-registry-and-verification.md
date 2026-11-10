# Source registry and technical verification plan

## Registry purpose

This file distinguishes user-selected requirements, inspected repository evidence, checked acquisition metadata and technical references that must be reverified during implementation. It is not an imported philosophical reference corpus and contains no full translation text.

A link is not proof that an account can download an unrestricted file, call a model or use a particular library setting. Record the actual observation and its limits. Use primary documentation for technical choices and preserve dates/versions where relevant.

## User-selected primary and comparison editions

| Item | Source | Recorded role and limit |
|---|---|---|
| Hays Meditations: A New Translation | [Penguin Random House](https://www.penguinrandomhouse.com/books/6367/meditations-by-marcus-aurelius/9781588361738/) | Primary edition; ISBN 9781588361738; publisher listing does not prove unrestricted importability |
| Waterfield Meditations: The Annotated Edition | [Hachette](https://www.hachettebookgroup.com/titles/marcus-aurelius/meditations/9781541675605/) | Optional comparison; ISBN 9781541675605; no mandatory second purchase |
| Checked Hays retailer listing | [Kobo](https://www.kobo.com/gr/en/ebook/meditations-20) | Existing acquisition ledger records EPUB3 with Adobe DRM; territory-dependent listing |
| Checked Waterfield retailer listing | [Kobo](https://www.kobo.com/ww/en/ebook/meditations-207) | Existing ledger records EPUB3 with Adobe DRM; retailer date differs from publisher date |

The repository’s acquisition ledger was recorded on 2026-11-10. Before recommending a purchase, recheck the exact territory/edition, downloadable format, restrictions and importer compatibility. No unrestricted source file is established by these planning records.

## Requested model and API references

- [OpenAI embeddings guide](https://developers.openai.com/api/docs/guides/embeddings): implementation reference for embedding inputs, dimensions and retrieval practices.
- [OpenAI text-embedding-3-large model](https://developers.openai.com/api/docs/models/text-embedding-3-large): verify availability and current model details before a live adapter is enabled.
- [OpenAI embedding API reference](https://developers.openai.com/api/reference/resources/embeddings/methods/create): verify accepted request settings, token/input limits and response metadata during implementation.
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): verify current Responses API/SDK schema, refusal/incomplete behavior and supported JSON-schema constraints.

The fixed requested configuration is not permission to call the API. Account access, source-processing consent, credentials and budget remain separately required. Do not infer a current price, account entitlement or exact runtime model identifier from these links.

## Numerical analysis references

The official [scikit-learn PCA documentation](https://scikit-learn.org/stable/modules/generated/sklearn.decomposition.PCA.html) is the reference for the chosen implementation’s fitted components, variance fields and solver configuration. Pin a compatible version after inspecting the environment; do not assume the documentation branch equals an installed package.

The official [AgglomerativeClustering documentation](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.AgglomerativeClustering.html) is the reference for average-linkage cosine configuration and hierarchy outputs. Confirm the actual API parameter names for the pinned version. The project requirement remains full-dimensional baseline clustering rather than treating the two-dimensional plot as the authoritative space.

Persist package versions and numerical configuration in every run. Official algorithm documentation does not establish that the resulting groups are philosophically sound; that remains an editorial evaluation question.

## Editor and backend references

Use the official [Tiptap UniqueID documentation](https://tiptap.dev/docs/editor/extensions/functionality/uniqueid) to verify configured node types, stable identity and behavior across editing operations. Provenance marks, target mappings, invalidation and connectors remain custom application work, not capabilities guaranteed merely by installing UniqueID.

Use official [ProseMirror documentation](https://prosemirror.net/docs/) for document positions, transactions, mappings, plugins and decorations when implementing precise editing behavior. Verify behavior against the pinned Tiptap/ProseMirror versions with actual split/merge/paste/undo tests.

Use official [FastAPI documentation](https://fastapi.tiangolo.com/) and [SQLite documentation](https://www.sqlite.org/docs.html) for service/database implementation details. These references do not replace tests for the repository’s specific local boundary, migration and graph constraints.

## Repository evidence

| Evidence path | What to inspect |
|---|---|
| `src/components/aurelius/SourceText.tsx` | Existing source interval rendering and contributor selection |
| `src/components/aurelius/ProvenanceEditor.tsx` | Current grounding mark and editor invalidation behavior |
| `src/components/aurelius/EditorialCard.tsx` | Meaning/expression forms, draft and review interactions |
| `src/components/aurelius/EvidenceConnectors.tsx` | Stored-link neighborhood and geometry behavior |
| `src/lib/aurelius/domain.mjs` | Current exact-anchor and editorial command invariants |
| `src/lib/aurelius/persistence.ts` | IndexedDB seed, compare-and-swap and private service selection |
| `apps/aurelius/aurelius/store.py` | Private SQLite persistence and command bridge |
| `apps/aurelius/migrations/` | Existing relational tables and graph constraints |
| `content/aurelius/fixture.json` | Five-passage/one-conclusion inspection baseline |
| `docs/aurelius/implementation-log.md` | Actual initial delivery scope and known limitations |

## Re-verification record

For each consequential external claim, record source URL, checked date, observed detail, version/territory/account context, uncertainty and the implementation decision it supports. Do not store credentials or copyrighted full text in this registry.

A later session should reverify changing technical or acquisition details before relying on them, while retaining the historical observation that supported an earlier artifact. The registry’s job is to make assumptions inspectable rather than to create an appearance of authority through a long bibliography.

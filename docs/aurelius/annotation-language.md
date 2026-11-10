# Aurelius annotation language v1

The annotation document describes exact pieces of source text and their roles in an argument. It is a sidecar: it never inserts tags into the imported translation. `Annotations` in the workbench edits, previews, validates, saves and exports this format. Select text on the left and choose **Annotate this piece** to start with a smaller exact selection.

The portable syntax is strict JSON, identified by `aurelius-annotations-v1`. JSON is deliberate: ordinary editors, schemas and model Structured Outputs can use the same unambiguous representation, without inventing escaping rules for punctuation inside a translation. No model processing is performed by the annotation editor.

```json
{
  "format": "aurelius-annotations-v1",
  "target_revision": "conclusion:r1",
  "pieces": [
    {
      "id": "premise",
      "passage_revision": "passage:immutable-text-hash",
      "quote": "An exact piece of original synthetic text.",
      "prefix": "",
      "suffix": "",
      "role": "reason",
      "voice": "author",
      "note": "What this piece asserts, and why this role is proposed."
    }
  ],
  "relations": [
    {
      "from": "premise",
      "to": "conclusion:r1",
      "relation": "supports",
      "rationale": "Which limited part of the conclusion follows, and why."
    }
  ],
  "inference": {
    "premises": ["premise"],
    "rationale": "The explicit joint inference, including any bridge assumption."
  }
}
```

This example is synthetic syntax, not a quotation from Marcus and not importable into an unrelated edition. Replace every source and target identity with actual workspace revisions.

| Field | Meaning |
| --- | --- |
| `role` | `claim`, `reason`, `analogy`, `objection`, `reply`, `qualification`, `question`, or `argument` for a compound piece not yet split |
| `voice` | `author`, `interlocutor`, `editor`, or `mixed`; a quoted objection is not automatically the author's view |
| `quote` | Exact, unchanged substring, including punctuation, line breaks and combining marks |
| `prefix` / `suffix` | Exact adjacent context; required to disambiguate repeated matches |
| `relation` | `supports`, `qualifies`, `challenges`, `illustrates`, `depends_on`, `paraphrases`, `editorial_extrapolation`, or `answers` for an objection/reply connection |
| `inference.premises` | The pieces used jointly; other inspected or countervailing pieces may remain outside this set |

Relations can connect one piece to another or to the selected conclusion revision. Their argument graph must be acyclic. A piece may have multiple connections. An analogy can illustrate a claim without independently proving it. Shared subject matter is not a support relation.

The validator resolves the quote in its immutable passage revision, checks the text hash, rejects ambiguous matches and stores Unicode scalar, half-open offsets together with exact text and context. An invented quote fails; an eloquent interpretation does not get a validity exception. Python rechecks the persisted exact anchors. Browser positions continue to use the existing explicit UTF-16/scalar conversion.

Saving appends an immutable annotation run. SQLite stores the run and its pieces relationally; browser workspaces retain the same payload in IndexedDB. The run records its exact target revision. Saving marks that target's support assessment and dependent expressions stale. It does not modify evidence links, approve claims, overwrite older annotations or transfer annotations to a newly edited conclusion. Locked decisions require unlocking before a new annotation revision can be saved.

**Mechanical validity and philosophical fidelity remain separate.** Preview is provisional, validation checks source/structure, and annotation review is always `proposed` in v1. There is no automatic human approval. Existing source-argument annotations seed the initial draft, with `mixed` voice for the objection/reply span. Users can split that span into separately quoted pieces and connect a reply with `answers`.

JSON export is available after validation for the synthetic and public-domain study. Modern-translation export remains disabled by the current private-source policy. Source files, credentials and private annotation outputs remain ignored. A future shareable format must exclude the source translation and flag quotations for rights review.

Later increments: editor-native role marks and source-to-meaning clause annotations, a JSON Schema for runtime structured generation, annotation review UI, graph inspection, and diffing argument changes. The current language/editor is usable manually; it is not a completed automated argument extractor.

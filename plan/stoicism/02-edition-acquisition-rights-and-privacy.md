# Edition acquisition, rights assumptions and privacy boundary

## Selected editions

The primary edition is Gregory Hays’s Meditations: A New Translation, ebook ISBN `9781588361738`, published by Modern Library / Random House Publishing Group. This is a readability and editorial preference, not a claim of objective superiority over every other translation.

Robin Waterfield’s Meditations: The Annotated Edition, Basic Books, ebook ISBN `9781541675605`, is optional comparison material. It can help resolve interpretive questions, but the application must work without requiring a second purchase.

Official acquisition entry points are the [Hays publisher page](https://www.penguinrandomhouse.com/books/6367/meditations-by-marcus-aurelius/9781588361738/) and the [Waterfield publisher page](https://www.hachettebookgroup.com/titles/marcus-aurelius/meditations/9781541675605/). The repository records the checked retailer formats in `content/aurelius/editions.json` and `docs/aurelius/acquisition.md`.

## Current acquisition status

The inspected ledger says neither edition has been acquired for this application. The checked Kobo offerings list EPUB3 with Adobe DRM. The existence of an ebook listing does not establish an unrestricted, text-readable EPUB that this importer can process.

Treat those details as dated acquisition evidence, not a guarantee about every territory or retailer. Recheck format, restrictions, exact edition identity and the user’s territory before making a purchase recommendation. Do not infer importability from a cover image, generic EPUB label or reading-app availability.

No automatic purchase, unauthorized download, library-access bypass or DRM circumvention belongs in the implementation. An ACSM fulfillment file is not the book’s readable text. Ownership does not itself establish permission to redistribute or externally process the translation.

## What the user needs to supply

The preferred input is an authorized, text-readable, unencrypted EPUB of the selected Hays edition. Authorized HTML or plain text is an acceptable alternative if it retains enough structure to recover canonical numbering and source context. Text-bearing PDF comes later; OCR is not the starting route.

Collect the actual file together with acquisition location, edition/ISBN, acquisition date when known, applicable restrictions and the user’s processing assumptions. Preserve unknown values as unknown. Do not invent a purchase record or describe a file as publisher-authorized solely because the user owns a print copy.

If no importable file is available, present the import requirements, retain the selected edition and continue with original synthetic fixtures. Do not substitute another translation under the Hays edition ID.

## Separate approval records

| Gate | What is approved | What it does not approve |
|---|---|---|
| File intake | Receiving and privately storing this identified file | Segmentation correctness or external processing |
| Corpus approval | The inspected author-text segmentation and exclusions | Paid embedding or generation requests |
| External processing consent | Specific source material may be sent to the named provider for stated purposes | An unlimited budget or public redistribution |
| Budget authorization | Bounded work under explicit token/cost/item limits | Changes to source rights or automatic human approval |
| Shareable export review | Specific output is suitable for the chosen sharing mode | Bundling the entire source translation |

Store versioned consent and approval records. Changes to provider, source scope, material sent or processing purpose must be checked against the existing approval rather than assumed covered. The UI should explain what will leave the machine before requesting genuine new consent.

## Private storage layout

Use ignored private storage with restrictive file permissions. A proposed layout is:

```text
.aurelius/
  imports/<acquisition-id>/original.epub
  extracted/<import-run-id>/raw/
  normalized/<normalization-run-id>/
  vectors/<embedding-run-id>/
  projections/<analysis-run-id>/
  exports/private/
  backups/
  aurelius.sqlite3
```

These paths are illustrative contracts, not a claim that all processors exist. The current local database is already under ignored `.aurelius/`. Never store full book files or extracted author text under `public/`, checked-in `content/`, route props, tracked fixtures, screenshots intended for publication or debug logs.

Do not assume a path is private merely because it is local. Validate the configured storage root against public asset/source directories. A browser preview may need source text in local memory, but that does not authorize uploading it to a hosted database, model or analytics endpoint.

## Local and hosted product modes

The private service binds to loopback. Production hosting must not acquire a hidden rewrite to a developer’s private API. The public page can demonstrate synthetic work and interactions, but it cannot import or expose a private corpus.

Use explicit capabilities rather than a vague environment label. The public browser demo should report that it can edit synthetic data and cannot import private books. The private app should report the selected corpus and source-processing status. A local service failure must not silently replace the user’s private project with a new empty browser demo.

## Content and authorship separation

The primary author corpus contains Marcus’s numbered author-text passages in the selected translation. Introductions, forewords, translator commentary, footnotes, publisher descriptions and marketing endorsements belong in separately attributed records.

Comparison editions are witnesses to the same underlying passages, not extra independent pieces of evidence. Preserve their own boundaries and numbering. A translator’s note may support an interpretation of a difficult word, but it should not appear as something Marcus wrote.

## Export assumptions

Private-study exports and shareable exports are different operations. Shareable mode should exclude the full translation by default, retain references and provenance identifiers, and flag quoted material for rights review. The software should describe the selected policy and unresolved restrictions; it should not make an unsupported legal determination.

A user-authored formulation can still contain long quotations or unusually close derivative wording. Export review needs quote detection, evidence summaries and explicit uncertainty. Do not use the public-domain status of Marcus’s ancient Greek work to imply that the modern translation has no separate rights.

## Completion gate

This workstream is complete for a real import only when the exact file is identified, its format is actually readable, acquisition/restriction metadata is recorded, private storage is verified, and the relevant user approvals are separate and inspectable. Until then, the honest status is blocked on a source file, while non-source implementation work can continue.

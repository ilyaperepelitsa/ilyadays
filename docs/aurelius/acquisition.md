# Edition acquisition and import plan

Verified 2026-11-10 against the publisher and retailer pages below. No purchase or source-file download was made.

| Role | Work/edition | Translator | Publisher | Ebook ISBN | Acquisition | Actual format/access | Importability |
|---|---|---|---|---|---|---|---|
| Primary | Meditations: A New Translation, ebook released May 14 2002 | Gregory Hays | Modern Library / Random House Publishing Group | 9781588361738 | Not acquired | Kobo lists EPUB3, Adobe DRM; publisher lists ebook but does not promise an unrestricted file | No importable authorized file verified; do not buy this listing for import on that assumption |
| Optional comparison | Meditations: The Annotated Edition, publisher ebook April 6 2021 | Robin Waterfield | Basic Books | 9781541675605 | Not acquired; optional | Kobo lists EPUB3, Adobe DRM (retailer date differs from publisher date) | Same restriction; second purchase not required |

Official acquisition entry points: [Hays publisher](https://www.penguinrandomhouse.com/books/6367/meditations-by-marcus-aurelius/9781588361738/), [Waterfield publisher](https://www.hachettebookgroup.com/titles/marcus-aurelius/meditations/9781541675605/). Checked retailer details: [Hays Kobo](https://www.kobo.com/gr/en/ebook/meditations-20), [Waterfield Kobo](https://www.kobo.com/ww/en/ebook/meditations-207). Availability and access can differ by territory; no unrestricted download has been verified. ACSM is an access/fulfilment file, not readable book text. A Kindle/reading-app purchase likewise does not establish importability.

## What to supply for Stage 2

An authorized, text-readable, unencrypted Hays EPUB, or publisher-authorized HTML/plain text of the same translation. Include edition/ISBN, acquisition location, permitted-processing notes and any reuse restrictions. If unavailable, request an authorized accessible file from the publisher/retailer; do not remove DRM. Store the original in `.aurelius/imports/`, never in public/ or content/. PDF support comes later and must be text-bearing. No introductions or commentaries enter the author-text corpus.

Stage 2 must inspect the actual file before selecting parser boundaries. Preserve spine/source order and canonical book/section labels without assuming a passage count; report missing/duplicate labels, notes, artifacts, exclusions and ambiguous boundaries. Keep raw extraction, normalized text and their offset map/version separately. Record file hash/parser version. Require explicit segmentation approval before any production corpus processing.

Ownership is not treated as redistribution permission. Local personal-study processing is an assumption to confirm for the supplied file, not a legal determination. Private source storage is not consent to external model processing. Shareable exports must exclude the source translation by default and flag quotations for rights review. Stage 1 offers synthetic project export only, not manuscript export or real-book import.

## User-provided archive candidate, 2026-11-10

Candidate URL: https://archive.org/stream/meditation-GeorgeHays/meditations-GeorgeHays_djvu.txt . Metadata endpoint checked: https://archive.org/metadata/meditation-GeorgeHays . The item is in the community folkscanomy collections; its description says “Translated by George Hays.” Creator, publisher, date, rights and license fields were absent in the returned metadata. The text file is listed as a 340,492-byte DjVuTXT derivative. This establishes an accessible candidate format, not the selected edition identity or authorization to use the copy.

The full text has not been downloaded or imported. Authorization/edition verification is pending; no DRM bypass, OCR pipeline or external model call has been performed. If accepted as an authorized source, privately inspect the text for actual Gregory Hays edition details and extraction artifacts before approving canonical segmentation. A downloadable URL alone is not treated as corpus approval or external-processing consent.

## Subsequent user-directed extraction and backup selection

The user explicitly requested real extraction/embeddings from the supplied candidate, and supplied Project Gutenberg 2680 as a backup. Both files were downloaded into ignored private storage. The archive `/stream/` URL is an HTML viewer; the actual `/download/` DjVuTXT file is 340,492 bytes, SHA-256 `ab14978781d3f7367387be9aaf577fe95eda6c05a98ec574d342b908aea36789`. Its internal title/copyright pages identify Gregory Hays, the 2002 Modern Library edition and e-ISBN 1-58836-173-X (9781588361738). This supports edition identification; it does not authenticate the uploader or establish redistribution rights. Processing is treated as user-directed private study; full text remains ignored and never enters the hosted source bundle.

The numbered-text-v2 parser recovers 488 Hays sections with no missing or duplicate canonical labels. It reports three damaged marker forms (1.11 `ll.`, absent spacing at 6.32 and 8.42), five bracketed lacunae and an OCR punctuation anomaly at 8.44. Recognition decisions affect boundary metadata only; wording stays unaltered. Introductory/translator/end matter is preserved separately, with three book subtitles/epigraphs flagged for review. The exact raw source ranges and hashes are in the private inspection report. This is text parsing, not a new OCR pipeline.

[Project Gutenberg 2680](https://www.gutenberg.org/ebooks/2680) supplies a [readable UTF-8 text file](https://www.gutenberg.org/cache/epub/2680/pg2680.txt). The text identifies the translation as Meric Casaubon (its end notes describe comparison of the 1634/1635 editions). The official listing says public domain in the USA. The parser finds 418 edition-specific sections after recovering six sequential inline/missing-period marker forms; no section labels are missing or duplicated after recognition. Its numbering is not assumed equivalent to Hays. The complete imported file and license remain private; only three source passages selected for the public editorial study are included in the site.

The fixed OpenAI embedding adapter is implemented and tested with mocks. A concrete preview estimates 47,013 Hays input tokens and 75,076 backup input tokens, with separate exact-corpus hashes. No paid API request has been made at this checkpoint. The pending approval request covers import review, external processing and a $0.10 combined cap; credentials are not present in the process or local env file. Do not treat a proposed interpretation, successful regex parse or mock vector as human approval or a completed embedding run.

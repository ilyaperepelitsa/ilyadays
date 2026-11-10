# Import, segmentation and corpus-inspection plan

## Outcome and entry gate

Import should produce an inspectable edition-specific corpus, not an unreviewable blob of extracted text. The user must be able to compare every parsed passage with its source, identify excluded material and approve the resulting segmentation before production processing begins.

Entry requires an authorized readable file and the acquisition record described in plan 02. Keep an unmodified original and calculate its hash before parsing. A failed parse must not overwrite an already approved corpus or silently switch translators.

## Import run contract

An import run records the edition ID, acquisition ID, original file hash, detected format, parser/build version, normalization version, configuration, start/end time, output artifact hashes, warnings, exclusions and approval state. Repeating an identical run should be identifiable as the same input/configuration, while an intentionally new parser version creates a new run.

Persist the original, raw extracted fragments, a structural manifest, candidate canonical passages, separate non-author material, normalization maps and the inspection report. Do not make a single generated JSON file the only surviving evidence of how the corpus was obtained.

## Safe EPUB processing

Treat an EPUB as an untrusted archive. Validate archive entries before extracting anything. Reject absolute paths, traversal, symlinks escaping the private root, duplicate/conflicting names, unreasonable entry counts and decompression expansion. Set compressed and expanded size limits and fail with a useful error rather than partially extracting arbitrary paths.

Read the package manifest and spine to preserve declared reading order. Do not alphabetically sort chapter filenames or assume each XHTML file is one canonical book. Preserve source file names and element locators as supplementary references.

Disable active content. Do not execute scripts, load remote images/styles/fonts, follow external references or render imported HTML as active application markup. Use a conservative inert text/structural parser. Preserve the raw extracted representation for audit even when the readable preview is sanitized.

Detect encryption and access restrictions. Do not implement a path that repairs protected files by removing DRM. Report unsupported or encrypted files as import blockers with the selected edition intact.

## HTML and plain-text alternatives

For authorized HTML, accept a bounded local file or a clearly enumerated local set with a manifest. Separate the source acquisition location from the local filename. Sanitize markup, preserve structural headings and avoid fetching remote assets.

For plain text, detect encoding deliberately and preserve the original bytes. Report replacement characters, suspicious decoding or inconsistent line endings. A user-supplied plain-text file may lack canonical labels; that creates a segmentation-review task, not permission to fabricate references.

PDF belongs in a later adapter. It must contain selectable text, and extraction order/page references require explicit inspection. An OCR dependency must not quietly appear in the initial import chain.

## Canonical segmentation

Use the edition’s existing book and numbered-section structure. Do not hard-code the expected number of passages before examining the actual edition. Maintain edition-specific subdivisions and avoid assuming that another translator’s paragraph layout matches Hays.

A candidate passage stores stable logical identity, immutable text revision, edition, book/section labels, raw source locator, supplementary EPUB/page location and original order. When a passage contains several ideas, retain it as the canonical unit and create smaller overlapping spans for analysis.

Long passages may have meaningful child chunks. Every child retains the parent reference and exact source range. Arbitrary fixed-length windows must not replace the canonical section or become fake book/section references.

## Authorship and exclusion decisions

Create explicit records for introductions, forewords, commentary, footnotes, copyright matter, tables of contents and publisher material. Each record states why it is excluded from Marcus’s primary author corpus and its actual author when known.

Do not discard footnote markers silently. Either associate a marker with separately attributed note material or flag it as unresolved. If a note has been accidentally interleaved with an author paragraph, the inspection screen must make that boundary visible and editable.

## Raw-to-normalized mapping

Keep raw text immutable. Normalization is a versioned processing view, not a destructive cleanup step. Record every relevant transformation, including whitespace joining, soft hyphen handling, ligatures and line-break artifacts. Do not normalize away distinctions that an exact quotation needs to preserve.

Use a reversible mapping from normalized scalar ranges to raw scalar ranges, with explicit ambiguous segments when the transformation is not one-to-one. Evidence anchors ultimately resolve to an immutable source revision. A model quoting normalized text must not bypass validation against the canonical source text.

Test non-BMP symbols, combining marks, typographic punctuation, nonbreaking spaces, repeated phrases and invisible characters. Display ambiguity rather than guessing which repeated occurrence a model intended.

## Inspection screen

Provide a source-order list with filters for warnings, ambiguous boundaries, exclusions, unresolved markers and duplicate/missing labels. Selecting a passage opens its raw context beside the normalized candidate, with the edition and source locator visible.

The reviewer can merge/split candidate boundaries, reclassify non-author material, correct labels and annotate decisions. These actions produce a new segmentation revision and a recorded rationale. They do not mutate the original file.

Approval should identify the exact manifest and segmentation hash. Further boundary changes invalidate that approval and dependent corpus artifacts. The screen must say whether all required decisions have been resolved, not merely offer a green button.

## Report and failure conditions

| Check | Required behavior |
|---|---|
| Missing or duplicate labels | List the affected candidates and source locations |
| Unexpected ordering | Show the manifest/spine order and detected sequence |
| Suspicious extraction | Identify artifact examples and their raw context |
| Footnote residue | Preserve unresolved markers and separately attributed notes |
| Empty or implausibly long units | Require inspection without dropping the text |
| Ambiguous boundary | Retain alternatives and block automatic approval |
| Unsupported format/DRM | Explain the blocker without altering the selected edition |

## Completion gate

The real corpus is ready when the original is preserved, canonical passages resolve to it, exclusions and authorship are reviewed, normalization is traceable, unresolved items are visible, and the user approves the exact segmentation revision. Embedding, clustering or synthesis may not be used to conceal a poor import.

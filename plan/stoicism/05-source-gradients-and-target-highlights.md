# Visible source gradients and target-provenance highlights

## Problem to solve first

The current default screen does not adequately communicate the intended source-to-meaning relationship. Left spans have restrained styling, the source renderer chooses one preferred span in an overlapping region, and the most obvious target gradient belongs to the optional expression pane. A user reasonably reports that there are no meaningful gradients on the left and no source tracking on the right.

Fix the default two-pane experience before adding decorative graph complexity. Several exact excerpts must visibly contribute to an editable teaching on the right. Opening a third pane should reveal a further layer, not unlock the only usable provenance.

## Two independent color languages

Theme mode uses concept colors. Source-provenance mode uses colors assigned to excerpts in the selected evidence bundle. Plain reading mode removes these color encodings while preserving references and review states.

Never simultaneously give a blue background the meaning of a concept and a source contributor. Use explicit legends and textual badges such as S1, S2 and S3. A source color is an identifier, not a probability, importance score or measured share of influence.

Changing the selected teaching can change the local source palette. Persist source identities and contributor sets, not an assumption that one global color permanently identifies all philosophical meanings.

## Left-hand source text

Partition displayed source text at every relevant exact-span boundary. For each interval, compute all stored contributing spans that cover it. Preserve the entire contributor set instead of picking only the first span or the currently preferred span.

A single contributor can use a visible soft background with a clear underline or subtle color-to-transparent gradient. Several genuinely overlapping contributors can use a multicolor gradient or segmented underline. A visual fade within one color must not imply multiple sources.

Unlinked candidate excerpts remain neutral. An exact source span can be selectable without being evidential support for the current teaching. Label the difference. Excluded discovery candidates should not disappear from an already accepted evidence bundle without an explicit evidence change.

## Right-hand meaning text

Create validated conclusion target spans. A supported clause receives the contributor set recorded for that clause or its joint bundle. The default meaning editor should immediately show these highlights, including qualifications and challenging material where relevant.

If only whole-statement evidence has been reviewed, highlight the statement at that granularity and label it “joint bundle, whole statement.” Do not infer word-by-word correspondence from lexical similarity or divide a sentence into colored word fragments because the evidence panel contains three links.

A source that qualifies a clause is not visually interchangeable with one that supports it. Combine color identity with relation text, an icon or a line treatment. The inspector should say what each excerpt establishes and where its force stops.

## Expression text

Expression mappings reference conclusion revisions first. The inspector can expand transitively to source spans. The displayed source-color set must correspond to the exact mapped conclusion/evidence revisions, including stale state.

New words, metaphors, examples or stronger promises do not inherit a reassuring gradient automatically. Distinctly mark unmapped additions. Neutral connective language may have a separate editorial-connective classification, but this is an explicit category rather than a loophole for unsupported claims.

## Inspector contract

Hover, focus or selection reveals:

- Target text and its immutable revision/block/range.
- Source references with translator/edition and canonical book/section.
- Exact supporting or limiting text and surrounding context access.
- Relation type and concise justification.
- Joint-versus-independent bundle role.
- Mechanical anchor validity, semantic review status and stale reason.
- A direct action to open the source or inspect the earlier reviewed version.

Keyboard users must receive the same information. The inspector must not require precise pointer movement across a narrow line. On touch devices, a stable tap/focus panel is preferable to a disappearing hover tooltip.

## Rendering and editor integration

Keep immutable persisted mappings separate from transient editor decorations. A decoration can be recomputed for the current viewport, but its contributor set must come from stored relationships. Use stable editor block IDs and transaction mappings for edits.

Represent spans with scalar ranges in immutable text and map them into editor positions explicitly. After an edit, remove or mark affected decorations stale. Conservatively invalidating a paragraph is preferable to claiming a newly inserted phrase has valid evidence. Preserve untouched mappings when that can be established mechanically.

CSS should make the background color visible enough at normal viewing size, with readable text in light and dark modes. Reserve saturated color for thin accents or focus states rather than painting large passages with unreadable fills. Test actual screenshots; a computed `linear-gradient` string alone does not prove the user can see the gradient.

## Connector behavior

Draw only the selected neighborhood by default. Recalculate endpoints after independent pane scrolls, resize, text wrapping, font load, editor transactions and collapsed/expanded context. Clip endpoints to visible regions and omit arrows to genuinely offscreen anchors.

A connector from a whole-statement bundle should terminate at the statement’s range or block, not a random word. Selection must remain correct even when several rendered DOM fragments correspond to one logical source span.

## Immediate work packages

1. Add a conclusion-target mapping schema and migration path.
2. Add a renderer for complete overlapping contributor sets on the left.
3. Add meaning-side highlights in the default two-pane editor.
4. Add a shared inspector and source identity legend.
5. Add explicit stale, unsupported and historical-revision styles.
6. Preserve expression mappings while making their transitive path inspectable.
7. Verify existing browser/SQLite projects and old fixture upgrades.

## Acceptance and failure checks

A default teaching shows two or more differently identified excerpts and an immediately visible right-hand contributor highlight. An overlapping left interval shows exactly its recorded contributors. A keyboard-focused clause lists exact references and relation types. A new unsupported phrase receives no source gradient. Editing creates a stale assessment without coloring new words as reviewed.

Test independent scrolling, wrapping at several widths, browser zoom, long Russian labels, dark mode, high contrast and reduced motion. Test a project whose evidence links refer to older revisions. Test a stored mapping with an invalid source ID and verify that the UI reports invalid provenance rather than rendering an authoritative color.

This workstream is complete only when the visible behavior passes in the default view, not merely when a new mark extension exists in source code.

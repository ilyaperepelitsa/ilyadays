# Editorial workspace and interaction plan

## Reader’s first task

The opening screen should answer: which teaching am I editing, which excerpts contribute, what is reviewed, what is still an editorial inference, and what can I change next? Keep this useful before clustering or automatic synthesis is available.

The default layout is sources on the left and meaning on the right. The optional third pane contains expression and manuscript placement. A discovery view is a linked exploration surface, not a replacement for the writing desk.

## Pane and navigation structure

Sources include canonical reference, exact highlighted spans, context, edition, notes and source-use navigation. Meaning includes statement, interpretation type, practical implication, scope, qualifications, assumptions, evidence bundle and review decisions. Expression includes alternative formulations, clause mappings, semantic differences and manuscript use.

Provide an efficient teaching navigator with several substantial items, not only a single dropdown entry. Show topic, review state and unresolved objections without making a hidden importance score the sole ordering. Preserve exact passage/reference navigation separately from thematic navigation.

Resize controls need pointer and keyboard operation. On narrow screens, offer an intentional source/meaning/expression switch or stacked focus layout with a persistent selected-teaching summary. Do not force users to scroll several screens to discover which source belongs to the text they are editing.

## Selection behavior

Selecting a conclusion clause highlights its contributing source spans and relevant relations. Selecting a source span reveals every current or historical teaching and manuscript expression that uses it. Selecting an expression follows its exact conclusion revision before expanding to sources.

The selection state should include entity/revision identity and range, not only a DOM node or a span color. If the selected mapping is historical, say so and provide a history route. Do not redirect it to the current revision and make stale evidence look current.

Selecting a concept opens relevant supporting, qualifying and challenging material. Keep full-corpus literal/reference search available; an early concept assignment must not trap the user inside one cluster.

## Manual editorial operations

The user can create a teaching, select exact source text, attach a relation, explain its role, revise or delete a link, split or merge a claim, record an alternative interpretation, approve/reject, lock/unlock and reorder manuscript items.

Distinguish a source exclusion from evidence deletion. Excluding a passage from a future discovery proposal does not remove an already reviewed source link. Likewise, rejecting one model-proposed conclusion does not delete the source passage from the corpus.

Split/merge operations should produce explicit successor relationships. A merged conclusion does not automatically inherit every source assessment from its predecessors. A split clause needs its own scope and support review. Preserve rejected alternatives so the editor can revisit why they were rejected.

## Draft lifecycle

Unsaved text or evidence changes must be visible. Approval is blocked while the relevant meaning, inference explanation, relation or expression has an unsaved draft. Draft text on screen must not be confused with the saved revision that an approval request would actually reference.

Provide save and explicit discard operations. Discard restores the saved revision; it does not transfer approval to a replacement. Navigating away or closing an expression pane should not silently destroy a draft. Prefer restoring drafts or blocking destructive navigation with a clear in-app choice over repeated generic permission prompts.

Concurrent tabs and service updates require optimistic concurrency. Report the conflict, keep the local draft, and offer comparison/reload/reapply. Do not silently merge philosophical text or choose the last writer.

## Review workspace

Show source validity separately from interpretation review. An exact anchor can be valid while the conclusion overreaches. A reviewed meaning can have an unreviewed formulation. An expression may sound excellent while adding an obligation that the source does not establish.

A review action should identify the exact revision, the evidence state inspected and the reviewer’s concise decision note. Resolved objections should remain inspectable with their resolutions rather than being erased solely to enable an approval button.

Locks apply to deliberate editorial decisions and should be explicit in both panes and background-job behavior. New computational results can be displayed beside a locked decision but cannot overwrite it.

## Context and comparison

Allow compact excerpt view with expandable surrounding passage and a full canonical reader. Context is necessary to inspect negation, rhetorical questions, conditions and the difference between personal reminders and general commands.

A comparison edition view should align edition-aware references cautiously. Display unresolved alignment or numbering differences. Two translations are not independent evidence, and translator commentary remains separately attributed.

## History and audit

Provide a timeline of text revisions, mapping changes, evidence reviews and relevant job outputs. A reviewer should be able to inspect the earlier evidence state of an approval, not only read an event saying “link edited.”

Show structural and semantic differences separately. A paragraph split or typography change may be structurally different without changing meaning; new scope, certainty or obligations are semantic review concerns. Conservative stale status is allowed when equivalence cannot be established.

## Interaction acceptance

The core scenario starts from a selected teaching, follows a clause to two sources, adds a qualification, saves a revision, observes stale support, revisits the previous reviewed revision, and rewrites an expression without automatic reapproval.

Run it with keyboard only, on a phone, after reload and after a conflicting-tab save. Run it with a locked item and with a source that participates in several teachings. The user should correct the structure without fighting automatic regeneration or losing manual decisions.

# Model adapters, durable jobs and budget control

## Explicit external-processing boundary

No source request is authorized merely because an API key exists, a plugin is connected or a development session can call a model. The project requires explicit approval for sending source text to the named provider, followed by a bounded budget for the intended run.

Store the source scope, provider, purpose, configuration and approval record. Display what leaves the machine and what remains local. A local database or local frontend does not make external inference local-only processing.

## Adapter separation

Provide a fixed embedding adapter for `text-embedding-3-large` at 3072 dimensions and a configurable generation adapter. Keep generation model selection separate from embedding configuration. Verify current model availability and supported settings during implementation, and record the exact returned model identifier.

Use OpenAI’s Responses API with Structured Outputs for typed extraction/synthesis records. Schema constraints are necessary but insufficient: application code still checks references, exact quotations, refusal/incomplete status, lineage and semantic review requirements.

Mock adapters are permitted for ordinary tests and demonstrations. They must visibly identify synthetic outputs and cannot create fake real-corpus run records, costs, user ratings or scholarly approvals.

## Work-item lifecycle

Support `process_this_selection`, `process_next_unreviewed_concept` and `run_bounded_batch`. A user should not need to orchestrate each request manually, but automation remains bounded and reviewable.

Use explicit states such as queued, running, proposed, validation_failed, awaiting_review, approved, rejected, canceled and stale. Approval remains a human action over an exact revision. The worker can propose and validate; it cannot mark its own philosophical output approved.

A work item records input revisions and hashes, prompt/schema versions, configuration, reservation, checkpoints, attempts, outputs, errors, review history and cancellation requests. A later job should be able to reuse completed intermediate stages rather than repeat the whole pipeline blindly.

## One-bundle pipeline

```text
retrieve candidates and counterevidence
  -> extract/refresh propositions
  -> assemble joint evidence and coverage note
  -> draft conclusion
  -> validate references and structure
  -> critique against original evidence
  -> present for human review
```

Keep outputs independently inspectable. The critique pass may reject the draft. A failed philosophical assessment is not the same as malformed JSON, and its repair must not be described as mere formatting cleanup.

## Budget reservation

Before dispatch, reserve conservative input/output allowances within authorized item, token and cost limits. Store estimated and observed amounts separately. Use current verified pricing/settings at implementation time; do not hard-code an uncertain price from memory into a supposedly exact budget display.

Budgets include maximum items, token/cost ceiling, maximum repair attempts, retry limits and repeated-failure stopping conditions. The model cannot raise its budget, turn on another provider or extend the batch because a result seems promising.

A budget exhaustion stop preserves completed work and clearly reports unfinished items. Do not call the corpus processed merely because the budget ran out.

## Retry and unknown outcomes

Classify transient transport/rate-limit failures separately from authentication, unsupported settings, invalid input and semantic validation failures. Use bounded backoff and persist attempt history. Repeating the same bad reference indefinitely is not recovery.

If a connection fails after a request may have been accepted, record an unknown outcome and possible cost uncertainty. Do not promise exactly-once billing. Check any available request/result identity before resubmitting, and require a deliberate policy for unknown-outcome retries.

Cancellation prevents new requests, records the user’s request and handles the known state of in-flight work. A canceled item should not later appear as approved merely because a late response arrived.

## Prompt and output handling

Source passages are evidence, not instructions. Prompt templates should preserve scope, modality, negation, conditions, disagreement and exact reference requirements. Outputs should include concise reader-visible justifications rather than uninspectable claims that an arrow constitutes proof.

Separate unsupported additions, modern applications and neutral connective prose in schemas. Do not ask the expression generator to make text more emotionally powerful without checking changes in certainty, obligation and scope.

## Audit and observability

Expose per-item inputs/configuration, prompt/schema version, returned model ID, token usage, estimated/observed costs, errors/retries, output revisions and human decisions. Store sensitive text privately; logs used for operational diagnostics should not contain full source passages or credentials by default.

A run summary distinguishes proposed, failed, awaiting-review, approved, rejected, stale and unprocessed items. Model grading can assist prioritization but is not the sole quality measure.

## Completion gate

A bounded batch resumes after restart, respects authorization, avoids reprocessing unchanged completed inputs, handles cancellation and rate limits, and reports unknown outcomes and unresolved items honestly. No model can approve itself or silently expand scope, source access or spending.

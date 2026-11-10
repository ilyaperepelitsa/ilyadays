# Proposition extraction, evidence assembly and critical synthesis

## A pipeline of inspectable stages

Do not summarize a cluster into a principle in one opaque call. Use separate resumable work items for retrieval, proposition extraction, evidence assembly, conclusion drafting, validation, critique and human review. Preserve inputs and outputs at every stage.

The pipeline may propose an editorial reconstruction. It may not declare that a set of nearby passages proves a general moral rule or that model agreement supplies independent scholarship.

## Proposition extraction

For each canonical passage or exact selected span, identify atomic claims and their assertion types. Preserve distinctions among descriptions, commands, examples, metaphysical premises, rhetorical questions, personal reminders and contextual observations.

Record scope, modality, conditions, exclusions and exact source spans. Preserve negation. Do not turn “in this circumstance” into “always,” or turn a private self-exhortation into an unrestricted command for every reader without labeling the bridge inference.

A proposed quotation is not trusted because a structured response contains an ID. Application code must locate it in the actual passage revision, disambiguate repeated matches and validate offsets/context/hash before the proposition can enter review.

## Evidence assembly

For one candidate teaching, retrieve possible support and actively search for qualifications, counterexamples, alternate formulations, disagreement and conditions that limit the proposal. Search the whole work using semantic and literal methods, not only the initial cluster.

Record inspected passages and propositions, query/run identity and unresolved coverage. Top-k retrieval is a candidate-generation method, not an exhaustive proof. Core principles eventually need corpus-wide proposition review or an explicit coverage matrix that leaves unresolved material visible.

Evidence bundles identify joint premises. Explain which parts of the proposed statement depend on which sources and whether sources supply a premise, example, qualification or challenge. A bundle can contain disagreement that needs a recorded resolution or an intentionally unresolved status.

## Conclusion record

A draft conclusion includes precise statement, practical implication, relevant circumstances, scope, qualifications, counterevidence, bridge assumptions, evidence bundle, interpretation type and review state. Keep its concise reader-visible justification with the record.

Use the visible interpretation types `direct_statement`, `close_paraphrase`, `multi_passage_synthesis`, `editorial_inference` and `modern_application`. The last two are not forbidden, but they must not masquerade as direct source claims. Their place in the final book depends on review and the chosen manuscript section.

Do not make the practical implication broader than the source-grounded meaning. An observation about impermanence, for example, does not become a moral duty without a bridge premise that the reviewer can inspect.

## Validation before critique

Validate response schema, known revision IDs, exact anchors, relation vocabulary, target mappings, derivation acyclicity and completeness/refusal status. Unsupported or incomplete output remains failed/proposed; do not parse a partial result into an approved entity.

Mechanical validation does not establish semantic support. A perfectly located quotation can still be irrelevant, illustrative rather than argumentative, or contradicted by its context.

## Separate critique pass

The critic sees the proposed conclusion and original evidence, including context and counterevidence. It checks overreach, removed conditions, changed modality, imported doctrine, hidden disagreement, circular reasoning, unsupported obligations and dilution into a platitude.

The critic can reject the draft. Preserve rejection reasons. Do not run repairs until the critic agrees without a bounded stopping rule, and do not describe two model calls as independent scholarly verification.

Formatting/reference repair and philosophical revision are different. A bounded automatic repair can fix schema shape or locate an unambiguous exact reference. A change to the claim, scope or obligation creates a new revision and returns to the relevant review stage.

## Human review

A reviewer inspects source context, exact evidence roles, the joint inference, qualifications and unresolved objections. They approve, reject, defer or request revision on a specific immutable version. A model or background worker cannot approve its own conclusion.

Resolved challenges should retain their text and resolution. Do not require the editor to delete all challenging evidence merely to make approval possible. If a tension remains genuinely unresolved, the conclusion can remain disputed or be limited to a narrower claim.

## Failure cases

| Failure | Required result |
|---|---|
| Invented quotation | Validation failure, no source link created |
| Correct quote, wrong inference | Critique/human rejection or narrowed revision |
| Same topic, opposite claim | Challenge/tension, not automatic support |
| Missing condition | New revision and stale support |
| No corpus-wide coverage | Explicit limited search/review status |
| Model refusal/incomplete output | Recorded unresolved work item |
| Repeated failed repairs | Stop within authorized limits and surface the item |

## Completion gate

Each approved conclusion has exact reviewed evidence, explicit qualifications and a concise inspectable argument. Unsupported statements fail or remain labeled inferences. The pipeline can retain disagreement and uncertainty rather than manufacturing a neat philosophy to satisfy a completion metric.

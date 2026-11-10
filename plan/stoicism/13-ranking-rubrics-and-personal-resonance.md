# Ranking dimensions, rubrics and personal resonance

## Do not compress unlike questions into one score

Importance within Meditations, usefulness in life and resonance to the user are different judgments. A recurrent teaching may not be the most actionable. A personally moving modern application may be weakly supported as a claim about Marcus. A distinctive singleton can matter despite low frequency.

Expose component assessments, rationale, assessor, rubric version, review date and configuration. Do not present a hidden aggregate as a discovered objective importance measure.

## Independent dimensions

| Dimension | Question | Evidence to inspect |
|---|---|---|
| Corpus centrality | How recurrent and connected is this idea in this work? | Distribution across reviewed passages and relationships |
| Foundational role | Which accepted teachings depend on it? | Reviewed derivation links and explanations |
| Practical reach | Across which situations could it matter? | Explicit editorial examples and scope |
| Actionability | Does it guide conduct or attention meaningfully? | Concrete choices or practices rather than slogan density |
| Evidential fidelity | How securely is it grounded? | Source review, qualifications, objections and scope checks |
| Personal resonance | Does it speak to this user? | Actual user ratings and notes |
| Distinctiveness | What disappears if this teaching is removed? | Coverage and non-redundancy review |

Keep recurrence counts separate from subjective editorial judgments. Do not count two translations of the same passage as two independent occurrences. Do not equate graph centrality with truth or moral importance.

## Anchored ordinal assessments

Start with an anchored ordinal rubric such as unassessed, limited, substantial and strong. Define observable anchors for each dimension. For actionability, for example, a limited assessment might identify an attitude without an actionable circumstance, while a strong assessment connects a concrete conduct choice to stated limits.

Do not use decorative precision such as 87.43 importance when the assessment is an uncalibrated judgment. If a numeric representation is needed internally for ranking, show the ordinal label and explain the mapping. Missing values remain missing rather than becoming zeros or invented preferences.

## Eligibility before ranking

Core-principle eligibility is a gate, not a weighted component that high personal appeal can compensate for. Require reviewed evidence, valid anchors, appropriate interpretation and resolved or explicitly bounded objections before a teaching can enter the core.

A compelling modern application can remain in a clearly labeled companion section. It must not become Marcus’s central teaching because a usefulness profile assigns it high weight. Unsupported or stale items should remain discoverable in review queues without appearing as accepted manuscript principles.

## Configurable profiles

Support `central_to_marcus`, `practical_handbook` and `personally_meaningful` profiles. Each profile records dimensions, weights, missing-value policy, eligibility constraints and version.

Changing a profile recomputes a ranking view. It does not alter evidence links, source validity, concept definitions or the user’s manuscript order automatically. Preserve manual pinning/reordering as an editorial choice with a clear relationship to algorithmic ordering.

For missing personal ratings, either exclude that dimension with an explicit explanation or place items in an unrated group. Do not infer that a default value represents the user’s taste. Show how the result changes when ratings are absent.

## Corpus centrality computation

Use source distribution and reviewed relationships, not raw semantic-neighbor density alone. Repeated reminders may be important, but repetition is not itself philosophical truth. A shared phrase may recur for rhetorical reasons without establishing a single unified teaching.

Record the counting unit: canonical passages, propositions or reviewed formulations. Separate repeated wording inside one passage from distribution across the work. Keep normalization/duplicate policies explicit and reproducible.

## User interaction

Provide sortable columns, profile selection and an explanation panel for each rank. The user should see component assessments, why an item is eligible or excluded, and which ratings are provisional/model suggested versus human supplied.

Allow notes such as “important but not useful in this chapter” without forcing a global score change. Offer comparison of two candidates so the editor can articulate their differences rather than accepting a silent top-ten list.

## Validation and acceptance

Test missing values, all-unrated profiles, ties, stale assessments, changed rubrics, extreme weights, ineligible high-resonance items and source duplicates across editions. A model cannot assign personal resonance on behalf of the user.

Compare alternative profiles against their stated purposes using reviewed examples. Do not report a universal best ranking when the result reflects editorial choices. The completion gate is an explainable, reproducible and correctable ranking system that remains subordinate to evidence eligibility and human editorial judgment.

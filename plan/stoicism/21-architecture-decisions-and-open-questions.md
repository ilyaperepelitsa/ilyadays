# Architecture decisions and genuinely open questions

## Accepted direction

These decisions follow the user’s brief and inspected repository. Changing one requires a concrete reason and an explicit recorded decision, not a convenient silent fallback.

| Decision | Rationale | Consequence |
|---|---|---|
| Hays is the primary edition | Readable modern English is the selected editorial basis | Do not substitute another translation |
| Waterfield is optional comparison | Useful interpretive aid without mandatory second purchase | Corpus identity and evidence counting remain distinct |
| Local-first private workspace | Personal source material and review belong under user control | No required cloud deployment or hosted corpus database |
| Existing Next/React frontend | Preserve repository conventions and integration | Do not replace the app merely to follow a greenfield template |
| FastAPI/Pydantic/SQLite privately | Small single-user service with inspectable relational data | Migrations and bounded local API are required |
| Shared command engine currently | Avoid divergent browser/private provenance rules | Measure before replacing the bridge or duplicating logic |
| Immutable revisions and explicit links | Support must remain reproducible | Edits create successors and invalidate assessments |
| Fixed large embeddings, full dimensions | User explicitly requested the starting configuration | No silent shortening/model substitution |
| Exact cosine baseline | Inspectable retrieval before extra infrastructure | No vector service required initially |
| PCA is exploratory | Two dimensions lose information | Never make the map the authoritative evidence/clustering space |
| Average linkage with cosine | Initial computational hierarchy proposal | Ward/cosine is not the chosen combination |
| Curated concepts are independent | Editorial decisions survive geometry reruns | Memberships and locks cannot be overwritten automatically |
| Human approval of core meaning | Citation validity is not philosophical entailment | Workers propose, validate and critique but do not approve |
| Separate expression layer | Emotional force can change claims | Wording needs mapping and semantic review |

## Decisions needing implementation design, not user permission

Choose concrete internal IDs, migration ordering, component boundaries, file organization, typed error shapes and test utilities using existing conventions. The user need not approve routine reversible implementation details repeatedly.

Pick a compatible pinned numerical stack after inspecting the actual environment and verifying APIs. Decide the initial chart implementation based on linked selection/accessibility/performance requirements. A bespoke small scatter plot may be adequate initially; scientific export figures should use a reproducible plotting artifact.

Choose an initial palette with tested contrast and non-color labels. That is a product-design choice within the requested scope. Do not turn it into an unnecessary permission gate, but do test that the user can actually see the requested provenance.

## Genuine external/user decisions

The actual authorized source file and its permitted-processing assumptions cannot be invented. Approval of source segmentation is an editorial/data decision. Sending source to OpenAI requires explicit consent and an authorized bounded budget. Those gates stay pending until actual approval arrives.

Personal resonance and preferences belong to the user. The application can provide rating tools and candidate profiles, but it cannot fabricate emotional reactions or declare which phrasing speaks to them.

Difficult interpretations and core-principle adoption ultimately require human review. A model-assisted recommendation can be presented with evidence, not adopted as if the decision had already been made.

## Open technical questions to resolve with evidence

### Chart stack and density

How many points will the selected corpus/collection contain after import? What linked-selection and keyboard/list behavior is needed? Measure those requirements before choosing Canvas/WebGL or a heavyweight plotting stack. Do not add infrastructure only because a map might someday become large.

### Snapshot retention

How much duplication results from storing whole workspace snapshots once source text and many revisions are present? Measure storage growth and recovery needs. Move toward immutable artifact references/checkpoints as needed without losing historical review reproducibility.

### Clause-mapping granularity

Which teachings have reviewed support at whole-statement level and which have defensible clause-level assessments? The UI must show the actual granularity. A technical desire for colorful words is not evidence for word-level attribution.

### Projection comparison

Will moderate-dimensional PCA improve useful clustering relative to the full-dimensional baseline on reviewed examples? Treat this as an experiment. Persist representations and compare results rather than assuming compression improves philosophical structure.

### Comparison-edition alignment

Which numbering/boundary differences appear in the actual files? Do not implement a universal paragraph-index join before inspection. Record uncertain alignments and translator commentary separately.

## Rejected shortcuts

Do not replace the editorial workbench with a chatbot, call hand-placed points PCA, label synthetic vectors as OpenAI output, count translation duplicates as independent evidence, reset edited projects to install new examples, or use a pretty gradient to conceal an unsupported addition.

Do not remove difficult material merely because it damages a neat ontology. Do not equate cluster size with importance or personal resonance with source fidelity. Do not claim full-corpus completion from top-k search or from a batch that stopped at its budget.

## Decision record format

Record decision ID/date, problem, inspected evidence, alternatives, chosen action, consequences, affected versions, review owner and reversal conditions. Keep factual decisions separate from unresolved hypotheses. A later session should know which choices are settled and which still need measurement or user review.

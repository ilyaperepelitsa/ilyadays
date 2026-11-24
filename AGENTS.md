

<!-- codex-project-memory:start -->
Use Project Memory as the default context layer for this repository.

- Only skip preflight for obviously trivial, one-line, low-risk local edits.
- Before any meaningful implementation, planning, review, or debugging work, run `.codex-memory/context --task "..."` and add `--path repo/relative/file` for touched files as soon as they are known.
- Treat `.codex-memory/context` as the single full-stack preflight. It combines durable repo memory, active and rejected directions, ecosystem constraints, and any available Codex-authored structure links.
- Treat the returned `consult_first` list as the first evidence shortlist. Read those files before broader repo exploration.
- Approved and rejected directions are mandatory planning constraints for multi-file work.
- Ecosystem ownership and anti-dup constraints are mandatory before you introduce a new module, service boundary, or capability.
- Check `.codex-memory/features list` when you need to confirm which memory modes are active.
- If you are touching a known path or entity, check linked subgraphs and edges before changing behavior.
- If `.codex-memory/graph.json` is missing, initialize the repo memory scaffold first.
- If durable repo memory is sparse or stale, prepare a Codex authoring packet with `.codex-memory/authoring repo-packet` or `.codex-memory/authoring focus-packet --path ... --task "..."`, then store the resulting JSON with `.codex-memory/authoring apply --input <json-file>`.
- Write/Edit actions in local Codex installs capture pending changed paths for delta authoring automatically.
- Before finalizing meaningful work, if `.codex-memory/delta pending` reports pending paths, run `.codex-memory/delta auto --task "..."` to replace stale generated memory only for the touched scope.
- Use `.codex-memory/summary.md` only as a fallback when the full-context preflight or impact card is insufficient.
- Do not read `.codex-memory/graph.json` directly unless summary-level memory is insufficient and you need one specific edge or node.
- Do not scan `.codex-memory` files by hand when the wrappers can answer the question.
- Avoid broad repo scans before consulting the full-context preflight or impact card.
- Read only evidence paths that are directly tied to the touched path or task.
- Surface at most one relevant global user preference when it materially changes execution.
- If a direction is approved, update its completion percentage after meaningful progress. If a direction is rejected, avoid reviving it without explicit approval.
- Codex-authored structure lives in durable path links and module facts. Use `.codex-memory/authoring focus-packet --path ... --task "..."` when structure memory is sparse or stale.
- If another repo already provides a capability, prefer reference or integration over duplicating the capability here when ecosystem memory is enabled.
- After meaningful work, record durable facts, structure links, commands, risks, decisions, and open questions into project memory.
- Compact project memory when thresholds are exceeded.
- Use the `sequential-critic` skill for high-risk or low-confidence tasks.
<!-- codex-project-memory:end -->


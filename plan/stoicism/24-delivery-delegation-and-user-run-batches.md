# Delivery, delegation and user-run batches

## Delivery order

1. The primary agent owns semantic and architectural fidelity: source permissions, exact provenance, the distinction between embeddings and synthesis, human review, and honest completion claims.
2. Terra owns bounded coding and focused tests for an agreed small surface. Keep the change set reviewable and preserve existing command gates.
3. Luna owns cheap mechanical work: inventory, formatting, generated summaries and other reversible chores with clear acceptance checks.
4. Deliver the smallest usable pilot first. A pilot proves command wiring, local checkpointing, cancellation behavior and readable progress; it does not imply corpus-wide synthesis quality.
5. The user launches large processing from a shell command after reviewing source scope and budgets. The assistant should prepare the command, explain its effects, and not wait through full-corpus execution.

## Aurelius local runner pilot

`scripts/aurelius-run.sh` is a user-run wrapper for existing `aurelius-corpus.py` local stages. It defaults to a dry-run and selects at most three imported corpora. `--run` executes the selected stage, `--max-items N` sets a smaller/larger pilot bound, and `--full` explicitly selects all discovered imported corpora. The runner uses `tqdm` for per-corpus progress and stores atomic, private checkpoints under `.aurelius/batch-runs/`; `--resume RUN_ID` skips complete, unchanged items and retries failed or interrupted ones.

The supported stages are `preview`, `study`, `project`, `hierarchy`, and `export-map`. `study` writes the existing manual editorial proposal; it is not model synthesis. Embedding commands remain outside this runner because they require per-corpus review, external-processing approval, fixed token/cost caps, and existing server-only credentials. An embedding cache hit or completed embedding run does not authorize synthesis. No provider credential is copied or passed by the wrapper.

## Usage and limits

From the repository root, inspect the default plan:

```sh
scripts/aurelius-run.sh
```

Run the small local study pilot:

```sh
scripts/aurelius-run.sh --run --action study --max-items 1
```

Run every discovered corpus only after reviewing the plan and private source scope:

```sh
scripts/aurelius-run.sh --run --action study --full
```

The printed run ID can be resumed with the same action and mode, for example `scripts/aurelius-run.sh --run --action study --resume RUN_ID`. Checkpoints record corpus content identity, command, state and exit code, not source text. A changed corpus invalidates its old item checkpoint. Failures stop the run and preserve completed work; cancellation is recorded and exits nonzero. Existing per-command gates remain authoritative.

## Current boundary

This is a local command orchestrator, not a durable remote job service. Its progress unit is a corpus command; the embedding CLI itself continues to checkpoint successful request batches in its immutable vector cache. There is no real-corpus model synthesis command yet. Large model jobs must remain a user-launched, separately authorized workflow with visible item/token/cost limits and their own durable semantic-review states.

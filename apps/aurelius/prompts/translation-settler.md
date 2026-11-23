# Brief: settle a checked translation of Marcus Aurelius

You are the third reader in a small project that puts Marcus Aurelius's notebook (the Meditations) into plain English of today, directly from the Greek. A first translator made a draft with notes. A second reader, who saw only the Greek and the English, listed every place where the English seemed to say more, less or other than the Greek. Your job is to settle every one of those points in writing and produce the English that will be published, with its notes brought into line.

## What you are given (paths are in your task message)

- `greek.json`: list of `{ ref, greek }`. The Greek is from J. H. Leopold's edition (1908).
- `draft.json`: list of `{ ref, english, notes: [ { greek, note, other_reading } ] }`, the first translator's work.
- `check.json`: list of `{ ref, verdict, findings: [ { kind, greek, english, note, suggest } ] }`, the second reader's points.
- `TRANSLATOR.md`: the rules the English must follow. Read it first: the settled English must keep every one of those rules.

A ref with a dash ("5.14–15") is consecutive chapters given as one passage. A ref with a letter ("11.8a", "3.11b") is only part of a chapter; the Greek may begin or end mid-sentence.

## The hard rule: the Greek is the only authority

- Do not consult any existing translation of Marcus, in any language, from the web, from files or deliberately from memory. Do not search the web at all.
- Do not read any file other than the four named above and this brief. Do not read anything in the project repository and do not run any project-memory or repository preflight: this is not a repository task.
- Neither the translator nor the checker is the authority. Read the Greek yourself for every point and decide on what it says.

## How to settle

For every finding in `check.json`, in order:

1. Read the Greek words concerned and their clause.
2. Decide: **Accepted** (the English changes as suggested or to the same effect), **Partly accepted** (the point is right but your wording differs from the suggestion, or only part of it holds), or **Declined** (the draft stands).
3. Write the decision as one to three plain sentences that begin with exactly `Accepted:`, `Partly accepted:` or `Declined:` and say what the English now reads and why. A reader who knows no Greek should be able to follow the reason. When you decline, give the reason from the Greek, not from preference.

Lean toward the Greek: where the checker shows the English adds, drops or changes something, change the English. Decline only where the checker has misread the Greek, where the suggestion would break a rule of the translator's brief (plain English of today, images kept, one English word for one repeated Greek word), or where the draft's choice is a defensible reading that is recorded in a note.

Then write the settled English for the whole passage, reading it through once more against the Greek from start to finish so that fixes have not introduced new faults and the passage still reads as plain English. You may also correct a fault that neither earlier reader caught; record it as one more item in `check` with a note that begins "Found while settling:".

Finally bring the notes into line with the settled English:

- Keep each translator's note that still describes a real choice; correct its wording where the English changed; drop a note that no longer applies.
- Add a note where a checker's "open" or "text" point shows the Greek can be read another way and the English has to choose.
- Every note: `greek` (exact substring of the passage's Greek), `note` (one to three plain sentences), `other_reading` (the English of the reading not taken; may be an empty string only when there truly is none, as with a note on a name).
- Where a note relies on memory of the manuscript tradition or of an editor's conjecture, keep or add the words "from memory, unchecked".

## Typography of the settled text

In the settled English, the notes and the decisions, use curly double quotation marks for quoted speech and quoted words (“like this”), curly single marks only for a quotation inside a quotation, and a curly apostrophe (’). No straight quotes. No dashes used as pauses: use a comma, a colon or a new sentence.

## Style of the decisions and notes

Plain sentences. No "I chose" or "we": say what the English reads and why ("“Impulse” is kept for ὁρμή in both places so the contrast can be heard."). No praise or blame of the earlier readers.

## Output

Write one JSON file to the output path named in your task message (a scratch folder, not the repository): a list in input order of

```json
{ "ref": "8.19",
  "english": "…",
  "notes": [ { "greek": "…", "note": "…", "other_reading": "…" } ],
  "check": [ { "greek": "…", "note": "<the second reader's point, in one or two plain sentences>", "decided": "Accepted: …" } ] }
```

`check` has one item per finding of the second reader, in the same order (plus any "Found while settling:" items at the end). In `check`, `greek` must be an exact substring of the passage's Greek; where the finding's Greek is empty or not a substring, use the nearest Greek words that are.

Before you finish, check by script that: the file parses; it has one object per input passage in input order; every `greek` in `notes` and `check` is an exact substring of that passage's Greek; every `decided` begins with `Accepted:`, `Partly accepted:` or `Declined:`; the number of `check` items per passage is at least the number of findings; and no English contains thee, thou, thy, thine, doth, hath, saith, unto, whatsoever or shalt. Then reply with one line per passage (ref, findings, accepted / partly / declined counts) and the two or three decisions you are least sure of. Do not write any other file.

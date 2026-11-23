# Brief: settle a checked translation of Marcus Aurelius

You are the third reader in a small project that puts Marcus Aurelius's notebook (the Meditations) into plain English of today, directly from the Greek. A first translator made a draft with notes. A second reader, who saw only the Greek and the English, listed every place where the English seemed to say more, less or other than the Greek. Your job is to settle every one of those points in writing and produce the English that will be published, with its notes brought into line.

## What you are given

Your task message names a folder. In it:

- `greek.json`: list of `{ ref, greek }`. The Greek is from J. H. Leopold's edition (1908).
- `draft.json`: list of `{ ref, english, notes: [ { greek, note, other_reading } ] }`, the first translator's work.
- `check.json`: list of `{ ref, verdict, findings: [ { kind, greek, english, note, suggest } ] }`, the second reader's points.
- `translator-doubts.json` and `checker-summary.json`: where each of them was least sure, and what the second reader thought most serious. Read these places with particular care.
- `crosswalk.json`: for a passage that is part of a chapter, `left_out` holds the Greek of the chapter that is not in the passage. You may read it to judge the cut edge. Do not translate it into the passage.

And two files of rules: `/private/tmp/claude-501/-Users-ilyaperepelitsa-PycharmProjects-ilyadays/4938a7bb-5fb8-497c-9bc5-37a32d815f38/scratchpad/wide/TRANSLATOR.md`, the rules the English must keep, and `/private/tmp/claude-501/-Users-ilyaperepelitsa-PycharmProjects-ilyadays/4938a7bb-5fb8-497c-9bc5-37a32d815f38/scratchpad/wide/GLOSSARY.md`, the renderings already settled. Read both first. Bring the section into line with the glossary; where a passage's own argument needs another word, keep it and say why in a note.

## About the refs and the Greek as given

- A ref with a dash ("6.9–10") is two or more consecutive chapters given as one passage, joined by a space.
- A ref with a letter ("11.8a", "3.11b", "7.31b–34") covers only part of a chapter: the 1634 translation, whose sections this project follows, cuts there. The Greek may begin or end in mid-sentence.
- The Greek is a digitised copy of the edition and has slips of its own: an accent or breathing (ὦν for ὧν, ἣ for ἢ), a misprinted letter (σύνὸεσις for σύνδεσις). Read such a word as the sense requires. Whenever you quote Greek in an output field, copy the characters exactly as they stand in the input, slips included, so that the substring checks pass.
- Where the Greek as given does not construe (a missing verb, a broken phrase), do not smooth it over: say so.
- For a passage of several chapters, each further chapter begins on a new paragraph (one blank line, "\n\n" in the JSON string). For a passage that is one chapter, do not add paragraph breaks.
- A passage with no findings still gets your own reading against the Greek; its `check` list may be empty.

## The hard rule: the Greek is the only authority

- Do not consult any existing translation of Marcus, in any language, from the web, from files or deliberately from memory. Do not search the web at all.
- Do not read any file other than those named above and this brief. Do not read anything in the project repository and do not run any project-memory or repository preflight: this is not a repository task.
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

In the folder named in your task message (a scratch folder, not the repository), write:

1. `settled.json`: a list in input order of

```json
{ "ref": "8.19",
  "english": "…",
  "notes": [ { "greek": "…", "note": "…", "other_reading": "…" } ],
  "check": [ { "greek": "…", "note": "<the second reader's point, in one or two plain sentences>", "decided": "Accepted: …" } ] }
```

`check` has one item per finding of the second reader, in the same order, plus any "Found while settling:" items at the end. In `check`, `greek` must be an exact substring of the passage's Greek; where the finding's Greek is empty or not a substring, use the nearest Greek words that are.

2. `settler-doubts.json`: a list of `{ "ref": "…", "greek": "…", "doubt": "…" }`, the two to five decisions you are least sure of, each in one or two plain sentences.

Then run `/Users/ilyaperepelitsa/PycharmProjects/ilyadays/apps/aurelius/.venv/bin/python /private/tmp/claude-501/-Users-ilyaperepelitsa-PycharmProjects-ilyadays/4938a7bb-5fb8-497c-9bc5-37a32d815f38/scratchpad/wide/validate.py <folder name>` (the folder's own name, for example `c3s1`). It must print `problems: 0`; fix whatever it lists (Greek not a substring, a decision without its prefix, fewer decisions than findings, a straight quote, a dash as a pause, an old form, first person in a note).

Then reply with exactly one line: `settled <passages> passages, <points> points: <n> accepted, <n> partly, <n> declined`, or `blocked: <reason>`. Nothing else: your doubts are in the file.

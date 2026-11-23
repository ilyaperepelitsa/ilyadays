# Brief: check an English translation of Marcus Aurelius against the Greek

You are the second reader in a small project that puts Marcus Aurelius's notebook (the Meditations) into plain English of today, directly from the Greek. A first translator has made a draft. Your job is to compare that English with the Greek, closely, and list every place where the English says more, less or something other than the Greek. A third reader will settle each of your points, so be specific and do not hold back small ones.

## What you are given

One input file, named in your task message: a JSON list of `{ "ref": "...", "greek": "...", "english": "..." }`. You are deliberately not given the translator's notes: judge the English as a reader would meet it.

A ref with a dash ("5.14–15") is consecutive chapters given as one passage. A ref with a letter ("11.8a", "3.11b") is only part of a chapter, so the Greek may begin or end mid-sentence; do not fault the English for not translating Greek that is not given, but do check any words it adds to make a fragment readable.

## The hard rule: the Greek is the only authority

- Do not consult any existing translation of Marcus, in any language, from the web, from files or deliberately from memory. Do not search the web at all.
- Do not read any file other than your input file and this brief. Do not read anything in the project repository and do not run any project-memory or repository preflight: this is not a repository task.
- Judge against what the Greek says, not against how the line is usually rendered.

## What to look for

Go through each passage clause by clause. Report a finding wherever:

- **more**: the English adds something the Greek does not say (a reason, a "so" or "because", an example, an "only" or "always", an emotional colour, an explanation folded into the text).
- **less**: something in the Greek is dropped or weakened (a particle that carries the logic, an "all" or "not", a word of the image, a second half of a pair).
- **other**: the English says something different (wrong sense of a word, wrong subject or object, wrong person or number, wrong tense where it matters, a wrongly resolved ambiguity, a mistaken construction).
- **open**: the Greek can be read two ways and the English has silently chosen one. Say what the other reading is.
- **chain**: a Greek word repeated across the passage, on which the argument depends, is given two different English words (or two different Greek words are given the same English word where the difference matters).
- **register**: the English is archaic, ornate, or unclear to a reader of today, or uses a technical term without need.
- **text**: you suspect a problem in the Greek text as given (say that you are working from memory if you are).

For each finding give the exact Greek words concerned, the English words concerned, what is wrong in one to three plain sentences, and what you would put instead. If a passage is sound, say so and give few or no findings; do not invent findings to fill a list.

Then give each passage a verdict: `sound` (nothing a reader would be misled by), `minor` (points worth fixing, none changes what Marcus says), or `wrong` (at least one point changes what Marcus says).

## Output

Write one JSON file to the output path named in your task message (a scratch folder, not the repository): a list in input order of

```json
{ "ref": "8.19", "verdict": "minor",
  "findings": [ { "kind": "more", "greek": "…", "english": "…", "note": "…", "suggest": "…" } ] }
```

`greek` must be copied character for character from the input so that it is an exact substring of that passage's Greek; `english` must be an exact substring of that passage's English (or an empty string when the fault is an omission). Before you finish, check by script that the file parses, has one object per input passage in input order, and that both substring rules hold. Then reply with one line per passage (ref, verdict, number of findings) and the single most serious finding overall in two or three sentences. Do not write any other file.

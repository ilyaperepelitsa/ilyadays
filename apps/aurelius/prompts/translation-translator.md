# Brief: translate passages of Marcus Aurelius from the Greek

You are the first translator in a small project that puts Marcus Aurelius's notebook (the Meditations) into plain English of today, directly from the Greek. A second reader will check your English against the Greek afterwards, and a third will settle each point, so your job is a careful first draft with honest notes, not a polished final text.

## What you are given

One input file, named in your task message: a JSON list of `{ "ref": "<book.chapter>", "greek": "<the Greek>" }`. The Greek is from J. H. Leopold's edition (1908). Translate every passage in the list, in the order given.

## The one hard rule: work from the Greek alone

The value of this translation is that it is independent. So:

- Do not consult any existing translation of Marcus, in any language: none from memory on purpose, none from the web, none from files. Do not search the web at all.
- Do not read any file other than your input file and this brief. In particular do not read anything in the project repository, and do not run any project-memory or repository preflight: this is not a repository task.
- If you find you remember a published rendering of a line, set it aside and translate what the Greek says.

## What good English looks like here

- Plain English of today, the kind a careful person writes in a notebook. No "thee", "thou", "thy", "doth", "hath", "unto", "whatsoever", "shalt". No ornament the Greek does not have.
- Keep who is speaking and who is addressed. Marcus mostly addresses himself as "you"; keep "you" where the Greek has the second person, "I" where it has the first, and an impersonal form where it is impersonal.
- Keep every "all", "every", "only", "never", "not": do not soften or strengthen a claim. Do not add a reason, a "because", a "so" or an example the Greek does not have.
- Keep each image as an image (a cut-off hand stays a cut-off hand).
- Where a chain of thought depends on one Greek word being repeated, use one English word for it throughout that passage, so that a reader with no Greek can follow the argument.
- Where the Greek plays on words, or uses an idiom whose literal sense matters, translate the sense that keeps the argument readable and explain the play in a note. Put transliterated Greek into the English itself only when the passage is itself talking about a Greek word.
- Greek names and titles of gods stay as they are (Zeus, Asclepius), with a short note if a reader would not know them.
- Sentences may be split where the Greek period is too long for English, but nothing may be dropped and the order of thought should stay.
- Technical Stoic terms: choose one plain English word per term and keep to it within the passage (for example "the ruling part" for τὸ ἡγεμονικόν, "impulse" for ὁρμή, "impression" for φαντασία), and note the Greek term the first time it carries weight.

## Notes

For every place where the Greek is open (a form that can be read two ways, a word with a range the English must narrow, a doubted text, a pun, an idiom, an allusion), translate one reading and write a note:

- `greek`: the exact Greek words the note is about, copied character for character from the input, so that it is an exact substring of that passage's Greek.
- `note`: one to three plain sentences: what is open and which way you went.
- `other_reading`: the English of the reading you did not take, or of the more literal rendering.

Aim for the notes a reader needs to judge your choices: typically three to eight for a passage of ordinary length, fewer for a one-line passage. If you are relying on memory for a claim about the text or its transmission, say so in the note ("from memory, unchecked").

## Output

Write one JSON file to the output path named in your task message (it is in a scratch folder, not the repository): a list, in input order, of

```json
{ "ref": "8.19", "english": "…", "notes": [ { "greek": "…", "note": "…", "other_reading": "…" } ] }
```

Before you finish, check by script that the file parses, has one object per input passage in input order, and that every note's `greek` is an exact substring of that passage's Greek. Then reply with: the count of notes per passage, and the two or three places you are least sure of, in plain sentences. Do not write any other file.

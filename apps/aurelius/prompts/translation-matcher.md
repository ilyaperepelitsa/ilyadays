# Brief: match passages of the 1634 translation of Marcus Aurelius to the Greek

A project is translating Marcus Aurelius's Meditations from the Greek, passage by passage. Its passages are the sections of Meric Casaubon's 1634 English translation, which numbers and cuts the text differently from modern editions. Before a passage can be translated, someone must say exactly which Greek it covers. That is your job, for the sections named in your task message. You do not translate anything.

## Why it needs reading, not numbers

Casaubon's section numbers run a few behind or ahead of the modern chapter numbers and drift through each book. He often joins two or more modern chapters into one section. He sometimes cuts in the middle of a modern chapter: a closing maxim becomes the opening of his next section, or an opening line is left at the end of his previous one. The last three sections of his Book 1 are the first three chapters of modern Book 2. A script has proposed a match for every passage from text similarity; it is right about which chapters are involved most of the time and knows nothing about cuts inside a chapter.

## Tools

Run with `/Users/ilyaperepelitsa/PycharmProjects/ilyadays/apps/aurelius/.venv/bin/python /private/tmp/claude-501/-Users-ilyaperepelitsa-PycharmProjects-ilyadays/4938a7bb-5fb8-497c-9bc5-37a32d815f38/scratchpad/wide/match.py <command>`:

- `list <section-id>`: the section's 1634 passages with the proposed modern chapters.
- `look <1634-ref> …`: the opening and ending of each 1634 passage beside the opening and ending of each proposed Greek chapter and of the chapters just before and after.
- `cas <1634-ref>`: the full 1634 text. `greek <book.chapter> …`: the full Greek of modern chapters.
- `build <section-id> <spec.json>`: writes the section's files from your spec and checks it. Running the script with no arguments prints the spec format.

Do not read or change anything else in the repository, and do not run any project-memory or repository preflight. Do not search the web. Read no translation of Marcus other than the 1634 text these tools show you.

## What to do for each passage

1. `look` at it. Check that the 1634 opening translates the opening of the first Greek chapter proposed, and that the 1634 ending translates the ending of the last. Casaubon paraphrases and pads, so compare sense, names and images, not word counts.
2. If the opening or ending does not match, read the full texts (`cas`, `greek`) and find where the passage really begins and ends. Look at the neighbouring 1634 sections too (`cas` with the previous or next number): what Casaubon leaves out of this section he puts in a neighbour.
3. Write its entry in the spec:
   - whole chapter: `"standard": "8.19"`; several whole chapters: `"standard": "6.9–10"` (en dash).
   - part of a chapter: add a letter after that chapter's number, `a` for the chapter's first part, `b` for its next part, and so on (`"11.8a"`, `"3.11b"`, `"7.31b–34"`), and give the cut: `start` = the exact Greek words at which this passage begins (when it does not begin at the start of the first chapter), `end_before` = the exact Greek words at which the left-out ending begins (when it stops before the end of the last chapter). Copy the Greek words character for character from the `greek` output; four to six words are enough, and they must occur only once in that chapter. Add `why`: one plain sentence saying where the 1634 translation cuts and which of its sections holds the rest, for example "The 1634 translation ends its section 9.26 here and begins its 9.27 with the rest of the chapter."
4. A cut must fall where Casaubon's section really ends or begins. Do not cut a chapter because Casaubon merely skips or shortens a sentence inside his section; in that case take the whole chapter.

When every passage of a section has an entry, save the spec as `<scratch>/wide/specs/<section-id>.json` and run `build`. Fix whatever it refuses. If it prints a `CHECK:` line about lengths, look at that passage again and either correct the span or keep it and say why in your doubts.

## Output and reply

- One spec file per section, built without error.
- One file `<scratch>/wide/specs/<chapter-or-batch-name>.doubts.json`: a JSON list of `{ "casaubon": "…", "standard": "…", "doubt": "…" }` for every passage where you are not sure of the span or the cut, or where a `CHECK:` line remains. An empty list if none.
- Then reply with exactly one line: `matched <number of sections> sections, <number of passages> passages, <number of parts of chapters> parts, <number of doubts> doubts`, or `blocked: <reason>`. Nothing else.

`<scratch>` is /private/tmp/claude-501/-Users-ilyaperepelitsa-PycharmProjects-ilyadays/4938a7bb-5fb8-497c-9bc5-37a32d815f38/scratchpad

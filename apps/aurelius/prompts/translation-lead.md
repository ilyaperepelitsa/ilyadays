# Brief: run one section through the three readers

A project is translating Marcus Aurelius's Meditations from the Greek, section by section. Each section goes through three readers, each a separate agent with a fresh context: a first translator who sees only the Greek; a second reader who sees only the Greek and the English; a third who settles every point in writing. You run that sequence for one section and report one line. You are a coordinator: the value of the method is that the three readers are independent, so you do not translate, check or settle anything yourself, and you do not read the Greek, the drafts or the findings.

Your task message gives the section's folder name (for example `c3s1`). Below, WIDE is /private/tmp/claude-501/-Users-ilyaperepelitsa-PycharmProjects-ilyadays/4938a7bb-5fb8-497c-9bc5-37a32d815f38/scratchpad/wide and PY is /Users/ilyaperepelitsa/PycharmProjects/ilyadays/apps/aurelius/.venv/bin/python. The folder is WIDE/<folder name> and already holds `greek.json` and `crosswalk.json`.

Do not read or change anything in the project repository, and do not run any project-memory or repository preflight: this is not a repository task.

## Steps

1. **First translator.** Start a new general-purpose agent (Agent tool) with exactly this prompt, with the folder filled in:

   > You are the first translator of a section of Marcus Aurelius from ancient Greek into plain English of today. Read your brief first and follow it exactly: WIDE/TRANSLATOR.md. Your folder is WIDE/<folder name>. Work from the Greek alone: do not consult any existing translation, do not search the web, do not read anything in /Users/ilyaperepelitsa/PycharmProjects, and do not run any project-memory or repository preflight. Reply with the single line the brief asks for.

   Wait for its reply. It should be one line beginning `drafted`. Then check that `draft.json`, `translator-doubts.json` and `pairs.json` exist in the folder. If `pairs.json` is missing, run `PY WIDE/pairs.py <folder name>` yourself; if that fails, send the error to the translator (SendMessage) and wait for its fix.

2. **Second reader.** Start a new general-purpose agent with exactly this prompt:

   > You are the second reader of an English translation of a section of Marcus Aurelius: compare the English with the ancient Greek and list every place where the English says more, less or something other than the Greek. Read your brief first and follow it exactly: WIDE/CHECKER.md. Your folder is WIDE/<folder name>. The Greek is the only authority: do not consult any existing translation, do not search the web, do not read any file other than the brief and `pairs.json` in your folder, do not read anything in /Users/ilyaperepelitsa/PycharmProjects, and do not run any project-memory or repository preflight. Reply with the single line the brief asks for.

   Wait for its reply (one line beginning `checked`). Check that `check.json` and `checker-summary.json` exist.

3. **Third reader.** Start a new general-purpose agent with exactly this prompt:

   > You are the third reader of an English translation of a section of Marcus Aurelius from ancient Greek: settle every point the second reader raised, in writing, and produce the English to be published with its notes brought into line. Read your brief first and follow it exactly: WIDE/SETTLER.md. Your folder is WIDE/<folder name>. The Greek is the only authority: do not consult any existing translation, do not search the web, do not read any file other than those the brief names, do not read anything in /Users/ilyaperepelitsa/PycharmProjects, and do not run any project-memory or repository preflight. Reply with the single line the brief asks for.

   Wait for its reply (one line beginning `settled`).

4. **Check the result.** Run `PY WIDE/validate.py <folder name>`. It prints one summary line ending in `problems: N` and then lists any problems. If N is not 0, send the listed problems to the third reader (SendMessage to that agent) and ask it to fix them and re-run the validator; wait, then run the validator again. Do this at most twice.

## Rules

- **An agent's final line may not reach you.** In this session an agent's reply is often delivered to the main conversation instead of to the agent that started it. So do not wait for the line itself. A step is done when the agent you started has stopped and its output files are in the folder: `draft.json`, `translator-doubts.json` and `pairs.json` after step 1; `check.json` and `checker-summary.json` after step 2; `settled.json` after step 3. When you are told an agent has finished, or you are woken for any reason, look in the folder and go on if the files are there. Do not message a finished agent to ask for its line.

- Start the three agents one after another, never at once: each needs the previous one's output.
- Use the prompts as written, replacing only WIDE and <folder name> with the real path and name. Do not add hints, summaries of earlier stages or your own reading of the text.
- If an agent replies `blocked: …`, or does not produce its file, try once more with a new agent for that step. If it fails again, stop.
- Do not write any file yourself.

## Reply

Exactly one line, nothing else:

`<folder name>: <the validator's summary line>`  (for example `c3s1: c3s1 10 passages; 108 notes; 76 points: {…} ; problems: 0`)

or `<folder name>: blocked at step <n>: <reason>`.

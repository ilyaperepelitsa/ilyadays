# Prompt: fuse one section into a constitution article

Use this for every article of the personal constitution, whether an editor or a model writes it.
It has two parts: the task, and the rules learned from the owner's review. **When the owner gives
feedback on any article, generalise it into a rule, add it to the second part with the date and
their words, and apply it to every existing article, not only the one they pointed at.**

## Task

Input: one section of the topic hierarchy (`content/aurelius/topics.json`), with the full text and
immutable revision id of every passage in it. The passages were grouped because their embeddings
are close; that is a reason to look for shared statements, not proof that they share one.

1. **Read every passage.** For each, note the separate things it says.
2. **Find parallel statements.** Look for the same thing said in two or more passages, in different
   words or different images. Quote each instance exactly.
3. **Fuse each group into one claim.** State what the instances share, once. Say what was
   generalised and what was dropped. For each quote, name the words of the claim it backs (one
   quote may back several components), and write the one-sentence conclusion that follows from
   that quote alone.
4. **Induce the statement.** Write one short statement that joins the claims, map each of its
   parts to the quotes behind it, and name how it was reached: a chain of consequences, lists
   aligned into one, an argument by cases, a likeness, a rule with its hardest case. Keep that
   explanation outside the article text. Then place every claim under one of the five fixed labels
   (rule 7 below).
5. **Keep single witnesses apart.** What only one passage says goes under “said once” with the
   reason. It is never counted as fused.
6. **Account for every passage.** Each one either feeds a claim, is quoted alone, or is set aside
   with a reason.
7. **List the editor's decisions and the article's limit.**

Output: an entry in `content/aurelius/constitution.json` (schema 3). The build
(`scripts/aurelius-constitution.py`) rejects a claim that rests on one passage, a quote that is not
one exact span, a “gives” phrase that is not in the claim, a statement part that is not in the
statement, a quote without a `follows` conclusion, and a claim or single item that is not under
exactly one label.

## Rules learned from review

Each rule is followed by the feedback it came from.

1. **Fuse; do not concatenate.** A point that restates one passage is not an article element. Every
   claim rests on at least two passages and says something none of them says alone: what they have
   in common.
   *23 Nov 2026: “These look like concatenations of exact quotes… I don't see any level of merging
   into common concepts… from parts to the whole, from parts to a higher thought.”*
2. **Keep exact quote tracking under every fused statement.** Fusion must not hide where words come
   from. A reader can go from any words in the article to the passages behind them.
   *23 Nov 2026: “The direct quote tracking is important.” “I still want to have functionality
   preserved when I hover a piece of text, to show what passages it's coming from.”*
3. **Write the article as an article.** First person, declarative, complete sentences that could be
   read aloud as a rule of life. Nothing in the article text talks about passages, lists, Marcus's
   method or the editing. That goes in the notes beside it.
   *23 Nov 2026: “Article 2 doesn't sound like an article. First one genuinely looks good.”
   (Article 2 opened with “Three passages each list…” and its claims were fragments; Article 1 was
   in the first person throughout.)*
4. **Say it plainly.** No compressed or aphoristic phrasing that the reader has to decode. If a
   phrase needs a second reading, expand it into what it means. Prefer “this work is complete the
   moment I do it; it does not depend on how things turn out” to “that work is finished in the
   doing”. Avoid invented metaphors.
   *23 Nov 2026: “Bits like this aren't clear enough: ‘That work is finished in the doing’.”*
5. **Keep the page structure.** Topic tree, article cards, the statement above its subarticles,
   quotes on demand, removal of a passage, the section list with reasons.
   *23 Nov 2026: “Overall good direction and structure.”*
6. **Carry feedback forward.** Every piece of feedback is generalised and added here.
   *23 Nov 2026: “Any feedback that I give should be generalized and preserved in prompts.”*
7. **One statement, then labelled subarticles.** An article opens with one short statement (under
   140 characters). Everything else approaches that statement from a fixed set of sides, the same
   labels in every article and in the same order: **Why** (the ground), **In action** (what follows
   for what I do), **Practice** (an exercise I can repeat), **When it breaks** (what failing looks
   like, and the way back), **If I doubt it** (what still holds if the statement is not true). Each
   fused claim and each single-witness item sits under exactly one label. A label with no passage
   stays empty and says so in one sentence; never fill it with editor's words. On a wide screen the
   labels are columns side by side under the statement, so the sides can be compared at a glance;
   so keep each subarticle short enough to read in a narrow column.
   *23 Nov 2026: “One article makes a statement, subarticles approach this theme from other
   perspectives and try to expand it in dimension x, y and z, with x, y, z labeled somehow.” Then:
   “Do it.” Later the same day: “why, in action, practice. maybe show them as columns?”*
8. **Show several sources at once, component by component.** Split every sentence (the statement
   and each claim) into components and record which quotes back each one (`parts` on the statement,
   `gives` on each quote; one quote may back several components). Prefer wordings in which a
   component is said by two or more passages, and map a quote to every component its exact words
   really say, never to one they do not. Each statement part must rest on at least two passages. On
   the page the passage numbers sit in the text after each component, and the hover card lists the
   exact quotes for the words under the pointer and every other component with its passages.
   *23 Nov 2026: “There should be more statements that show more than one source at the same time
   and what component came from where.” Also: “do the hover thing.”*
9. **Give every quoted passage its own conclusion.** For each quote write one plain modern sentence
   (`follows`) saying what follows from that passage alone, before any fusion. It is shown in a
   column parallel to the passage, so the reader can check each step: Marcus's words, what follows
   from them, then what the passages give taken together. The conclusion must not borrow from other
   passages or from the fused claim's wording when the quote does not say it.
   *23 Nov 2026: “I think I also want a parallel conclusions column to show what follows from the
   passage.”*

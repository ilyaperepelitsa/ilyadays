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
   the page one coloured line runs under a component for each passage that says it (two lines, two
   passages), and the hover card lists the exact quotes for the words under the pointer and every
   other component with its passages. Passage numbers are printed in the text only on the
   statement; in subarticles they sit in the chips under the sentence, not above the words.
   *23 Nov 2026: “There should be more statements that show more than one source at the same time
   and what component came from where.” Also: “do the hover thing.”*
9. **Give every quoted passage its own conclusion.** For each quote write one plain modern sentence
   (`follows`) saying what follows from that passage alone, before any fusion. It is shown in a
   column parallel to the passage, so the reader can check each step: Marcus's words, what follows
   from them, then what the passages give taken together. The conclusion must not borrow from other
   passages or from the fused claim's wording when the quote does not say it.
   *23 Nov 2026: “I think I also want a parallel conclusions column to show what follows from the
   passage.”*
10. **Colour means one thing: the source passage.** Each source passage has one colour for the whole
    article, used for the lines under the words it backs, its chip, its quoted row and its dot on the
    map. Passages that meet in a claim or a statement part never share a colour (the build checks);
    five colours is the limit that stays distinguishable, including for colour-blind readers, so
    passages that never meet may share one and the chip always names the passage. Purple is kept for
    the editor's own work, the warning colour for a weakened claim, and everything else is neutral.
    Do not add markers above the words of subarticles.
    *23 Nov 2026: “Maybe don't do superscript above sub-statements? Or maybe do in different style?
    It's a bit too interfering but does a job of showing that it comes from different parts. Also
    you should figure out how to use color better here.”*
11. **Show the measurements behind the grouping.** Beside each statement, show the section's
    passages as a map of their vectors (two-dimensional layout of cosine distances, with the stress
    of the flattening stated), tied to the text: pointing at words picks out their passages and the
    similarity between them, and pointing at a passage picks out the words it backs. Give the exact
    pairwise similarities in a table under the map. A figure must state what it distorts. Also say
    where the section sits in the whole book: its nearest sections with their similarity, any
    member that is as close to another section as to its own, and how many outside passages are
    closer to its centre than its own farthest member.
    *23 Nov 2026: “I also wanna show some scientific part of this, maybe vectors and their distance
    or something? Show them on the right or left of the card?” Then: “Should we show additional
    info on the vector bit? Like what clusters it sits next to in Aurelius' writings?”*
12. **A second author is added to Marcus, and every word of his is marked as his.** Marcus's
    topics, claims and own wording stay as they are (rule 14 says how the body still changes). Another author's passages (first: Seneca's Letters, split at
    the standard section numbers) are found by embedding similarity to the article's own sentences and
    to its section, then read. Each one enters as exactly one of three effects, so the reader can be
    told “if you add Seneca, this article becomes …”: **Backs** (key `stronger`: a further witness
    to words of an existing claim), **Adds** (key `wider`: something Marcus does not say in this
    section, placed under one of the five labels, especially an empty one), or **Challenges** (key
    `qualified`: he limits or disagrees with a claim; state the difference and where he is
    inconsistent with himself). Every piece is an exact
    quote with its own conclusion. Write one sentence per article saying what it becomes, and say
    whether the statement stands. On the page the second author is switched on per article, his
    lines are black and dotted and his passages are squares, and where a passage was found by
    reading against the vectors, say so.
    *23 Nov 2026: “When I expand this with letters to stoic of Seneca, would it work well? In the
    format ‘if you add Seneca's thoughts, this article becomes x, y or z’.” Then, to the proposal of
    Gummere's translation and a paid embedding call: “both are fine.”*
    **An added author is quoted only in the project's own translation from the original language**
    (Seneca: `content/aurelius/translation/seneca-v1.json`, from the Latin, three readings like the Marcus
    translation). An older translation may be used privately to find passages by similarity, never quoted
    or published; the build refuses a quote that is not in the project's translation.
    *23 Nov 2026, after the rights facts on Gummere: “you have my approval for everything. let's translate
    seneca ourselves?”*
13. **Adding or removing an author is one tap, and nothing gets lost.** Authors are "voices" in one
    dock at the bottom of the screen (within thumb reach on a phone): Marcus is always there, each
    added author is a single switch that applies to every article and is kept in the link. When a
    voice is switched, the reader stays at the same place on the page, what the voice brings
    arrives visibly, and a short note says how much changed. Each article's strip says what it
    becomes, and its counts walk the reader to those places. Every added author has its own mark
    and line pattern, declared once in `authors`; the page has no author's name hard-coded. Build
    for a phone first: the five sides get a row of tabs that stays in reach and shows where a voice
    contributes.
    *23 Nov 2026: “Need to have good interface for adding-removing Seneca (and other authors we're
    gonna add later), need to be super natural. And don't forget to make it cool on mobile.”*
14. **Whose words these are is one quiet mark, and an added author changes the body.** Every bit of
    an article (claim, said-once item, an added author's item) is the same card with one plain
    border; the author's name sits in its corner (“Aurelius”, “Seneca”), shown only while an added
    author is switched on. No boxes inside boxes, no side stripes, no second panel for what an
    author thinks: the per-article strip is one sentence, three counts and one button. When an
    added author **adds** meaning to the statement or a claim, **changes** it, or **challenges** it,
    that goes into the sentence itself as one clause appended to Marcus's words (`voices.<author>.
    amend`: `target` is `statement` or a claim id, `kind` is `adds`, `changes`, `limits` or `challenges`, `t`
    continues the sentence and has no full stop, `ids` are that author's quoted pieces). The clause
    carries a small tag (“Seneca adds”, “Seneca challenges”) and that author's line pattern, and it
    disappears when the author is switched off. Marcus's words before it are never rewritten. One
    clause per sentence at most, under 140 characters, plain first person. Write a clause only when
    the author's exact quote says it. Whenever an author has an Adds or a Challenges item in an
    article, at least one clause appears in its body; an author who only backs what Marcus says
    leaves the body as it is.
    *23 Nov 2026: “Seneca bits and Aurelius bits should just have one color border and have ‘M’ or
    ‘S’ in the corner or ‘Aurelius’ and ‘Seneca’, current thing is too bulky. Also doesn't show any
    additions to article body. And it should if Seneca adds meaning or changes it or challenges.”*
15. **The vectors are a column of their own.** On a wide screen the measurements (rule 11) stand in
    a separate column to the right of the text and stay beside it while the reader scrolls; their
    height must never push the five sides down or sideways. The column leads with three numbers,
    then the map (the section's ground shaded, added authors as their own marks), a one-line
    readout of the similarity between whatever the reader is pointing at, and the nearest sections;
    explanations and the full table are folded. On a phone the same block sits between the
    statement and the sides.
    *23 Nov 2026: “Let's design the vectors bit a bit better. It should be separate column and not
    move the ‘why’, ‘in action’ etc.”*
16. **Read an added author's quote where it stands.** Before a quote of an added author backs
    anything, read the passage around it and write one sentence (`context`, 20 to 200 characters)
    saying what that passage is about and what the quote's key noun or pronoun refers to. If the
    context is about something else than the claim, the quote is not evidence for it, however well
    its words match. The page shows the sentence under the quote.
    *23 Nov 2026, second review of Article 6: an exact span of Seneca about everything perishing
    was used to back a clause about working together (Ep. 71.13). Accepted by the owner with the
    plan that followed.*
17. **Search by words as well as by vectors, and log it.** For every added author, search the
    corpus for the section's own key words before choosing passages, and record in `searched` the
    words searched and, for each passage considered and rejected, its reference and a reason in a
    few words. At least three searches. The log stays in the authored record.
    *23 Nov 2026, second review: passages the vectors ranked low were missed, and nothing recorded
    what had been looked for.*
18. **A clause never says more than its quote, and "challenges" is for a real disagreement.** A
    clause appended to a statement or claim names the items it comes from (`from`) and cites only
    their quotes. Test each clause twice: does it say more than its quote says in context; and, if
    it is marked as a challenge, would the two authors really disagree? If the added author only
    adds, mark it `adds`; if he narrows a claim without contradicting it, mark it `limits`, and it
    must come from a `qualified` item on that same claim; if nothing real remains, drop the clause.
    A clause's tag and the count it falls under must agree: a reader who sees “Limits 1” and then a
    clause tagged “adds” cannot find the limit. *(23 Nov 2026, second cold reader: Article 6's
    limiting clause was tagged “Seneca adds”.)*
    *23 Nov 2026, second review: Ep. 96.2 supports receiving hardship willingly, not wanting it;
    asking for joy outright does not contradict praying for everyone.*
19. **Mark the editor's inferences.** A "so", "therefore" or "because" that no passage says is
    recorded in `inferences` on the statement or claim, with one sentence of why the step is the
    editor's. It is never inside words a passage backs. The page names it "The editor's inference"
    when the reader picks it. A fused claim also needs at least one component that two of its
    passages both say; a passage about one thing must not be stretched to back another (cosmic
    order is not personal benefit; "all things go to you" is not "all work toward one end").
    *23 Nov 2026, second review: "…so I want what the world wants" presented the editor's step as
    Marcus's; 4.19 "to thee all tend" was made to back "work toward one end".*
20. **Evidence in today's English, with the Greek and the older translation on request.** Where
    the project's own translation of a passage exists (`content/aurelius/translation/`), an
    article quotes that English, shows the standard reference of modern editions with Casaubon's
    number beside it, and keeps the Greek and Casaubon one tap away. A reader must be able to
    judge whether Marcus supports a claim without first translating 1634 English. Where the Greek
    settles a question Casaubon cannot (he adds "not every one for himself in particular alone" to
    5.7; the Greek ends at "simply and freely"), the article follows the Greek and says so.
    *23 Nov 2026, the owner's request recorded in the second review: a project translation of the
    Meditations from the Greek into contemporary English; "drive it to completion please.
    including the translations".*
21. **Vectors follow the text the reader is shown.** When a passage has a project translation, embed
    that translation with the same model before an article quotes it, and report the article's
    closeness on the new vectors, with the older figure beside it. The build refuses an article
    anchored in a translation whose passages are not embedded. Say plainly on the page which text
    the sections were grouped on. The clean order for the whole book is: translate, embed, group,
    then write; grouping done on an older translation is provisional once a newer one exists.
    *23 Nov 2026: “maybe we should've translated source ones first? into modern english, so that we
    have modern english meditations. and then constitution? if that's the way we doing it - fine,
    just make sure to do embeddings on new translation”.*
22. **Every line a reader meets alone must stand alone.** A context sentence is read under one
    quote with nothing else in view: name the letter and what is going on, never “same letter as
    …”. When two numberings are in play, give them in pairs (“10.22 is 10.21 in modern editions”),
    never as two separate lists. A decision never claims more for a sentence than the article's
    own markings do: if the shared words are marked as the editor's summary, the decision says so.
    *(23 Nov 2026, second cold reader: a context that pointed at another quote; a list of modern
    numbers with no pairs; a decision that said “both passages say” over words marked as the
    editor's.)*
23. **Translate a section with three readers, and keep the briefs.** A section's passages are translated
    from the Greek by the procedure in `translation-translator.md`, `translation-checker.md` and
    `translation-settler.md` (this folder): a first translator who sees only the Greek; a second
    reader who sees only the Greek and the English; a third who settles every point in writing. The
    renderings already settled are in `translation-glossary.md`; add to it when a new term is
    fixed. Match each 1634 passage to the Greek by reading its opening and ending beside the Greek,
    not by its number: the 1634 translation joins chapters, cuts inside them, and puts the start of
    Book 2 at the end of Book 1. A passage that is part of a chapter says what it leaves out. Where
    the Greek is damaged or a reading is from memory, the English and the notes say so; nothing is
    smoothed over. Embed the new English before any article quotes it (rule 21). Record what the
    owner says about a translation in their own words, with the reading of it marked as the
    editor's. *(23 Nov 2026: the owner read the first six passages and said “looks good”; the 59
    passages behind Articles 1 to 5 were then translated this way.)*
24. **Other languages are made from the settled text, and from the Greek.** A translation into
    another language (the owner asked about Russian on 23 Nov 2026: “do we also translate to russian
    right away? or just translate final stuff”) is made only once a section's English is settled
    and the articles that quote it have the owner's verdict, and it is made from the Greek with the
    settled decisions on open readings, not from the English. This is the editor's recommendation;
    the owner has not yet confirmed it.


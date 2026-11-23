# Audit of Articles 1 to 5 (plan 34, row A8)

23 November 2026 · [the plan](34-after-review-plan.md) · [the running log](35-completion-log.md)

Each article was audited separately, on a private copy, against the rules the second review produced (article prompt, rules 16 to 19): read every Seneca quote where it stands in its letter; search by words and log it; test every clause (does it say more than its quote; is a "challenge" a real disagreement); narrow every conclusion to its own quote; correct mappings that give a passage words it does not say, even when the count falls; mark the editor's inferences. The audits below are as each auditor wrote them. All five are merged into the record and pass the build and the tests.

## At a glance

| Article | Shared components before → after | Marcus's wording | Seneca |
|---|---|---|---|
| 1 A member of one body | 7/22 → 9/22 (now meets the bar) | **unchanged** (approved by the owner); three rewordings proposed, not made | 7 pieces kept; the one "challenge" was not a disagreement and is now an addition |
| 2 The work that belongs to me | 10/15 → 9/15 (false mappings removed) | unchanged apart from mappings | Ep. 92.11 removed, Ep. 14.16 in its place; Ep. 85.38 added; the "challenge" became an addition |
| 3 What happens to me | 9/17 → 12/20 | **claims 1 and 2 reworded** to what each passage says | 12 pieces kept; the "challenge" (Ep. 67.4) became an addition |
| 4 The reason that governs the whole | 5/16 → 11/20 (now meets the bar) | **statement changed** ("the same kind of thing" → "alike"); one new claim on calm | 3 pieces replaced after reading their letters; the "challenge" dropped |
| 5 What I was made for | 0/9 → 5/14 (now meets the bar) | **statement and claims rebuilt** on what two passages say | Ep. 71.13 removed; several pieces moved; the "challenge" and one clause dropped |

**What needs your verdict:** the changed statements of Articles 4 and 5; the reworded claims of Article 3; the three proposals for Article 1; and the points each audit lists under "Not settled" or "Proposed, not done".

**One pattern across all five:** every "challenge" by Seneca failed the test of real disagreement. No article now has a challenge. Either Seneca and Marcus disagree less in these sections than the first drafts claimed, or the disagreements are in passages not yet found.

---

## Audit: Article 1, "A member of one body"

**Share: 7/22 before, 9/22 after. The bar (a third) is now met: run with `STOIC_KNOWN_BELOW=4,5`.** No word of the statement, the claims or the said-once items was changed.

**How the share rose.** Two passages already in a claim said its words outright and were not quoted. Either alone gives 8/22.
- Claim 2, "for one another": 5.15 says "those things that are best, are made one for another … those best that have rational souls" (new `5.15c`; shared with 9.7).
- Claim 4, "from the whole": 8.32 says "divided himself from the whole" (new `8.32d`; shared with 11.7).

**False mappings corrected** (none raises the share).
- Statement, "a member of one body": 9.21 says "member … of a common society", not body. Split into "a member" (7.10, 9.21) and "of one body" (7.10; 11.7 "the whole body").
- Statement, "of reasoning beings": 12.23b names no beings; replaced by 7.10a ("reasonable creatures").
- Statement, "made for a shared life": 5.15a says society is our good, not that we are made for it; replaced by its next sentence, "we are made for society" (new `5.15b`).
- `4.4a` backed "citizens" with a quote that has none; extended back to "then are we fellow-citizens".
- Seneca `S95.52b` backed "for one another" with "related to one another"; extended by "mutual affection … prone to friendships".
- Left, the weakest that remains: `7.10f` for "our own good".

**`follows` narrowed** (each borrowed from outside its quote): `4.4a` "Because reason is common to all, all people are fellow citizens…" → "We are fellow citizens, partners in one commonwealth, and the world is like a city." `12.23a` "One thing can be present in many places…" → "The light of the sun is one, even where walls and mountains block it." `11.7g` "Cutting myself off from one person cuts me off from everyone" → "In the same act, and without knowing it, he separates himself from the whole body of people." `9.21d` "An action that ignores the common good is like…" → "It is like a man who breaks away from a united people…". Smaller trims: `12.23b`, `7.10b`, `8.32b`, `11.7d`, `S95.52a`, `S95.53a`. Quotes extended so the sentence holds: `11.19b`, `8.32a`, `S48.2a`, `S95.52c`.

**Seneca.** All seven pieces have `context`; none removed. Six stand in Ep. 95.51–53, his "rule for our duties in human relationships", and mean there what the article uses them for; 48.2 opens on friendship and widens to all people in 48.3.
- **The one "challenge" was not one.** `q1` (Ep. 7.8, "Withdraw into yourself") and its clause on claim 4, "— though stepping back from the crowd to keep better company is not cutting myself off", failed both tests. Seneca never speaks of cutting off, so the clause said more than the quote. And Marcus's claim is about hating; the same sentence of Seneca says "nor should you hate the many" (Letter 7 is about crowds unsettling a character not yet firm; in 8.1 he withdrew "to help a greater number"). Clause dropped; the item is now an addition, `w4`, under "When it breaks".
- The arch clause on the statement passes both tests, unchanged. "So" removed from item `w2`. `becomes` rewritten: Seneca disputes nothing here; the statement stands.
- Search log: 18 word searches, 21 passages rejected with reasons (Ep. 28.4 "this whole world is my country" is about travel; 92.30 "we are his members" are God's).

**Inferences.** Claim 5 "because": marked (11.7 and 8.32 credit the return to God; 9.7 speaks of flight, not return). Claim 3 "So": not marked; 9.21 says it itself ("so must every action of thine"). Elsewhere none. `shared` (claims 2, 5), `form`, decisions 1–2 and `limit` brought into line.

**Proposed, not done.**
1. Claim 1: "…every lit place one sun" → "…every lit place one **light**" (9.7 "but one light that we see by"; 12.23 "one light of the sun"). Share 10/23. I did not map 9.7 to "one sun": it says light.
2. Claim 5: "…, because nature is stronger…" → "…; nature is stronger…". Removes the only inference; share stays 9/22.
3. A real limit on claim 2, found by searching "society", Ep. 9.17–18: the wise man "could not live … without the society of man", yet "all the good will be limited to his own being". Marcus 5.15: "Society therefore is the proper good of a rational creature." Possible clause: " — though a wise person who has lost everyone still has all his good with him". Whether that is a disagreement or two ways of saying virtue is the good is yours to judge.

**Not settled.** 11.7 also says "a man that is divided from another man, is divided from the whole society". Read widely, that touches Seneca's withdrawal and `w4` would be a challenge after all; I read it with its next sentence ("hates and is averse").
**For the merge.** The fixture `tests/aurelius/fixtures/constitution-page-cases.json` still carries Article 1's old `q1`.

Build, last line: `placeholders awaiting N3: context on 53 of 60 added-author pieces, search log on 5 of 6 voices` (Article 1: `shared components 9/22`). Tests with `STOIC_KNOWN_BELOW=4,5`: `ℹ pass 17`, `ℹ fail 0`; last line `ℹ duration_ms 146.8135`.

---

## Audit of Article 2, "The work that belongs to me" (section c6.s2)

**Share: 10/15 before, 9/15 after.** The bar is 5 of 15, so the article still meets it. Two of the ten were not honest (see "False mappings"). One new quote from 5.14 adds one back; without it the share is 8/15.

Build, last line: `placeholders awaiting N3: context on 52 of 60 added-author pieces, search log on 5 of 6 voices`
Tests (`STOIC_KNOWN_BELOW=1,4,5`), last lines: `tests 17 / pass 17 / fail 0`

## False mappings corrected (Marcus)
- **Claim 5, 9.14.** Its quote was mapped to the whole of "The work is the act itself, not its result and not what I feel". 9.14 says action, not passion; it says nothing about results. That made "not its result" look shared by 5.14 and 9.14. Now 9.14 backs "The work is the act itself" and "not what I feel"; "not its result" rests on 5.14 alone.
- **Claim 5, 8.33.** The obstacle sentence was counted as two shared components because 8.33 was mapped to its second half only. Its quote now starts at "what crosses and impediments soever it meets with", and all three passages back the one sentence: one component, not two.
- **Claim 4, 8.6.** "Every particular nature hath content…" was mapped to "living according to my own nature" and not to "content", its own word. Now it backs "doing it makes me content". 7.8, which had no mapping, backs "living according to my own nature" with 6.31.
- **Claim 1, "This comes first".** Backed by nothing. Now mapped to 7.30 ("chief"), alone. 8.6 puts the item second. 8.25 says "first", but as I recall the Greek that is Casaubon's list order, not a ranking; I could not check the Greek here.
- **New quote, 5.14b** ("Reason, and rational power… content themselves with themselves, and their own proper operations") backs "The work is the act itself" beside 9.14. This is the one mapping I added that raises the share; strike it if it reads as a stretch.
- Checked and left: 8.37 (continence) under "I do not let its urges rule me"; 7.30 and 11.9 ("not deceived") under "what is false or uncertain"; the statement's four parts.

## `follows` narrowed
- 11.9a: quote widened to the whole sentence about justice, since the conclusion mentioned justice and the quote did not. Now "Justice cannot be kept by someone who is attached to worldly things, or is easily deceived, hasty or changeable."
- 7.30f: "A mind that keeps to these things reaches its goal, and so is happy" → "The mind then has its end, and with that its happiness."
- 8.33a: "…use any obstacle to further…" → "…use whatever obstacles it meets as material for what it set out to do" (quote widened to match).
- 8.25b, 8.6b: quotes widened to include the governing words ("That which is most proper unto a man, is, first…", "A reasonable nature doth then speed, when first…").
- Not fixable: 8.25c, 8.25d, 8.25e, 8.6a, 8.6d are list items whose conclusions lean on the opening words of their own sentence. Widening would swallow the other items. Left as they were.

## Seneca: pieces
- **Removed, Ep. 92.11** (claim 5). It is about things chosen (dinner, dress): the good is in the choosing, not the thing. It says nothing about how an action turns out. **Replaced by Ep. 14.16**, "the wise man regards the reason for all his actions, but not the results…", found by the word search.
- **Removed as a separate challenge, Ep. 14.1 first half** (item q1). Folded into S14.1a, which now quotes the whole sentence.
- **Added, Ep. 85.38** (claim 5, obstacles): poverty keeps the wise man from showing how a state is handled, so he shows how poverty is handled. The vectors missed it. It is an addition, not a swap; strike it if unwanted.
- Kept with context written: 102.18, 14.1, 65.22, 41.9 (quote widened), 76.10 (quote widened to include "What then is peculiar to man? Reason."), 62.1.
- Borderline, kept: 14.1 under "its urges" (Seneca means living for the body and fearing for it, wider than appetite); 76.10 (reason perfected, not work under way); 65.22 (a resolve, not "was made"). Each context sentence says so.
- 62.1 (Practice): Seneca is writing about keeping time for study. The item's wording dropped "On a crowded day" from the sentence, and its reason no longer claims "when business cannot be avoided".

## Clauses
- The one clause, on claim 2, failed both tests. It said "does not mean despising the body: it is mine to look after", which its quote does not say, and Seneca himself says "to despise our bodies is sure freedom" (65.22). And it is no disagreement: allowing the body something does not contradict refusing to be ruled by it. Now **adds**: "; I may still indulge it somewhat". Seneca's count of challenges goes from 1 to 0.
- Seneca's sentence on the statement said he gives "the same reason". Marcus does not give it here. Now: "Seneca names its ground outright: reason is what is peculiar to a human being."

## Inferences
None marked. "That is why" in claim 4 is Marcus's own step (6.31: "if it be not against nature, then neither is it hurtful"; 8.6: content "when in its own proper course it speeds"). "Let reason lead" is the editor's summary; the decisions now say exactly how far 7.30 and 7.8 carry it.

## Proposed, not done
- Move "This comes first" to said-once, or drop it: one passage ranks it, one puts it second.
- Ep. 13.8 ("we agree too quickly with what people say") for claim 3, which has no Seneca. It is about rumours of trouble, so I logged it as rejected.

## Not settled
- 7.30f: "her happiness" may be Casaubon's expansion (I recall the Greek as "it has what is its own"). 9.14: "passion" is, I believe, "what is done to one" in the Greek, which would make "not what I feel" too narrow. Both need the translator.
- The memory preflight I ran wrote a packet file under `.codex-memory/authoring-packets/` in the repo. Nothing else in the repo was touched.

---

## Article 3, "What happens to me": audit

**Share: 9 of 17 before, 12 of 20 after.** It went up, but not by looking for a higher number: four mappings were false or loose and were removed, and three true ones that were simply missing were added. Without the added ones it would be 9 of 19, still above the bar (a third).

## False or loose mappings corrected (Marcus)
- **7.6 "All things are linked and knitted together" backed "chain of causes".** It says things are linked, not that causes bring events to me. Claim 1 now has the words it does say, "All things are linked together", shared with 4.36.
- **4.36 "not a bare succession" backed "not a random blow from outside".** No passage says "from outside", and 4.36 contrasts order with a bare sequence, not with chance. The words are gone. "Is not chance" now rests on 1.17 (things "said to happen by fortune" depend on nature).
- **5.8 backed "the same chain of causes".** Only 10.5 says the same causes produced me. Reworded to "a chain of causes, the same that produced me" so each passage backs its own part.
- **9.38 backed "what serves the whole is not bad for the part".** 9.38 says a part has no reason to complain; it does not speak of harm. 1.17 says "good", which is more. Claim 2 now says both, each from its own passage.
- Claim 1 before: "What happens to me is not a random blow from outside. It comes from the same chain of causes that produced me." After: "What happens to me is not chance. All things are linked together, and it comes from a chain of causes, the same that produced me."
- Claim 2 before: "…and what serves the whole is not bad for the part." After: "…What serves the whole is good for every part, and a part has no reason to complain of it."
- True mappings added: 3.17 "fit and accommodate himself to his proper lot" for "fit myself to it" (same words as 6.35); 9.38 "as a part of one general body" for "of which I am a part"; and in claim 5 "if nothing governs the world" had no passage at all, though 9.26, 12.11, 6.39 and 9.38 all say it.
- The note on claim 5 said four passages end with "my own reason remains". Three do; 9.38 ends only with "why trouble yourself?". Corrected.

## Quotes lengthened so each conclusion follows from its own quote
1.17a, 1.17b, 1.17c, 9.38a, 9.38b, 5.8b (the "harsh" and "for health" were in the next sentence), 6.39a, 6.39b, 12.11a, 4.36c, 5.8g ("from the whole" was in the sentence before), and Seneca's 18.5 (the clothing and the question were outside the quote) and 107.9.

## `follows` narrowed
- 3.17a: "What marks a good person is welcoming everything…" → "The stance named here is to like and welcome everything that happens and is destined for me." (the good man is outside the quote; said in a note).
- 6.35b: "the people I happen to live among" → "the people it is my fate to live with".
- 1.17a, 1.17c, 6.39a, 5.8b, 5.8g: reworded to match the longer quotes.
- Seneca 96.2a: "What happens comes by order" → "Troubles like these come by order"; 107.2a: "Nothing that happens to me is unusual" → "Setbacks like these are neither unusual nor unexpected"; 16.5b now names philosophy as the teacher.

## Seneca
- **Context written for all 12 pieces; none removed.** Each quote, read in its letter, is about what the article uses it for.
- **The "challenge" was not one.** Ep. 67.4 ("I should prefer to be free from torture…") answers whether hardship is something to pray for. Marcus never says to wish for it, and Seneca himself is pleased with what has come (96.2, 74.20). The item is now an addition under In action ("What I may still prefer"), with a second quote from the same section ("not that hardships are desirable, but that virtue is desirable"). The clause on the claim is dropped: the build lets an addition attach a clause only to the statement, which already has one. Article 3 now has no Challenges item.
- Statement clause (thinking ahead): passes both tests, unchanged.
- "Refusing changes nothing" → "Refusing does not spare me": in the hymn the unwilling still go, but worse off, so something does change. Its note now admits Marcus touches this in 12.11 ("why doest thou resist?").
- "chance I only endure" → "chance I endure"; "a few days at a time" → "a set number of days" (the quote's words).
- Thinking ahead: the note now says Seneca also warns against it (Ep. 13.10, do not run out to meet suffering).
- Search log: 13 word searches, 18 passages rejected with reasons.

## Inferences
None recorded. The one "so" (claim 4, "So I shall accept it") is Marcus's own: 5.8 says "therefore" and "then", and gives the chain of causes and the good of the whole as its two reasons. "And more than accept it" is the editor's link and rests on no quote; the claim's note now says so.

## Also corrected
- "No passage in this section gives an exercise" was untrue: 3.12, set aside, has one. The sentence now says so.
- `limit` gains one line: "good for me" has one witness here (1.17), and Article 6 returns to it.
- Statement note: "do not complain" gathers three wordings (complain, be displeased, trouble yourself).

## Proposed, not done
- Add Ep. 98.5 as a Practice item: at each mishap say "Heaven decreed better". It is closer to this article than the poverty rehearsal (18.5).
- Move 3.12 from "set aside" to a said-once Practice item, so Marcus fills his own empty label.
- 6.39's last line ("what is expedient to those cities is the only good for me") could be a second witness for "good for every part". Left out: it is about what to aim at, not about what happens.

## Not settled
- Whether the owner wants "good for every part" back in claim 2 (the earlier draft softened it on purpose).
- Page fixtures that hold a copy of Article 3 with the old challenge item (`q1`) need regenerating.

## Runs
- Build, last line: `placeholders awaiting N3: context on 47 of 61 added-author pieces, search log on 5 of 6 voices` (Article 3: `shared components 12/20`).
- Tests (`STOIC_KNOWN_BELOW=1,4,5`): `pass 17`, `fail 0`.

---

## Audit of Article 4, "The reason that governs the whole" (section c6.s4, 12 passages)

**Share: 5/16 before, 11/20 after.** The bar is a third, so Article 4 comes off `STOIC_KNOWN_BELOW` (now `1,5`). Two of the new shared mappings are the least literal and are marked * below; without them (and without the new claim on calm) it would be 9/18, still above the bar.

**The statement changed, and this is the owner's call.** Before: "…are the same kind of thing". After: "The reason that orders the world and the reason that guides me are alike." Only 5.18 says "of one kind". Its second witness, 4.22, argues from order in me to order in the whole, which is a likeness and not sameness of kind. "Of one kind" stays in claim 3, resting on 5.18 alone. 4.22b (order, no word of reason) was also taken off "The reason that orders the world".

**False or empty mappings corrected (Marcus)**
- 7.44b ("This often thought upon…") backed "I shall make a habit" of asking for causes. Its "this" is the world's governing deliberation, not causes. It moved to a new claim with 6.8, which ends the same way: "Thinking of the world as governed makes me calm, and I can be patient and trust what governs it" (under "In action").
- 7.44a (care for reasoning beings) and 4.22a sat in claims backing no words. 7.44a is now "said once", as a condition. 4.22a now backs "What I find in myself I can expect in the whole", with 6.23, which argues the same way.
- 4.33c ("connection and concatenation") backed "what causes each thing". It now backs "all things in it are bound to one another", with 4.22. That replaces "each thing helps to cause the others", which only 4.33 says.
- Claim 2: "what looks harmful" became "what is harmful" (6.33 says "all hurtful things"). Claim 3: "in me" dropped from "turns everything else in me to its use" (5.18 says "all other things").
- New shared components, each read in both passages: "everything that happens comes from it" (6.1, 6.33, 7.44); habit (4.33 "Ever consider", 10.26 "thou must use to behold"); "what causes each thing" (10.26, 9.23, 4.33); *"the one source of all things" (6.33, and 4.33 "done by one general motion… of that one soul"); *calm (7.44, and 6.8, where it is conditional).
- Still single in their claims: no cause to do evil (6.1), for community (5.24), harm follows from good (6.33), of one kind (5.18), moves itself (6.7), the power at work (10.26), apart from matter (9.23).

**Seneca pieces: 3 removed, 3 put in their place, 7 kept, all 10 with context**
- S65.12a "It is surely Creative Reason": "it" is the first cause, not what governs. Replaced by S92.1b, "the divine reason also is set in supreme command over all things".
- S65.24a "God's place in the universe corresponds to the soul's relation to man": a likeness of position (God to matter as soul to body), used for "of one kind". Replaced by S92.1c, the rational part "refers all things to itself", backing "turns everything else to its use".
- S65.2a "Matter lies sluggish…": about inert matter, used for "considered apart from its matter". Replaced by S90.29a, the force in the seeds of things, backing "the power at work".
- Kept, context fits: S95.52a, S95.49a, S92.1a, S65.12b, S95.50a, S107.12a, S95.50b.

**Clauses**
- On claim 2, "challenges", "though in guarding all of us it may at times overlook one of us": dropped. It failed the second test: 7.44 speaks of particular care only as a possibility, and Seneca says in the same section that the gods give no evil. The item is now an addition under "Why" ("Where its care may stop"); no challenge remains.
- On the statement, "and the way to honour it is to be good" became "and to imitate what orders the world, by being good, is worship enough". Seneca calls imitation sufficient, not the way; "it" was unclear.

**`follows` narrowed**
- 4.22b: "The world is an ordered whole." → "One possibility is that the world is a well-made whole, because all in it is arranged and governed by order."
- 6.8a: "The world is a unity, ordered and governed by providence." → "The second possibility is that the world is a unity made of order and run by providence."
- 6.33b: "…the one source that everything comes from." → "…the true source of everything."
- 4.33a, 5.18a, 5.18b, 5.18c: reworded to fit quotes that were re-cut so no two overlap.
- S95.50a: "To honour the gods, imitate them by being good." → "To win over the gods, be a good man; imitating them is worship enough." S107.12a now keeps "weak"; S95.50b says "sometimes unmindful".

**Inferences:** none found. No "so", "therefore" or "because" in the statement or claims that a passage does not say.

**Proposed, not done**
- 5.24 "sub-ordinated, and co-ordinated" is the one unconditional witness to "ordered throughout" (4.22 and 6.8 each give order as one of two cases, now noted). Adding it fails the colour test: a valid five-colour assignment exists, but the build's colouring does not find it.
- Ep. 65.15 and Ep. 76.23 would back the new claim on calm. Held back so that nothing is added without the owner.

**Not settled:** whether "alike" is too weak a statement for the owner; the two * mappings; whether the calm claim belongs under "In action" or "Practice".

Build, last line: `placeholders awaiting N3: context on 50 of 60 added-author pieces, search log on 5 of 6 voices` (Article 4: `shared components 11/20`).
Tests, with `STOIC_KNOWN_BELOW=1,5`: `tests 17, pass 17, fail 0`.

---

## Audit of Article 5, "What I was made for" (section c6.s5, 7 passages)

**Share of claim components said by two passages: 0 of 9 before, 5 of 14 after.** The bar for a section this small is one, so Article 5 comes off `STOIC_KNOWN_BELOW` (now `1,4`). No mapping was invented to get there; the list below says what each pair of passages really shares.

## Marcus's side

The old claims gave every phrase to one passage. Reading the seven passages again, three things are said twice:

1. **8.17 and 9.8 both speak of everything, and both name the gods.** They do not say the same thing about it: 8.17 says "made for something", 9.8 says "bear some fruits". Claim 1 now keeps those as two phrases, each on its own passage, and shares only "Everything that exists" and "the gods included". ("Everything that exists" from 9.8's "All things have their proper time to bear" is the weaker of the two.)
2. **6.13 and 9.8 both say reason is by nature not private**: "reasonable and naturally sociable"; "Reason is of a diffusive nature … it begets in others". Claim 2 now has "Reason by its nature turns toward other people" on both.
3. **8.48 and 3.2 both speak of the rotten and the old, and both appeal to the person "acquainted with nature".** Claim 3 shares those two components. That nature reuses such things is 8.48 alone; that they are pleasing is 3.2 alone.

False mappings corrected:
- Statement, "my purpose is not my own amusement", cited 9.8c (reason bears fruit for others and for itself). It does not say that. Only 8.17 does.
- Statement, "I exist for a purpose, as everything does", cited 9.8a, which says "bear some fruits", not "made for".
- 7.4 was listed under claim 1 and backed none of its words. It is about seeing the use of each action. It is now a said-once practice.
- 8.48a's sentence included "and I do not add: what are such things for", which belongs to the next quote. Trimmed; the quote now includes "Let this suffice."

**The statement had to change.** Before: "I exist for a purpose, as everything does, and my purpose is not my own amusement." After: "Like everything that exists, the gods included, I am made for something, namely to use my reason, which by nature turns toward others." A statement part must rest on two passages in a section of this size, and "not my own amusement" rests on one. It stays in claim 2. "I am made for something" is also 8.17 alone, so it has no source line in the statement (the notes say so).

Inferences marked: "namely" in the statement and "but" in claim 2. 8.17 asks what I was made for and only rules out pleasure; the answer (reason) is the editor's, from 6.13 and 9.8.

`follows` narrowed: 9.8a "Every kind of thing produces something of its own" → "Man, God and the world each bear fruit of their own kind"; 9.8b "Each thing produces it at its proper time" → "Everything has its proper time to bear fruit"; 8.17c "It is absurd to think I was made for my own pleasure" → "I should ask what I was made for, and whether it can be to amuse and please myself" (the absurdity is in the next quote); 6.13a dropped "a person who values reason"; 3.2a added "to natural things"; 3.2b dropped "someone who looks closely". The rest were sound.

`decisions` and `limit` rewritten. The stale decision about "the last sentence of the thought" is gone; the tension between 8.17 (everything is for something) and 8.48 (do not ask what a bitter thing is for) is now stated and left unreconciled.

## Seneca

Pieces removed or moved (8 before, 15 now; every one has its context):
- **S71.13a removed.** "Appointed times" are the times of being born, growing and being destroyed, in a passage on everything perishing. It is not about bearing fruit in season.
- **S71.13b replaced by Ep. 36.10.** 71.13 says things are "resolved into their elements"; 36.10 says they are re-absorbed into the world and come forth again, which is nearer 8.48. Both are about death, not waste, and the context line says so. It backs only "she takes it back into herself".
- **S60.4a moved** from claim 2 to the "When it breaks" addition. It is about a person being of use, not about reason's fruit. Replaced in claim 2 by Ep. 85.37: wisdom is "both the good of others, and also his own".
- **S55.5a moved** from "not to please myself" to "When it breaks". "This person" is a man hiding from life out of fear, not someone enjoying himself.
- **S76.10a moved** into a new addition under "Why" (below). S76.8a kept: no fault found.
- Found by word search, missed by the vectors: Ep. 41.8, 85.37, 36.10, 12.4. Ep. 12.4 (old age "is full of pleasure … Fruits are most welcome when almost over") now backs the 3.2 half of claim 3.

Clauses and items:
- **The "challenge" on claim 2 is dropped as a challenge** (failed both tests). "Real joy is a stern matter" does not disagree with "not made for pleasure": Seneca separates joy from pleasure in the same letter, and Marcus has reason enjoying its own fruit in 9.8. Its note also said Marcus says this "not in this section", which is wrong. It is now an addition under "In action", worded only from Ep. 23.3, 23.4 and 23.6.
- **The statement clause "though doing the work brings a joy of its own, and a stern one" is dropped** (says more than its quote: Ep. 23.4 does not mention work).
- **New statement clause, marked "adds"**: ", for reason brought to perfection is the good that nature designed me for at birth" (Ep. 41.8). Seneca says outright the step that is the editor's inference on Marcus's side.
- "When it breaks": "To fail at this is…" and "of use to no one" were the editor's words. Reworded to Seneca's own, with "he has died before he is dead" now quoted.

Search log: 14 word searches, 19 passages rejected with reasons.

## Proposed, not done
- If you want "not my own amusement" back in the statement, the rule that every statement part rests on two passages needs an exception for a marked single-witness part. I did not touch the tests.
- Ep. 12.1–4 (Seneca scolding his old house, old trees and old slave, then "cherish old age") could carry an addition under "If I doubt it". I only used one quote.

## Not settled
- Whether a shared subject ("everything", "the gods") is enough of a shared component for claim 1, given that the two passages say different things about it. I think it is honest as marked, but it is the thinnest of the three fusions.

## Build and tests on the copy
- Build, Article 5 line: `Article 5 'What I was made for': 6 of 7 passages, claim 1 from 2 (0.532), claim 2 from 3 (0.535), claim 3 from 2 (0.575), 3 said once; section closeness 0.506; shared components 5/14`
- Build, last line: `placeholders awaiting N3: context on 52 of 67 added-author pieces, search log on 5 of 6 voices` (none of them in Article 5)
- Tests with `STOIC_KNOWN_BELOW=1,4`: `pass 17`, `fail 0`

---


# Points for the owner: Articles 7 to 38

Written 23 November 2026 when the 32 new articles went into the record. Each article was written from the project's English,
gated, reviewed independently, polished after a reading of all 38 articles side by side, and its references checked
(log: `36-finish-log.md`). Nothing here is pushed. What needs your word:

## Decisions waiting on you

1. **Sections that overlap heavily (candidates for merging; nothing was moved, per the standing decision).** The cross-reading
   found that Article 17 restated Article 10 almost whole, Article 36 repeated parts of 10, 32, 33 and 34, Article 23's one claim
   is Article 22's claim 1, Articles 11 and 20 share the "take it apart" exercise, and Articles 16 and 18 made the same claim.
   Each now says what its own section adds and names the other in `limit`. Merging any of these sections is your call.
2. **Article 29 (c7.s3, "Short sayings") has no fused claim** (`unfused`): five separate sayings. Its writer recommends no article.
3. **Article 8's statement is challenged by Seneca.** "Nothing happens to me that I cannot bear": with Seneca on, the page says
   this part does not stand as worded (a pain I cannot bear may still come, and then it is short).
4. **Article 23 rests on one reading of the Greek** (6.50, ἂν προσεῖχον read as first person; the Greek allows but does not require it).
5. **Article 6's Seneca clause** ("what is hard in it I pay willingly, as a tax on being alive") is tagged "adds"; a reviewer argued it
   narrows the statement and should be "limits". I left it.
6. **Five articles got one extra narrow review round** beyond the two allowed (8, 14, 15, 31, 35), each for a single exact fix.
7. **Translation, 7.23:** "Not in the least" can read in English as a denial, though the Greek agrees (noticed by a reviewer).
8. **Gate warnings:** 74 warnings, 0 blocking (mostly a conclusion that repeats its quote, or a said-once item not in the
   first person). `apps/aurelius/.venv/bin/python scripts/aurelius-qa.py articles` lists them.
9. **Chapter 7 retitled** "Praise, harm and the worth of things" (was "Other minds, fame and harm"); chapters 1-3 got
   first-person summaries that match their articles. Say if you want the old wording back.
10. **Seneca is now the project’s own translation from the Latin** (your “let’s translate seneca ourselves?”): 304 sections, three
   readings each, every quote re-cut on the new English and reviewed (`content/aurelius/translation/seneca-v1.json`; log in
   `36-finish-log.md`). Gummere is no longer published; the build refuses any clause of his. Not yet read by you or by a Latin
   reader. Three places the settler kept against the checker, for a Latin reader: 51.9, 74.18, 95.53.
11. **Letter titles are new**, written from each letter’s Latin (they read like “On valuing and saving your time”).
12. **API spend:** $109.26 of the $129.50 you allowed for Seneca (translation $69, letter titles $2.41, re-quoting and reviews
   about $38); together with the earlier $169.85, about $279.

## Titles changed from the plan (12)

- Article 7 (c3.s1): “Opinion is in my power” → “My judgment is up to me”
- Article 8 (c3.s2): “Nothing happens that a human being cannot bear” → “What happens can be borne and does not harm me”
- Article 9 (c3.s3): “Gravity, and keeping the names I have taken” → “Keeping the few names I have given myself”
- Article 11 (c3.s5): “Falling short and beginning again” → “Coming back to my principles and keeping them ready”
- Article 15 (c3.s9): “What is not in my power” → “Blaming no one for what is not up to me”
- Article 16 (c3.s10): “The good spirit within” → “Happiness and unhappiness are my own doing”
- Article 20 (c2.s2): “Taking a thing apart: matter, form and end” → “Taking a thing apart: material, cause, purpose and time”
- Article 21 (c2.s3): “Clearing away opinion and impulse” → “Wiping out impressions, checking impulses”
- Article 22 (c2.s4): “Being good for its own sake” → “Good whatever others say, and open to being set right”
- Article 25 (c2.s7): “Returning to myself” → “What I turn to”
- Article 31 (c7.s5): “The reasonable soul and its powers” → “How my soul uses itself”
- Article 35 (c5.s2): “The shortness of life” → “The length of a life and the use of its time”

Each writer gave its reason in its audit.

## Each article's own notes for the owner

## Article 7 · My judgment is up to me (accepted)

“What troubles me rests on my judgment; that judgment is up to me, and when I take it away there is calm.”

1. **Title changed in wording, not in meaning.** Provisional: “Opinion is in my power”. Used: “My judgment is up to me”. The project translation renders ὑπόληψις as “judgment” and ἐπὶ σοί as “up to you” throughout this section, and the title now uses the words the quotes use.
2. **The chapter reading was partial.** I read this section (c3.s1) in English, Greek and notes, and c3.s3 in English. c3.s2 (19 passages) prints “NOT TRANSLATED YET” for every passage, so it could not be read. The check against repeats was therefore made against Articles 1 to 6 and c3.s3 only.
3. **A “challenges” item that you may want to downgrade.** Seneca item q3 (on claim 5) is marked as a challenge: Ep. 13.13 tells Lucilius, where everything is in doubt, to “decide in your own favour; believe what you prefer”, and to lean to hope even if fear has the majority. Marcus (8.47, 4.9) says to add nothing and to see things as they are in truth. I judge this a real disagreement, but Seneca himself is ashamed of such mild remedies a few lines later (Ep. 13.14); the item says so. If you read it as no more than his milder style, the cautious change is to drop q3 and its clause; nothing else depends on it.
4. **9.30 is a cut sentence.** 9.30 (modern 9.32, opening) stops before its end: the Greek goes on to say by what means the open room is made, by taking the whole universe in thought, with endless time and the quick change of each thing. Claim 3 quotes only “you will at once make plenty of open room for yourself”, maps it only to “at once have plenty of open room”, and its `changed` and the decisions say that the room is not to be read as coming from removing a judgment alone.
5. **Doubts about the translation of passages I quote** (not changed; listed as required):
   - 8.38 (modern 8.40), “let that form its own judgment about itself”: the translators’ note gives the other reading “let it suppose so about itself”. Claim 4 follows the printed reading. The “anything else of yours” is not named in the Greek; I read it beside 7.13’s “little body” and say so in the decisions.
   - 8.38, “what seems to distress you”: may be masculine, “the person who seems to distress you”. Claim 3 follows the neuter.
   - 6.47 (modern 6.52), “about this”: may be “about this man”. Claim 2 generalises to any matter.
   - 8.47 (modern 8.49), “the impressions that lead the way”: may be “the principal impressions”. Claim 5 says “my first impressions”, the words 8.47 itself uses a few lines later.
   - 8.38, “let that form its own judgment about itself” is rendered in claim 4 as “can judge that for itself”; the other reading (“let it suppose so about itself”) gives much the same sense, and claim 4’s `changed` says so.
   - 2.13 (modern 2.15), “what is said in answer to Monimus”: the preposition may mean “to” and not “in answer to”. The said-once item under “If I doubt it” (“can be answered, and the answers are plain”) depends on the printed reading.
   - 7.13 (modern 7.16), “it does not frighten itself into desire” and “you will not lead it to such a verdict”: the notes say the text has been doubted. Neither is quoted.
6. **No label is empty**, so `empty` is `{}`. “When it breaks” and “If I doubt it” rest on said-once items only (7.2; 2.13 and 8.38).

## Article 8 · What happens can be borne and does not harm me (accepted)

“Nothing happens to me that I cannot bear; what happens harms me only if I judge it bad, and it does not stop me from being good and just.”

1. **Part of the statement is near Article 7’s (draft, c3.s1, “My judgment is up to me”).** Article 7 says that what troubles me rests on my judgment, and its claim 4 leaves the body’s pain to the body. The middle part of this statement (“what happens harms me only if I judge it bad”) and claims 2 and 3 say much the same from this section’s own passages. I kept them because harm and the judgment that makes it are what most passages of this section are about (4.32, 7.11, 4.7, 8.45, 8.26, 5.16); the statement’s other two parts, bearing and not being stopped from being good, are what this section adds. Said in `limit`. If the owner wants no overlap at all, the statement can drop its middle part and claims 2 and 3 can move under Article 7.
2. **Title changed.** Provisional: “Nothing happens that a human being cannot bear”. Mine: “What happens can be borne and does not harm me”. The provisional title fits 8.45, 4.41, 5.16 and 10.3, but most of the central passages (10.33, 4.32, 5.19, 7.29, and also 7.11, 4.7, 8.39, 5.29) speak of harm and of the judgment that makes it. The new title keeps bearing and adds harm; it widens the meaning and does not replace it.
3. **Six claims, where the brief aims at 3 to 5 and the plan expected 4 to 5.** The sixth (c6, 8.34 with 7.35) is a real parallel: both passages use “unbearable” and both deny it of a thing taken without additions. Merging it into c5 would put six passages in one claim (over the five-colour limit). If six is too many, c6 is the one to turn back into two said-once items under Practice.
4. **Only one passage is set aside (8.41)**, where the plan expected several. Every other passage is on the topic and says something the article uses. Nine items are said once; the weakest to drop would be 5.16b (“Outdone by ignorance”) and 5.29a (“Help without alarm”).
5. **The statement is unconditional; 10.3 is not.** 5.16 and 8.45 say flatly that nothing happens that cannot be borne. 10.3 allows a second case (“not fitted by nature to bear”) and answers it. That case, and 8.45’s exit from life, stand under “If I doubt it”; the decisions and the limit say so.
6. **Doubts about the translation of passages I quote** (I changed nothing):
   - 5.20c “by the other shared feeling”: the notes call the Greek obscure and the text doubted. The said-once item rests on the clear part (“one should not try to go against the sensation, which is natural”).
   - 8.39c “if you accept the common lot”: the notes say what “the common” is is not clear (the common lot, the general rule, or the usual reservation). The item’s second sentence depends on the reading chosen.
   - 8.34a “are likely to have come on you”: a perfect where editors have proposed a future. The claim’s “not the rest of my life” covers both.
   - 8.26c “nothing climbs up to here”: some texts read “nothing bad”. The claim’s “Nothing from outside touches my mind” fits either.
   - 8.45e “the things that stand in the way”: may be “the people who stand in the way”. The item says “what stands in the way”.
   - 4.32a “what surrounds you”: may mean the body. Either way it is not the judging part, which is all the claim needs.
   - 9.41a ends in a cut sentence (“For not to stand away from philosophy in anything whatever that befalls”); the passage stops before its verb. The item says so in its “why”.
   - 5.29: the second half of the passage is corrupt (the Rostra sentence is a guess, by the notes). I quote only the sound sentence before it.
7. **Fixed on taking over the draft.** (1) Claim 1 had a component “usual and familiar” backed by 8.45 (“usual”) and 7.39 (“familiar”), two different words; it now says “usual and natural”, from 8.45 alone, and 7.39c is no longer quoted there. (2) “being good” in the statement and claim 4 was backed by 4.41, which says “just” and not “good”; both now say “good and just”, with 10.33 behind “good”, 4.41 and 7.29 behind “just”, and “prevents me” shared by 10.33 and 4.41. (3) 5.20c moved from “When it breaks” to “In action”: it is what I do when a feeling reaches the mind, not a failure. (4) Three `follows` sentences rewritten to stand alone (7.35b, 7.39a, 9.41a). (5) The decision on numbering now pairs every number, including 8.39 = 8.41a and 8.41 = 8.42–43. (6) The statement’s Seneca clause no longer says “simply”, which the quote does not.

## Article 9 · Keeping the few names I have given myself (accepted)

“I keep to the few names I have given myself, do each thing as someone about to leave life, and need no one as witness.”

1. **A line of 10.8 is left out of the first-person text (cautious choice, please confirm).** After “go away with a good heart to some corner where you will prevail”, Marcus adds “or even leave life altogether, not in anger, but simply, freely and modestly”. The said-once item “If I am not prevailing” quotes only the first half. I did not write “I leave life” as an article of a personal constitution; the decision is listed in `decisions`, and the full passage remains visible on the page. If you want Marcus’s second way out stated, the quote of `10.8i` can be extended to the end of that clause and the sentence added. For the same reason no Seneca passage on leaving life (Ep. 70.5) was used.

2. **Title changed.** Provisional: “Gravity, and keeping the names I have taken”. Mine: “Keeping the few names I have given myself”. Reason: “gravity” is the 1634 word; the project translation says “dignity”, and dignity is only one item in two of the three central lists (2.2, 6.27) and is absent from 10.8. What all three central passages share is a short list to be kept (“how few the things are … whoever keeps to these”, “keep yourself simple, good …”, “these few names”). “Given myself” is 10.8’s wording (“Having given yourself these names”).

3. **Six fused claims, where the brief aims at three to five.** Each of the six has at least one component that two passages both say (listed in (b)). Merging any two would have put unrelated passages together, so I kept six. Two of them are thin: the claim on show and witness (c3) and the claim on losing the names (c6) each have one shared component; `limit` says so.

4. **Translation points in passages I quote (not changed, only listed).**
   - 6.27 “unpretentious” renders ἄκομψον, “without polish” (translators’ note). In claim 1 it is matched with 2.2’s “unfeigned”. The match is closer in the English than in the Greek. Said in the claim’s `changed` and in `limit`.
   - 2.2 “a man” renders ἄρρην, “male”; 3.5 has the same word as “male”. Claim 4 treats the two as the same phrase, which the Greek supports.
   - 3.5 “who has set himself in order” (ἀνατεταχότος ἑαυτόν): the translators note the verb is unusual and the text has been doubted (their note says “from memory, unchecked”). Claim 4’s words “set myself in order” rest on it.
   - 10.8 “falling away” (ἐκπίπτεις, “fall out”) and 1.14 “fall short” (ἀπολείπεσθαι, “be left behind”): the shared word “fall” in claim 6 exists only in the English. Said in the claim’s `changed` and in `limit`.
   - 10.8, last sentence: read as what the gods want; it can also depend on “remember”. Listed in `decisions`.
   - 2.2 “god-fearing” (θεουδῆ) could be “godlike”; the claim leaves the word out.
   - 1.14: the “ruler and father” is not named in the Greek; my `follows` sentences say “ruler and father” and do not name Antoninus.

5. **Book 1 passage (1.14).** It is a list of thanks, not of lessons. It is used only where Marcus states something he holds or admits: no offence against those close to him (claim 5), a court that needs no show (claim 3), drawing in toward a private life without slackening as a leader (a said-once item, credited in `follows` to the “ruler and father”), falling short by his own fault (claim 6), and the rider that a clean record was partly the gods’ kindness (a said-once item).

6. **Overlapping spans.** `10.8c` (claim 2) contains the words of `10.8d` (claim 3) and of `10.8k` (claim 1). The build accepts it; each id backs different words.

## Article 10 · Living now as one about to die (accepted)

“Before long I shall be no one and nowhere, so I live the present justly, as one already at the end, and wait for death cheerfully.”

1. **Seneca on ending one’s own life is left out, on purpose, and the article says so.** Ep. 70.5 is a real difference from claim 4. Marcus (5.10) says to “wait for the natural dissolution, and not chafe at the delay”; Seneca says the wise man may set himself free when Fortune turns. He also cautions against it himself (Ep. 24.25, “the lust for death”). By the brief’s own test this would be a qualified item on claim 4 with a “limits” clause. I did not write a first-person clause about ending one’s life into a personal rule. After review 1, both strip sentences now say that this difference exists and is left out (`becomes`: “His allowance for ending one’s own life, which differs from waiting for the natural end, is left out of this article”; `statement` names Ep. 70.5 and claim 4). It is logged under `searched.rejected` (Ep. 70.5, 24.25, 70.17, 58.32). If you want it in, it is one qualified item on c4 with Ep. 70.5 and Ep. 24.25, and one “limits” clause on c4.
2. **Translation point for the record (4.21).** “content with their own action being just” renders ἀρκουμένου, the same verb as “is enough” in 5.27 (ἀρκεῖ) and 6.21 (ἀρκοῦσι). The English hides that 4.21 says “enough” of exactly the pair claim 3 names. I may not change the translation; I suggest a translators’ note on 4.21. The article now lets 4.21a back “this is enough” in claim 3 and says in `shared` and in decision 3 that this follows the Greek.
3. **A clause on a claim can only come from a qualified item on that claim.** The build rejected an “adds” clause on claim 4 from the wider item w3. w3 stays under Practice with no clause in the body; only the statement takes a clause from a wider item (w1).
4. **Title kept.** “Living now as one about to die” fits the central passages (12.1, 9.29, 7.31, 5.27, 2.8).
5. **Six claims, not three to five.** 18 passages, all 18 used. I merged where the passages allowed (fame into the view from above; the puppet image into claim 2) and stopped at six, because a further merge would have joined more than five passages in one claim.
6. **Other translation points in passages I quote** (nothing changed; listed only):
   - 2.8 “what is it to me to live in a universe empty of gods”: the note reads it as “what good is living”. The said-once item 2.8b renders it “is worth nothing to me”.
   - 12.1 “never beginning to live according to nature”: the Greek carries no time. Claim 6 keeps “never beginning”.
   - 7.3 “You can come back to life” ends a chapter whose first half the 1634 passage leaves out (principles die when the impressions behind them go out). The said-once item’s `why` now says that reading “life” as the life of those principles leans on that half.
   - 5.27 “You wait cheerfully”: with another accent a future or a question. Claim 4 takes it as a statement.
   - 12.18 “you will despise them”: loose grammar after “if you were lifted”. The article’s own sentences do not use “despise”.
   - 1.16 “Be pulled no longer” could be “stop grasping at them” (the books). I quote the later “pulled about on strings by unsocial impulse”.
   - 7.16 “the forgetting of you by all”: “all” may be things or people; claim 1 keeps it bare.
   - 7.16 “the constitution of a human being”: claim 6 says “the makeup of a human being” so that it is not taken for this page’s title; `changed` says so.
7. **Several 1634 passages join separate modern chapters** (9.29, 7.31, 7.16, 12.15, 4.21, 3.10, 8.4, 7.3, 6.21, 12.19). The `limit` says this, and that the “so” in the statement is the editor’s.

## Article 11 · Coming back to my principles and keeping them ready (accepted)

“When I fall short of philosophy I do not give up: I do what nature asks, keep my principles at hand and look at each thing stripped bare.”

1. **Title changed.** Provisional: “Falling short and beginning again”. Mine: “Coming back to my principles and keeping them ready”. The provisional title fits 5.9, 8.1 and (loosely) 10.9, but not the other two central passages: 12.6 is about how principles are used (the fighter’s hand) and 3.11 is a precept for examining each thing. “Principles” (or “precepts”) is the one word all five central passages carry. The meaning moves from failure alone to failure plus the keeping-ready that answers it.
2. **Fused on a Greek word, not an English one (claim 2).** 8.1 and 11.6 both say “situation”; 10.32 says “subject”. The Greek is ὑπόθεσις in all three (the translators’ notes on 10.32 and 11.6 say so). I fused the three and say this in `shared` and in a decision. If you want the strict rule (shared English words only), 10.32 becomes a said-once item and claim 2 rests on 8.1 and 11.6 alone. The “but” that sets 8.1 against 11.6 is the editor’s joining and is marked so in `changed`.
3. **“It does not need to be seen” (claim 1) is the editor’s summary**, mapped to 7.38 (“recognised by no one”) and 9.28 (“do not look around to see whether anyone will know”). Marked in `changed` and in a decision, as Article 6 does for “I take the universe’s side”.
4. **The doubt label is filled by one said-once item (5.9, second paragraph).** It says every assent can shift and then turns to the objects. That this is “what still holds if I doubt” is my reading; what Marcus actually rests in (5.10b) is outside this 1634 passage. If you think this stretches the label, move 5.9f to “why” or drop it and let `empty.doubt` say so.
5. **9.28 is about public affairs** (“be content if the smallest thing goes forward” is said of reforming other people). I use it for being content with a part in general, and say so in `changed` and in a decision.
6. **Translation points on passages I quote** (not changed, listed only):
   - 5.9 “time after time” (καταπυκνοῦται): the other reading is “if you do not fully succeed”. Claim 5’s “When I fail to act from my principles” holds under both.
   - 5.9 “most of what you do is more in keeping with a human being”: the Greek has no verb and no noun (“if the greater part more human”); “of what you do” is supplied. My component “most of what I do befits a human being” depends on that supply and drops the comparative; this is now recorded in claim 5’s `changed`.
   - 5.9 “except that to the Stoics themselves, at least, they seem hard to grasp”: the other reading is “and even to the Stoics”. I wrote “The Stoics themselves find things hard to grasp”, which holds under both.
   - 8.1 “your situation fights against it too”: the note says the role of emperor is presumably meant; the Greek does not say it, and neither does the article.
   - 8.1 “let go of what reputation you will have”: literally “let go the ‘what will you seem’”.
   - 10.9 last clause (“all those that you picture without study of nature and let go by”): text doubted; quoted in the said-once item 10.9b, and the `why` says so.
   - 11.4 “points of theory” (θεωρήματα) is read as “principles” (δόγματα) in claim 3; said in `changed`.
   - 12.6 “puts down the sword he uses and picks it up”: the second verb can also be “is killed”. Claim 3 uses only “never puts down”.
   - 9.28 “the smallest thing goes forward” can also be “things go forward by the smallest step”. Either way the claim’s component stands.
7. **A build rule met on the way.** A clause appended to a claim may come only from a qualified item on that claim. I had written “Seneca adds” clauses on claims 3 and 4 (from the wider items w3 and w4); the build refused them. The items remain under Practice; only the statement carries an “adds” clause.
8. **Seneca on claim 2 is a limit, not a challenge.** Seneca says to put engrossing affairs out of the way (Ep. 53.9, 72.3). Marcus says no situation suits philosophy better than the one he is in (11.6), but no passage says that situation is his affairs; reading it so is the editor’s step, and without it the two do not disagree outright. So q2 and its clause on claim 2 are `limits`. Seneca’s own inconsistency (Ep. 72.3, second half; Ep. 62.1) is stated in the item and both are quoted with context. Ep. 17.5 is no longer cited; it is in the rejected log.
9. **Rejected entries seen only as search snippets**, not read in full: Ep. 84.11, 29.12, 71.6, 117.25, 48.7, 68.3, 95.37, 31.8, 88.45, 98.17. Their reasons are from the snippet. Every quoted piece was read with its neighbours.

## Article 12 · The retreat within (accepted)

“At any hour I can retreat into myself, and I keep to my own mind rather than to what others say and do.”

- **The section only partly holds together.** 2.4, 10.13 and 4.15 are about having an aim and going straight at it, not about retreat. I did not force them into the retreat. They form their own fused claim (c6, "Acting with an aim"), and `limit` and `decisions` both say that reading them as "where the retreat sends me back to" is the editor's choice. 4.3 feeds three claims, so a lot rests on one long passage.
- **Overlap with articles being written now.** c3 (the disturbance comes from my judgment) repeats Article 7 (c3.s1) and Article 8 (c3.s2, "nothing from outside touches my mind"). c5 (living the present) comes near Article 10 (c3.s4). `limit` says this. The statement is kept to what only this section adds: the retreat at any hour and in any place, and keeping to my own mind rather than to what others say and do.
- **Title kept:** "The retreat within". It fits 4.3, 10.24, 7.20 ("Draw in upon yourself") and 12.2 directly. It fits 3.4, 2.11 and 4.15 as turning away from other people's minds to my own.
- **Translation doubts in passages I quote** (I have not changed the translation):
  - 4.3f: "wash away all distress". The manuscripts disagree, and some editors read "wash the soul wholly clean" (the translators' note says this is from memory and unchecked).
  - 10.24a: "the country place over there is just like this". The Greek does not construe cleanly, "this" is supplied, and editors doubt the text (from memory, unchecked). Claim 1's "where I am is just like them" rests on this reading.
  - 10.24b: "turns as the flesh turns". Another reading is "nourished with it".
  - 12.2b: "So if you separate". The relative pronoun has no construction, and some editors print "therefore".
  - 11.10a: the first two Greek words ("If, on the one hand") are left untranslated. Another reading makes the whole sentence an "if" clause.
  - 4.15b: it follows a place the edition marks as corrupt (†). "A dark character" could also mean bad character in general.
  - 10.13a: "guessing" (ὑπόνοια) could also be "suspicion".
  - 7.20c: "as already there". In claim 5 I use "as if they were already mine", which is the translators' other reading. `changed` says so.
  - For the translation's record (raised in review 1): the translators render κρῖμα in two ways. In 4.3 it is "conclusion", to keep "judgment" for ὑπόληψις. In 11.10 it is "judgment". So claim 3's "that judgment" joins 4.3's ὑπόληψις ("the judgment within") and 11.10's κρῖμα as one thing. The two words are close enough for the claim, which stands, but the section's English is not consistent here.

## Article 13 · Whether anything is better than virtue (accepted)

“Nothing is better than the spirit within me and its virtue, and no one can prevent me from living by it.”

- **Title kept**: “Whether anything is better than virtue”. It fits the central passages (3.7, 3.13, 11.15, 3.8, 12.22). Each one says that a good life lies in the spirit within and in just and truthful action, and that nothing outside matters as much.
- **Six claims, not three to five.** The section holds six separate parallels, each with words that two passages share. I did not merge any of them, because merging two different points would be concatenation (rule 1). If six is too many, claim 4 (3.7 with 10.2, rational before animal) is the one to make into said-once items.
- **3.7 carries a lot.** It feeds claims 1, 4 and 6 and the item under doubt (11 pieces). It is the central passage, but the article leans on it.
- **3.7 is put as a test** (“if nothing appears better… give room to nothing else”). Claim 1 and the statement give the answer Marcus expects. The open side of the test is kept as the said-once item under doubt (3.7b). This is decision 2.
- **Translation doubts in quoted passages** (I have not changed them):
  - 3.13 “waiting for nothing” is matched with 3.8 “neither pursuing”. Both back “I live pursuing nothing and fleeing nothing”. The two Greek verbs are not the same; “changed” in claim 1 says so.
  - 3.7 “simply and freely choose the better”, and the objection “the better is what benefits”: the translators’ note says the Greek names no one who is benefited. Claim 4 takes the benefit to be mine, as the English does.
  - 2.6 says “the nature of which you are a part” and 6.53 says “your own nature”. Claim 2 says “according to nature” and does not choose between them.
  - 11.15 “even if one somehow escapes notice”: the Greek gives no subject. The English, and the said-once item 11.15b, take it to be a verdict written without my noticing.

## Article 14 · Living with the gods (accepted)

“I live with the gods and meet their power always, revere both them and reason, and keep before me the dawn sky and a good person of old.”

1. **The section holds two topics, and the article says so.** Three passages are about the gods, the soul and reason (12.21, 5.21, 4.13). Two are rules for reminding oneself, taken from other schools (11.25, 11.24). No passage joins the two groups. I did not force one fusion across them: each fused claim stays inside its group, the statement sets the three claims side by side with “and”, and `limit` states this as the article’s weakest point. If you would rather have the two reminder passages moved to another section, the article would shrink to claims 1 and 2.

2. **Title kept.** “Living with the gods” is Marcus’s own phrase (5.21) and fits 12.21 and 5.21, the two central passages, fully, and 4.13 in part (“seem a god”, “reverence for reason”). It fits 11.25 and 11.24 least; they are the two passages farthest from the section’s centre (0.723 and 0.711).

3. **An unfinished draft was in the folder.** I kept its three groups of passages and most of its said-once items, and changed these things:
   - Its claim about honouring reason mapped 12.21’s “honour” (of the soul) and 4.13’s “reverence” (for reason) to one verb. I rebuilt the claim on the root that 12.21 and 4.13 really share, “revere” / “reverence” (σέβεις / σεβασμόν; the translators’ notes say the two were rendered to match).
   - Its claim on living with the gods wrote “my reason” where the quoted words say “the spirit”. The claim now says “the spirit Zeus gave me as protector and leader”, with a longer quote of 5.21 behind it, and “this spirit is each person’s mind and reason” stands as a said-once item.
   - Its statement said “the stars”; the quoted part of 11.25 says “the sky at dawn” and “those that always complete their own work”. The statement now says “the dawn sky”.

4. **Doubts about the translation of quoted passages** (not changed, only listed):
   - **11.24 “Epicureans”.** The translators’ note says, from memory and unchecked, that the manuscripts read “Ephesians” and that “Epicureans” is an editor’s correction made because Seneca reports a similar precept from Epicurus. Claim 3’s component “by rules taken from schools of philosophy” and the Seneca pieces on this rule (Ep. 11.8, Ep. 25.6) lean on that reading. If “Ephesians” is right, the component loses its second passage and the tie to Seneca is only a likeness. Recorded in `decisions`.
   - **12.21 “that you revere them as you do”.** These are the questioners’ words. I use them for “I revere the gods” because Marcus’s reply accepts the description; his own verbs are “honour” (the soul) and “stand in awe” (the gods). Recorded in `decisions` and in the claim’s `changed`.
   - **4.13 “reverence for reason”.** The Greek does not say whose reason. Claim 2 and the statement leave it open (see the answers to the review below).
   - **5.21 “their own soul”.** The note explains that “their” is the person’s, not the gods’. The claim reads it so (“my own soul”).
   - **12.21 “on every occasion”.** The note gives “each time” or “constantly” for ἑκάστοτε. The shared component “all the time” in claim 1 depends on that range of meaning.

5. **Two rules of the build I met.**
   - A body clause that comes from an “Adds” item may only be attached to the statement, not to a claim. So Seneca’s two additions on being seen (God as witness, the good person as watcher) are joined in one clause on the statement, and the addition on worship has no clause of its own.
   - An inference may not lie inside words that a passage backs. This decided how the review’s point on “I live with the gods all the time” was met (below).

6. **Article 4’s Seneca pieces from Ep. 95.50 (checked in the private record).** Article 4’s S95.50a is “Would you win over the gods? Then be a good man. Whoever imitates them, is worshipping them sufficiently.” and its S95.50b is “acting as guardians of the human race …”. My piece is a different sentence, the first of that section (“The first way to worship the gods is to believe in the gods …”), with its own id S95.50c. So nothing is quoted twice. The two additions are neighbours: Article 4 adds that imitating the gods is worship enough; this article adds the sentence before it, that worship begins with believing in the gods and acknowledging their majesty and goodness. The search log for Ep. 95.50 now says this.

## Article 15 · Blaming no one for what is not up to me (accepted)

“I do not let what is not up to me make a difference to me, and I blame no one for it, neither the gods nor people.”

- **Title changed.** The provisional title was “What is not in my power”. Read in full, the section is about blame: 6.36, 8.15, 12.9 and 7.25 say that no one (gods, people, things) is to be blamed or raged at, 12.4 and 9.35 turn from arguing with the gods, and 7.41 from giving up on bad people. What is up to me (6.36, 9.40, 8.15, 7.41) is the ground they give. New title: “Blaming no one for what is not up to me”. The meaning overlaps; the emphasis moves from the distinction to what it is used for.
- **12.4 used twice, in two senses.** Its answer (the gods would not let anything be neglected unjustly) is in claim c3; its “prying … arguing a case of justice with god” is in claim c5 as a failure. In 12.4 that sentence is also a step proving the gods just. The Greek word (παραζητῶν) marks the search as beside the point, which supports reading it as a failure; recorded in `decisions` and in c5 `changed`.
- **Translation doubts (not changed, listed):**
  - 7.41 “do you give up”: ἀπαυδᾷς has no object. The article reads it as giving up on bad people (the context of the gods bearing with them); it could also be giving up in general, from weariness.
  - 8.15: the Greek never says what “it” is; claim c4 takes it to be a wrong (as 7.41’s “vice”). “No one” (Οὐδενί) is equally “nothing”, which lets 8.15’s atoms meet 7.25’s “things” in claim c2.
  - 6.36 “the difference these things make to us”: the note gives “because of our quarrels over these things” as another reading. Claim c1’s shared words (“make a difference”, 6.36 and 9.40) rest on the translators’ choice, which the note itself ties to 9.40’s idiom.
  - 7.25: lines are verses quoted without names; the translators mark the sources as from memory, unchecked. Only lines 1, 4 and the closing instruction are used.

## Article 16 · Happiness and unhappiness are my own doing (accepted)

“My happiness is decided in my own soul, and I need nothing besides; not wanting what happens, I desert nature and the law that send it.”

1. **Title changed in meaning.** Provisional: “The good spirit within”. Used: “Happiness and unhappiness are my own doing”. Reason: “the good spirit” is said by 7.14 only; 10.25 (the runaway slave) and most of 4.24 (exile, beggar, abscess) are not about a spirit within. What all five passages do say is that the state in question is the person’s own act: the exile “exiles themselves”, the unhappy do not keep track of “their own soul”, Marcus endured “because you were not content”, and whoever is afraid “is a runaway slave”.
2. **The section has two strands that no passage joins** (hard case “does not hold together as one topic”, partly). 2.5, 7.14 and 9.24 are about my own soul and its sufficiency; 10.25 is about fleeing the law of the whole; 4.24 touches both. I did not force one fusion: the statement has two halves joined by a semicolon, `form` and `limit` say that joining them is the editor’s, and no “so” or “because” links them.
3. **Overlap with Articles 1, 2, 3, 12 and 18** (hard case “would repeat another article”). The statement is about what this section adds: where happiness is decided, needing nothing besides, and deserting nature and the law that send what happens. `limit` names the overlaps; claim 2 is nearly the same as Article 18’s first claim.
4. **Translation points in passages I quote** (not changed, only listed):
   - 4.24 “An exile is whoever exiles themselves”: the Greek verb (φεύγων) is the one translated “flees” in 10.25. The alternative on record is “A fugitive is whoever flees from the reason that belongs to citizens”. No claim depends on it: the exile is a said-once item, and claim 3 rests on 4.24’s displeased person and 10.25’s runaway slave.
   - 7.14 “for I do not need you”: χρῄζω can also be “want” (translators’ note: “for I do not want you”). 4.24 has a different word, ἐνδεής (“in need of”), so the English “need” that the two share stands for two Greek words; claim 2’s `shared` says so. On the reading “I do not want you”, “I need nothing besides”, in claim 2 and in the statement, would rest on 4.24 alone. Claim 2’s `changed` says this.
   - 4.24 “in need of another”: ἑτέρου can be “another person” or “something else” (translators’ note). The claim’s “nothing besides” takes the wider sense.
   - 7.14 “a good spirit, or a good ruling part”: “or” may mean “that is”. The claim keeps only “a good ruling part”.
   - 9.24 “But enough”: the Greek does not say enough of what. The said-once item reads it as enough of going over what was endured, and its `why` says that it could be enough of the enduring.
5. **A rule of the build I met:** a clause on a claim may come only from an item about that claim. A clause on claim 3 from Seneca’s “way back” (a wider item) was refused and dropped; the way back stands as its own item under “When it breaks”.

## Article 17 · Ready to leave (accepted)

“Any moment now I may die; I live without pretence, here as anywhere, and I am ready to go.”

- Title kept: “Ready to leave” fits every central passage (9.2, 10.12, 4.30, 3.9, 10.23): each speaks of leaving life and of the state one should leave it in.
- Hard case (statement near another article's): in the polish round the cross-article reading found that the old statement and claim 3 restated Article 10. Claim 3 was dropped and the statement now says what this section adds; Article 10 and the other near articles are named in `limit` (see d).
- Translation points the article depends on (it does not change the translation):
  - 5.23 “once you have gone out”: the Greek does not say out of what. The note takes it as leaving this place, because “go out of life as well” follows. Claim 4 depends on that reading.
  - 10.17 “that way” in “better than to live that way” is open: living as those people live, or living on as they would allow. The claim's “another way” keeps it open.
  - 10.17 “What is left now is little”: the Greek does not say “of life”. Claim 1 takes it to be time.
  - 5.23 “There is smoke, and I leave”: the note gives the smoky-room image from memory, unchecked. The article no longer uses “room”.
  - 5.23 “Why do you think it anything much?” (τί αὐτὸ πρᾶγμα δοκεῖς;): the note gives a second reading, a question about what the thing itself is. Claim 2’s “dying is nothing much” depends on the first reading.
  - 3.9 ἀσυντελής is taken as “unfinished”; the note says it can also mean “contributing nothing”. Claim 2 depends on “unfinished”.

## Article 18 · Content wherever I am put (accepted)

“Wherever I am put, and equally whatever is given me or taken back, a good state of soul and good actions are enough for me.”

1. **Built on an unfinished draft.** An earlier run left an article.json without Seneca and without an audit. I kept its three claims and three said-once items, re-read every passage against them, and changed one thing in Part 1: the draft said “a good mind and good actions” and mapped 9.5’s “present judgment” to “a good mind”. I now say “a good state of soul and good actions”, which is nearer to 8.43 (“the state it is in and the way it acts”) and 5.30 (“good turnings of the soul … good actions”), and 9.5 backs only “These are enough for me”. Everything in Part 2 and this audit is new.
2. **Title kept**: “Content wherever I am put”. It fits the central passages (8.43 “wherever you want … content”, 9.5 “It is enough”, 5.30 “wherever caught”, 12.8 and 10.16 on accepting what is assigned or taken back).
3. **Hard case: the statement would repeat other articles.** Claim 2 (act for others, accept what happens) repeats Article 3’s statement and Articles 1 and 2 on the common good. The statement is therefore written about what this section adds: the place (“wherever”) and the measure (“enough”). `limit` says so and names the three articles, and also Article 2’s “doing it makes me content”.
4. **The statement’s joining is the editor’s.** No passage sets the place I am put in beside what is given and taken back. The statement does, with the word “equally”, which is recorded in `statement.inferences`. (The word was added after the review so that the build has one word to mark; a second “and” could not be marked.) In the part “whatever is given me or taken back”, the words “taken back” are 10.16’s alone; 12.8 backs only “whatever is given me”. `limit` says so.
5. **Only 5.30 says “good”.** In “a good state of soul and good actions”, the word “good” is 5.30’s. 8.43 says the state and the acting “follow from its own make-up”; the claim reads that as the same standard. This is recorded in `changed` and in a decision. If the owner finds it a stretch, the cautious wording is “the state of my soul and the way I act”.
6. **Doubts about the translation of passages I quote** (not changed, only listed):
   - **5.30** is cut mid-sentence by the 1634 division. The words before it, “Once I was”, stand in the previous passage, so the full Greek sentence is in the past tense (“Once I was, wherever caught, a person whose lot is good”). The article quotes the fragment and says only that my lot “can be” good; a reader of the whole chapter might take the sentence as a look back, with the definition that follows as the correction.
   - **12.8**: the translators’ note says ὃν νέμῃ is read as ὃ ἂν νέμῃ “from memory, unchecked”. No printed edition could be consulted in this run (no network, none in the tools); the English of 1634 (“whatsoever God doth send”) reads it the same way, which is support but not a check. Now recorded as a decision in the article. “Whatever it is” in claim 2 rests partly on that reading; 9.5’s “everything” backs the same component independently. The owner may wish to check ὃ ἂν against a printed edition.
   - **8.43**: “content if …” takes the εἰ-clause as what the divinity is content with. The other reading (“content, provided that …”) makes it a condition on the whole promise. Claim 1’s “These are enough for me” leans on the first reading; 9.5’s “It is enough” backs it independently. This is now a decision in the article, and the note on Seneca’s Ep. 41.2 uses the same reading.
   - **8.43**: ἔχοι is read as “the state it is in”; the alternative “holds its ground” would weaken the pairing with 5.30’s “turnings of the soul”.
   - **8.43** does not say who “you” is. The article does not identify it with nature.
7. **“If I doubt it” stays empty, with Seneca too.** I first placed the Phidias passage (Ep. 85.40) there. The review is right that it affirms the statement and grants only a preference; it is now under “In action” (“Working with what I find”).
8. **A build rule met on the way.** A body clause on a claim may come only from an item about that claim; a clause drawn from a wider item is accepted only on the statement. A clause I had put on claim 3 from the rehearsal of exile was therefore removed.

## Article 19 · When someone offends me (accepted)

“Whoever wrongs me does it against their will and cannot harm me, and I teach them or bear with them.”

- **Eight fused claims**, above the usual three to five. The section has twenty passages, and each claim rests on words that two passages share (listed below). The pairs that would merge most easily, being wronged (claims 1, 2) and being despised or hated (claim 5), are kept apart because the passages treat them apart.
- **Title kept**: “When someone offends me”. Every central passage (9.43, 7.34, 11.16, 7.19, 10.30, 1.15) begins from someone doing wrong or giving offence.
- **Statement simplified** from a draft that began “I remember they do it…”: only 7.34 says “remember”, so the word could not rest on two passages.
- **Translation doubts in quoted passages** (I did not change the translation):
  - 12.12b: the Greek does not say what “this” is (taken as the wrongdoing), and ὄψις may be the eyes rather than the face.
  - 9.25d: “the things those people care about” takes a later sense of διαφέρομαι, marked by the translators as from memory, unchecked. Claim 3 rests partly on it.
  - 7.18a: only the first sentence is quoted. The next sentence is reconstructed from Greek that does not construe. Claim 7 reads ἐπίκοτον (a wrathful, grudging look) as my own angry face.
  - 7.34b: “he says” is unnamed in the Greek; the saying is Plato’s, quoted as by Epictetus (from memory, unchecked).
  - 11.12a: “That is for them to see to” renders an idiom, literally “that person will see”.
  - 9.43c: “there” points back to the mind; the English places it first so that it is heard that way.
- **Build note**: the palette colouring depends on Python’s set order (`PYTHONHASHSEED`). My first draft passed on some runs and failed on others (“needs more than five passage colours”). I cut the statement’s witnesses from nine to seven passages; the final article passed 40 of 40 seeds in a copy of the build’s colouring loop, and `check.py` passes.

## Article 20 · Taking a thing apart: material, cause, purpose and time (accepted)

“I look at what each thing itself is, I take it apart into its material, its cause and its purpose, and I ask how long it lasts.”

- **Title changed in wording, not in meaning.** Provisional: “Taking a thing apart: matter, form and end”. Used: “Taking a thing apart: material, cause, purpose and time”. “Form” and “end” are not the project English's words: the translation says “cause” (the Stoic active, shaping element) and “purpose”. Time is the fourth head in two of the three dividing passages (12.14, 8.10), so it goes in the title.
- **Translation doubts in passages quoted (not changed, listed only):**
  - 6.3 “Look inside”: the Greek (Ἔσω βλέπε) does not say whether this means inside the thing or inside myself. The translation leans to the thing, and claim 2 reads it so. If it means inside myself, 6.3's first sentence leaves claim 2.
  - 12.14 and 12.7 “purpose” (ἀναφορά, literally “reference”): the translation narrows a wider word. Claim 1 keeps 8.10's “What does it do in the universe?” as its own item and does not merge it with “purpose”.
  - 12.14 “see in full” (εἰς τὸ πᾶν): could be “look to the whole”. Claim 2's “see in full” depends on this reading (“always”, ἀεί, does not). Now also recorded in `decisions` and in c2 `changed`.
- **Gloss in claim 1.** “The active part that shapes the material into this thing” is the editor's explanation of “cause”, from the translators' note. Now worded “the active element” (the translators' word). Marcus's quotes are not mapped to it; Seneca's Ep. 65.2 (“Cause … moulds matter”) backs it when his voice is on, as the second decision now says.
- No hard case: the section holds together as one topic.

## Article 21 · Wiping out impressions, checking impulses (accepted)

“It is up to me to keep wiping out impressions and to make every impulse with a reservation, on condition that nothing prevents it.”

- **Title changed.** Provisional: “Clearing away opinion and impulse”. Used: “Wiping out impressions, checking impulses”. No passage of the section speaks of opinion; seven speak of impressions or impulses (7.21, 8.27, 9.6, 4.18, 8.49, 6.45, 11.31). The meaning is close, but “opinion” (a judgment) and “impression” (what appears to the mind before judgment) are different Stoic terms, so I report both.
- **Six claims, not three to five.** The section holds together (all twelve passages are about governing what enters and moves the mind), but it is a set of exercises more than one argument, and it gives six real parallels. I kept all six rather than force a merger; `limit` says so.
- **Overlaps.** Claim 6 (when I am kept from something) is near Article 2’s c5, claim 5’s “sure grasp” near Article 2’s c3, 11.17’s divine part beaten by the body is the failing side of Article 2’s c2, and claim 4’s “for the common good” is near Article 1’s c3. All said in `limit`.
- **“With a reservation” explained.** The statement and claim 4 now say “on condition that nothing prevents it”. That gloss is the editor’s (the Stoic sense in the translators’ note); it is recorded in `decisions` and in c4’s `changed`. For the same reason Seneca’s Ep. 85.38 and 14.16, already used in Article 2, are not reused.
- **Translation doubts on quoted passages** (I did not change anything):
  - 11.17 “rough or smooth movements” (quoted in the said-once item “Beaten by the body”): the translators’ note says the wording of the Greek there has been doubted and some editions print something else (“gross pleasures”); they mark this as from memory, unchecked.
  - 8.50 “If you guard yourself at every hour so as to be free” (quoted in claim 2): the note says the verb has been doubted and “grow” proposed (from memory, unchecked). With “grow”, the second half of claim 2 (“guard myself at every hour”) would lose its backing from 8.50.
  - 11.31 “There is no robber of the power to choose”: the note marks the attribution to Epictetus’s Discourses as from memory, unchecked.
  - 6.45: the hardest clause (“the things we were led forward for, these come about”) is not quoted.

## Article 22 · Good whatever others say, and open to being set right (accepted)

“Whatever others say of me, I act well, and I change my mind only when I am shown what is true, just or of common benefit.”

- **Title changed.** The provisional title was “Being good for its own sake”; it is now “Good whatever others say, and open to being set right”. No passage of Marcus in this section speaks of a motive or of anything’s own sake. The central passages (7.12, 5.3, 7.24) are about staying good whatever others say, and three others (4.10, 8.14, 6.20) are about changing my mind when someone sets me right. The idea of “for its own sake” now comes only from Seneca (w1: the wages of a good deed is to have done it), and is marked as his.
- **The statement joins two halves the passages do not join.** The article reads them as one rule (only reasons move me, talk does not). No passage says this, and `limit` says so. There is no “so” or “because” in the statement, so no inference is recorded.
- **Statement widened after review 1**: it now ends “what is true, just or of common benefit”, keeping 4.10’s second ground.
- **Translation doubts in quoted passages** (not changed; listed):
  - 8.28 “not over-distinctly”: the notes say the rare Greek word is uncertain and may mean “not in a piercing voice”. The said-once item keeps the project’s English.
  - 12.13: the Greek given breaks off at “For let your impulse be …”; the item quotes only the complete sentence before it.
  - 7.24: the first sentence is a saying the edition marks as a quotation; the notes credit it to Antisthenes “from memory, unchecked”. The article takes it as a rule Marcus adopts.
  - 3.6 “set upright”: the notes say the form also allows “held upright, propped”. The claim’s “not set upright by anything else” holds under either reading.
  - 4.10 “mistaken notion”: the notes say “mistaken” renders the bad sense of the Greek noun and is not a separate word. Quoted as it stands.
  - 6.48 “soul”: the translation keeps “soul” and does not turn it into “mind”; the claim keeps “soul” too.

## Article 23 · Keeping to one’s craft (accepted)

“I keep to my own reason as a doctor keeps to the craft, and attend only to what I am doing now, even when those I work for speak ill of me.”

1. **Translation, 6.50: the whole fused claim depends on how one sentence is read. Please have it checked before the article goes in.** The claim c1 and two of the three statement parts rest on “would I be attending to anything other than how I myself might bring about …”. Two things have to hold. (i) **The reading of ἂν προσεῖχον.** The form is either first person singular, “would I attend”, or third person plural, “would they attend”. The translators took it as first person to agree with ἐνεργοίην, but the subject of ἔλεγον (the sailors, the sick) can run on, and the emphatic αὐτός (“I myself” / “he himself”) suggests that the subject changes, so the third person is at least as natural. The printed Greek allows the first-person reading but does not require it. On the third-person reading, “speak ill of me” still stands, but “I attend only” does not, and that is the claim’s one shared component. (ii) **The edition.** The Greek the project quotes is Leopold’s edition of 1908 (Perseus copy), and it prints the first-person ἐνεργοίην. I could not check here (no network, no printed edition) whether that is Leopold’s reading or a slip of the digitised copy, or how other editions read. From my own memory, unchecked, as the reviewer also recalls: the usual English translations (Long, Haines, Farquharson, Hays) read the whole sentence in the third person: “if the sailors abused the helmsman, or the sick the doctor, would they listen to anyone else? Or how could he himself bring about the safety of those on board …”. On either third-person reading, nothing in this section is fused, and the cautious form of this article would be three said-once items (6.32 twice, 9.42). Decision 3 and `limit` say this. I may not change the translation or its notes; the result of the check belongs in the notes on ἂν προσεῖχον and αὐτὸς ἐνεργοίην.
2. **One fused claim, and a thin one.** It joins 9.42 and 6.50 on one point: attention to the act alone. 6.32 shares only the figure of the doctor with 6.50 and is kept as two said-once items. The plan allowed one claim at most, and `limit` says that three passages cannot carry more.
3. **Translation, 6.32 (for the translation record).** “Will not agree to abandon it” for ἀποστῆναι οὐχ ὑπομένουσιν suggests a request that is refused. The Greek is nearer “do not bring themselves to leave it”, with nobody asking; the translators’ note gives that as another reading. The said-once item says “will not give it up”, so the article does not lean on “agree”.
4. **Translation, 9.42 (the cut).** The passage is the end of modern 9.41: the last words of one sentence and the sentence after it. Its first words, “… is common to every school”, are not quoted, because their subject is before the cut. That subject (not leaving philosophy whatever happens; not joining in the chatter of the untrained) uses the same Greek verb as 6.32’s “abandon” and the same word for “layman”. If the cut were moved back one sentence, 9.42 and 6.32 would share a component and 6.32 could enter a fused claim. I may not change the cut; I list it.
5. **Title kept** as given: “Keeping to one’s craft”. It fits all three passages. No passage calls reason a craft; the title names the picture.
6. **An editor’s step in the statement.** No passage says “I keep to my own reason” in so many words. 6.32 asks whether it is not shocking that a builder or a doctor should respect the reason of the craft more than a person respects their own reason; the statement gives the answer the question expects. This is decision 2. There is no “so” or “because” to enter under `inferences`, which is empty.
7. **Statement parts on one passage: an exception to rule 8, for the owner to approve.** Two of the three parts rest on one passage each (the likeness on 6.32, the abuse on 6.50). Rule 8 says each statement part rests on at least two passages, with no allowance for small sections. (The writers’ brief has the sentence “in a section of five or more passages every part rests on two or more different passages”, which I had read as an allowance; it is not one the rules grant.) Decision 4 now calls it an exception for the owner. With three passages, of which only two say the same thing, no more is available.

## Article 24 · Training, and the use of reason (accepted)

“I treat living as a skill: I learn it by training, I bring reason to it and wait for nothing else, and I use it to face what happens.”

No hard case applied. The section holds together, the title is kept as given, and the statement does not repeat another article's.

Things to look at:

1. **Two quotes overlap another quote of the same passage.** The build accepts this; say if you would rather not have it.
   - 7.28c (the said-once item, “but not more social … those nearby”) contains 7.28b (“nor better disciplined in the face of what happens”), which is fused in claim 3. The sentence's list could not be cut into one unbroken span without it.
   - 7.33c (“The art of living”, three words, in claim 1) sits inside 7.33a (claim 3). It is there so that “I treat living as a skill” has 7.33 as a second witness beside 11.27.
2. **“I treat living as a skill” is the editor's wording.** 11.27 carries the rule of writing and reading over to life; 7.33 says “the art of living”. Neither says outright that living is learned as a skill is. This is in the article's decisions and its limit.
3. **“Does not wait for anything else” (claim 2, and “wait for nothing else” in the statement) is the editor's summary.** 4.11 says there is nothing else to want once reason is at work; 4.25 says four lacks do not stop a person holding to reason. Neither says that nothing else is needed. Recorded in the claim's `changed`.
4. **Claim 3 contains two marked editor's inferences**: setting throwing (7.28) against standing (7.33), and taking 7.28's discipline and 7.33's standing ready as one thing.
5. **4.25 is quoted whole as one piece** (four short sentences), so that the list of things lacked is one component and not four.
6. **The second half of 11.27 is left out** (“You are by nature a slave; you have no share in reason”, modern 11.30). It is a verse line quoted without comment.
7. **Seneca's “Thinking ahead” item (Ep. 107.4) repeats an exercise Article 3 already has** from Ep. 91.4, 76.34 and 78.29 (I read those three sections to confirm). It is kept because it stands beside Marcus's “not foreseen” here; the article's `limit` says so. Drop it if one place is enough.

Doubts about the translation of passages I quote (not changed, only listed):

- **4.25, last sentence.** The notes say the place of the negative has been doubted (“I have the nourishment of learning and I do not hold to it”), that “nourishment that comes from learning” may be “a living from my studies”, that “to reason” is supplied, and that the speaker may not be Marcus. Claim 2 follows the English as it stands.
- **11.27, “rule … been ruled”.** May be “lead … been led”. Claim 1 reads it as master and pupil, as the note does, and writes it out as giving the rules and being given them.
- **12.5, “Practise”.** May be “Accustom yourself to”. Both the fused claim and the said-once item depend on “practice”.
- **8.21, “these things”.** Part of a chapter; the Greek does not say what they are. The halves are joined by a semicolon; my “if” is marked as the editor's reading.
- **7.28.** No subject and no verb; “an opponent” is supplied.
- **4.11.** “When it is doing its own work” could be “if” or “since”.

## Article 25 · What I turn to (accepted)

“I keep going back to myself and to philosophy, rest in philosophy and in acting as a member of a community, and toil without complaint.”

1. **Title changed.** Provisional: “Returning to myself”. Used: “What I turn to”. Reason: the provisional title fits 6.9 only. 6.43, the passage closest to the centre, turns to the strong points of other people; 9.20 runs to three ruling parts, two of them not mine; 9.10 and 6.6 name the one thing to want and rest in; 6.10 goes back to philosophy. The meaning is wider than the provisional one, so both are reported here.
2. **One section, two subjects.** Seven passages hold together (going back, rest, the one thing wanted, toil and the court without complaint). 11.2 (dividing things into parts to look down on them) is about something else and is the farthest from the centre (0.7135). It is joined to 6.43 on one point only, the exception each makes for virtue. That claim (c4) is the weakest and is kept out of the statement; `limit` says so. If the owner prefers, c4 can become two said-once items without touching the statement.
3. **A “challenges” tag the owner may want to look at.** Seneca’s item q2 (Ep. 72.3, 53.9, with Ep. 62.1 as his other side) and its clause on c1 are tagged `challenges`. After review the difference is stated only as what the quotes show: Marcus waits on the court and finds it bearable because of philosophy; Seneca would resist the affairs that take up his time and put them out of the way. The clause now cites Ep. 72.3 alone. Seneca contradicts himself on this (Ep. 62.1), and the item says so. Cautious alternative: drop the clause and keep the item.
4. **A clause could not be placed where it belongs.** The build accepts a clause from an Adds item only on the statement, not on a claim. Seneca’s reason against complaining (w1) and “I must be just without reward or renown” (w4) are therefore one clause on the statement, citing both items, and not clauses on c5 and c2.
5. **Translation points in quoted passages** (not changed; listed):
   - 9.20 “a just mind”: the translators’ note says the Greek adjective is rare, that some editors have doubted it, and that this is “from memory, unchecked”. Quoted in the said-once item; now also stated in `decisions`.
   - 9.20 “that it is akin”: the Greek does not say akin to what (my own ruling part, that of the whole, or both). The item keeps the bare “akin”; `decisions` and the item’s `why` say the Greek leaves it open.
   - 9.20 “this person’s”: the Greek says only “this one’s”. The item says “the other person’s”.
   - 9.20 “Run to”: the same Greek verb as “run to the parts” in 11.2, where the note offers “go straight to”. c3 reads “quickly” into it and says so in `changed`.
   - 6.10 “here” and “rest in philosophy”: “here” is read as philosophy because the next clause sets it against “the things there” (the note’s reason); that the court is the stepmother and philosophy the mother is by word order only. Both stated in `decisions`.
   - 6.9 “more than you are forced to”: the Greek does not say whether longer or further. The claims keep the open wording and say “my rhythm” for “the rhythm” (noted in `changed`).
   - 9.10 “to move and to hold back”: could be passive (“to be set moving and held in check”). The claim follows the translation.
   - 6.43 “they must be kept ready to hand”: “they” may be the strong points or the likenesses. The claim says “them” after “strong points”.
   - 8.8 “finding fault”: the note gives “complaining about” as the other reading; the claim’s “complain” leans on it.

## Article 26 · The morning, and the question before each action (accepted)

“I get up for the work I was made for, I question each thing I do, and when I have done good I look for nothing more.”

- **Title kept**: “The morning, and the question before each action” fits the central passages (10.15, 8.2, 8.11, 5.1, 10.37). The section also holds a thread the title leaves out, doing good without looking for anything more (7.43, 5.6). The statement covers it.
- **The section is three topics joined by the day, not one topic.** The statement says so by its shape (“Three moments of a day”), and `limit` says that the middle part, “I question each thing I do”, joins questions that differ in content (regret, death, another’s aim) by their form alone.
- **Overlap**: claims 1 and 2 come near Article 5 (“not made to please myself”) and Article 1 (each act aims at the common good). Named in `limit`; the statement is about what this section adds (when and how).
- **Translation doubt, 10.15** (said once, quoted): the English reads “is blamed” (ψέγηται). The translators note from memory that the manuscripts may read γένηται, “is done”, which would make the question whether it matters that *someone else* does what is right. Not changed; listed in `decisions`.
- **Translation note, 7.43b**: “do not tire of being benefited, in that you give benefit” is read in claim 4 as “I do not tire of doing good”, which drops the point that giving benefits the giver. Said in `changed`.
- **Build rule learned**: a Seneca clause on a claim can only come from a `qualified` item on that claim; a `wider` item can only amend the statement. Two drafted claim clauses (from w1 on c1, from w3 on c3) were removed for that reason; only the statement clause remains.

## Article 27 · Whose praise do I want? (accepted)

“Before I want anyone’s praise I look into their mind; praise makes me no better, and fame after death is nothing to me.”

- No hard case. The section holds together as one topic: the people whose praise or judgment one wants, and what praise and fame are worth.
- Title kept: “Whose praise do I want?”. It fits every central passage (9.32, 8.42, 6.54, 4.16, 6.17, 8.51, 9.16).
- Translation doubts in quoted passages (I did not change the translation):
  - 10.20 (quoted whole, in claim 1 and the said-once item): “lording it” renders a rare word of uncertain sense; the translators mark it as a guess. The article’s own sentence avoids it (“give themselves airs and scold from above”).
  - 9.16b “what sort of judges they are of themselves as well”: the Greek says “what sort”; the translators give “what poor judges they are even of themselves” as another reading. Claim 2 reads it as poor judges, and says so in `changed` and in `decisions`.
  - 4.31 “and at the wise as well”: its point is open (model or target), and the translators note the words have been doubted. The claim leaves the wise out.
  - 8.51 “runs from the praise … or chases it”: the translators note that “runs from” may be a corruption (blame as the thing fled). Not quoted; only the clause on the clappers (8.51b) and the two questions (8.51a) are.
  - 4.16: the sentence on “the gift of nature” does not construe; not quoted. 4.16e stops before it.
- 10.10 (the spider and the Sarmatians) is set aside as off the topic: it is about pride in a capture, not about praise.

## Article 28 · Wrongdoing harms the wrongdoer (accepted)

“A wrong harms the one who does it, not the one it is done to, so I leave another’s wrong with them.”

- No hard case was triggered. The title “Wrongdoing harms the wrongdoer” is kept: it fits the central passages 8.53, 9.4 and 9.37, and 9.18 is the response to it.
- The statement’s middle (“not the one it is done to”) rests on one passage of Marcus, 8.53; it shares a statement part with 8.53b, 9.4 and 9.37, which say only that the wrong harms its doer. Seneca challenges exactly this middle (Ep. 81.22, 109.4).
- Translation doubts on quoted passages (I did not change the translation):
  - 9.4 “does wrong at their own cost”: the dative could also be “against themselves” (translators’ note). Claim 1 leans on this clause; either reading puts the harm on the doer.
  - 9.4 “does injustice to themselves, making themselves bad”: the Greek doubles ἑαυτὸν; read as an accidental repeat, from memory unchecked.
  - 9.18 and 9.37 “there”: the article reads it as “with the one who did the wrong”, as the translators’ notes do. The Greek has only ἐκεῖ. Claim 2’s “I leave their wrong with them” and the statement’s last part depend on this reading.
  - 8.53 “an evil for me”: the note gives “something bad of mine” as another reading.
  - 2.7: from “And in general” the Greek may be Marcus’s own words or still Theophrastus’s; the said-once item treats the whole as Theophrastus approved by Marcus.

## Article 29 · Short sayings (accepted)

“I stand upright on my own, and my best way to fight back is not to become like those I fight.”

**Hard case: the section is not one topic.** No two of the five passages say the same thing, so
nothing is fused. My recommendation was that this section get **no article**. The lead kept it as
an article made only of said-once items, marked `unfused` with `claims: []`, so that article
numbers stay as planned. Whether c7.s3 keeps an article is your decision. The article's
`decisions` and `limit` say the same.

What the article is:
- Four said-once items: 9.15 (the stone), 6.49 (hive and bee), 7.9 (upright), 6.5 (fighting back).
- 8.40 is set aside. The quoted words are half a sentence: their subject (the mind) and main clause
  (nothing touches it) are in the left-out part of the passage.
- Statement: “I stand upright on my own, and my best way to fight back is not to become like those I
  fight.” It sets two separate rules side by side and joins them with a plain “and”. `kind` and
  `form` say so. Each part rests on one passage, which is allowed for this article only.
- The stone and the hive sit under Why as images beside the statement, not as its ground. This
  choice is open to dispute and is listed in `decisions`.

Passages that have a real parallel elsewhere (they would be second witnesses there):
- 6.49 is the reverse case of Article 3, claim 2, “What serves the whole is good for every part”.
- 7.9 repeats the last sentence of modern 3.5, “be upright, not kept upright”. That sentence is in
  the left-out part of passage 3.5 in section c3.s3.

Title: I kept “Short sayings”. It names the form of the passages, not a topic, and it is honest for
a section that has no topic. A topic title would claim a unity that isn't there.

Translation doubts in quoted passages (unchanged, listed only):
- 7.9: according to the translators' note, the “not” is an editor's correction; the manuscripts are
  said to read “or”. The note marks this as from memory and unchecked. The statement's first part
  rests on this one word.
- 6.5: “them” is supplied, because the Greek does not say like whom. The verb can also mean “defend
  oneself” or “take revenge”.
- 6.49: “is good for” renders a verb meaning “be to the advantage of”. It is a different word from
  the “good” of 9.15.

## Article 30 · The sameness and meanness of things (accepted)

“Everything in life is the same as it always was and foul in what it is made of, and I am no stranger to it.”

- **The section is loose but holds together.** Nine of the twelve passages share the topic, and I kept the provisional title. Three are set aside: 11.28 (two lines of verse with no comment), 11.20 (a bare mention of the mouse fable) and 6.51 (how many of my contemporaries have died, which belongs with death and time).
- **Translation doubt, 6.41.** The English “feel the same about the whole of life too” renders a bare infinitive that has no verb governing it. The translators' note says it can also be read as a statement (“this is what happens to you with the whole of life too”) and that some editors change it to an indicative. Claim 3's “I should feel” depends on the instruction reading. This is listed in `decisions`.
- **Reading doubt, 9.36.** The words “these things” point back to the cause and the matter of things, in the part of its chapter that is left out (that part also asks “what of these is new?”). The article reads the hundred years and the three as equal because nothing new appears. This is in `decisions` and in claim 1's `changed`.
- **Reading doubt, 9.22.** The passage has no verb and does not say what it calls “little breaths carrying corpses”. Claim 5 reads it, as 9.34 uses “little breath”, as the life in a person. This is in `decisions`.
- **Seneca's action item** (w1, Ep. 107.4) is close to Article 3's Seneca item from Ep. 91.4. Its `why` says so.

## Article 31 · How my soul uses itself (accepted)

“Everything lies in how my soul uses itself: it can see itself and the whole, or do violence to itself.”

- **Title changed.** Provisional: “The reasonable soul and its powers”. Used: “How my soul uses itself”. Reading all 18 passages, what they have in common is not a list of the soul’s powers but its use of itself, for good or ill. 5.11 and 12.26 ask how the soul or ruling part is being used. 2.14 and 2.3 say it does violence to itself, and 8.44 that it makes itself worse than itself. 11.1 says it sees, analyses and makes itself. The meaning shifts from what the soul can do to what it does with itself.
- **Six fused claims**, one more than the brief’s 3 to 5. The section has 18 passages, and each of the six groups has a component that two passages both say. I did not merge further, because each merge would join groups that share no words.
- **The doubt label.** c5 sits under If I doubt it. It answers a doubt about what becomes of the soul at death (11.3, 4.17), not a doubt about the statement itself. `limit` says so.
- **Translation doubts in quoted passages** (not changed; listed only):
  - 9.39: the construction is open (a statement to the ruling part, or six questions put to it), and the notes say some editors change λέγεις to an imperative. I use only its list of what the ruling part becomes.
  - 11.3: “as with the Christians” may be a later reader’s note that entered the text (translators’ note, from memory, unchecked). It is inside the quote of the single 11.3c, but nothing in the article rests on it. κατὰ ψιλὴν παράταξιν could also mean “from mere drill”; the item’s t follows the English (“bare opposition”).
  - 11.11: αὐτοειδής is rare and the text may have been emended; σπειρᾶται may instead be σπείρηται, “is scattered”. The quote I use (“shines with a light … the truth within itself”) avoids the doubtful words.
  - 2.3: the clause “each person has one life” is thought to rest on an editor’s repair (from memory, unchecked). It is in the quote of the single 2.3c.
  - 8.44: the word given as “shrinking in” is doubted; “fettered” has been proposed. It is in the quote 8.44a, but the claim does not use that word.
  - 12.26: the Greek seems to put even what is within choice among the “dead things and smoke”. The claim follows 6.30’s line instead and says so in `changed`.

## Article 32 · All things pass (accepted)

“All things change, and I with them; the change is the work of nature and nothing bad, and nothing that passes is great.”

- No hard case applied. The section holds together: all fifteen passages are about change and passing, and every one is quoted.
- Title kept: “All things pass”. It fits every central passage (10.7, 7.27, 6.14, 4.29, 10.19, 9.31) and the rest.
- Six claims, not the three to five the brief aims at. The section has fifteen passages and six real parallel groups; merging any two pushed a claim past five passages and broke the palette. The first build failed on the palette: 7.27 (“without lament”) had been put into claim 5 with 8.16 (“do not grumble”). It is now a said-once item, because the two speak of different things: 8.16 of the elements, 7.27 of what the gods send.
- Translation doubts in passages I quote (I have not changed anything):
  - 9.27 “The substance of the whole is a torrent”: the notes say some editors read “cause” for “substance” (from memory, unchecked). Claim 1 uses it for the river image only.
  - 6.14 “Each person’s life itself, too, is something of the kind”: the notes leave open whether “of the kind” looks back to the things running past or on to the vapour. I quote it with the vapour simile, and claim 1 uses it for “I am changing with them”.
  - 7.27: both lines I quote (“What grew from earth goes back to earth …” and “the sailing wind … must be borne, in toils without lament”) are verse Marcus copied from a poet, believed to be Euripides (from memory, unchecked). The article treats them as what Marcus holds, as he copied them to hold them.
  - 10.7: the last sentence, whose text is doubtful, is not quoted.

## Article 33 · The same matter, reshaped (accepted)

“What I am made of came out of the whole, goes back into it and is shaped again, and my ending belongs to the way I am made.”

- Overlap with Article 32 (c4.s1, “All things pass”). I have now read it. Its claim 5 says that change is nothing bad for what is changed, and its claim 6 says that a thing’s death is its dissolution into what it was made of. These come near claims 4 and 3 here. Article 32’s limit already names this article. This article’s own part is that nothing of me perishes into nothing, that the material is shaped into something else, that my death is the same change as my birth, and that my ending was intended. The `limit` now says this.
- I kept the title. It fits the central passages (7.17, 6.4, 5.13, 7.7). The later passages (4.5, 5.4, 8.18) are about death as the return of that matter, and the statement includes them.
- Doubts about the translation in passages I quote (I have not changed anything):
  - 4.5: the translators' note says the wording of “a combining out of the same elements, a dissolving into the same” is disputed and may be partly an editor's repair (from memory, unchecked). Claim 3 and the first part of the statement lean on it.
  - 5.13: “a change of this kind” is read as the change just described (my parts passing into other parts of the universe). That reading lets 5.13 back “My death is the same kind of change as my birth”. It is listed among the decisions.
  - 7.17: the image changes from wax to “a little box”. Claim 4 applies the box sentence to me; this is said in `changed` and in the decisions.
  - 4.12: “what gave birth to you” could also be “the one who gave birth to you” (the note gives both). The article takes the neuter, as the translation does.

## Article 34 · The dead and the forgotten (accepted)

“I keep in mind that all before me, the greatest too, are dead and soon forgotten, and I put my effort into living justly.”

- **Title kept**: “The dead and the forgotten” fits every central passage (4.39, 6.42, 4.28, 10.31, 10.34, 4.27, 12.20, 8.24).
- **Overlap (hard case: statement near another article's)**: Article 10's statement (“Before long I shall be no one and nowhere, so I live the present justly …”) is close. This statement is about *others*: the dead before me, the great among them, and the exercise of keeping them in mind. `limit` names Article 10 and Article 17. Claim 5 (leaving with good grace, olive and harbour) overlaps Article 17's “I am ready to go” and probably the unwritten Article 36, “Meeting death well”.
- **Translation points behind quotes** (I have not changed the translation):
  - 8.24 “Lucilla buried Verus, then Lucilla.” The Greek has no verb; “buried” is supplied by the translators. Claim 2 (“one person buries another and is buried in turn”) rests partly on this. 4.39 has the verb (“One buried this person and was then laid out”), so the claim still stands on that passage.
  - 4.39 “another buried that one”: the note says “that one” may be a different dead person, or the first burier, which makes a chain of burials. Either reading backs claim 2.
  - 4.39 μαθηματικοί is given as “astrologers” (other reading: mathematicians). The claim uses only what the English and Greek both say: they foretold other people's deaths.
  - 8.24 “move away and be posted somewhere else”: the subject is taken to be the little breath. Claim 9's “or a move somewhere else” and the `follows` keep it that way.
  - 3.3 “If to another life … if in a state without sensation”: the Greek has no verbs in either branch. Claim 9 keeps them as alternatives.
- **Order of claims**: claim ids follow the order on the page (why, action, practice, breaks, doubt): c1–c4 why, c5–c6 action, c7–c8 practice, c9 “When it breaks”, c10 doubt. In the revision a new c4 was inserted, so the earlier c4–c9 are now c5–c10.

## Article 35 · The length of a life and the use of its time (accepted)

“How long I live does not matter; my time has a limit, and I hurry to become good while it is still possible.”

1. **Title changed.** The provisional title was “The shortness of life”. The new one is “The length of a life and the use of its time”. Four passages (2.12, 4.42, 4.38, 6.44) say that how long a life lasts does not matter: even three thousand years is the same as the shortest life. They are not about life being short. The other four (3.1, 2.1, 4.14, 3.15) say that the time is limited and must be used now. The new title covers both halves. The old one fits only the second.
2. **The statement holds two things a reader may hear as opposed.** It says that how long I live does not matter, and also that I hurry. The passages hold both: no length is worth more than another, but whatever time I have is limited and running out. The statement joins the two with a semicolon and “and”. It adds no “so” of the editor’s.
3. **Seneca on ending one’s own life is left out on purpose, as in Article 10.** Ep. 58.34–35 (if old age shatters the mind he will leave life) and Ep. 77.20 (the play image) are close to 3.1 and to claim 1, but both argue for taking one’s own life. They are logged under `searched.rejected`.
4. **Translation doubts in the quoted passages (not changed):**
   - 4.14 “What must come hangs over you”: the Greek τὸ χρεών does not name death. Claim 2 reads it as death, as the translators’ note does.
   - 3.15 “putting away for yourself for old age” (ἀπετίθεσο, store away) and 2.1 “putting these things off” (ἀναβάλλῃ, put off) are different Greek verbs. The shared English “putting” is the translation’s. Claim 4 reads storing up reading for old age as one way of putting things off, and says so in `changed` and in a decision.
   - 3.1 “give out first” (προ-): the Greek does not say whether this means before the body’s other functions or before death. Claim 5 adds “while my breathing and eating go on”, which is the reading the passage’s own previous sentence gives.
5. **Overlap with neighbours.** This is stated in `limit` (see (d)).

## Article 36 · Meeting death well (accepted)

“My death is nature’s work, like the passing of my ages before it, so I go graciously and leave the people of my life kindly.”

- No hard case applied. The section holds together: all eight passages are about how to meet death and why it is not to be feared. Title kept as given, “Meeting death well”; it fits the central passages (9.3, 12.27, 10.36) and the arguments (12.17, 9.19, 2.10, 8.55, 6.26) that ground the meeting.
- Overlap, stated in `limit`: Article 6 already says that what the whole brings comes at the right time, and Article 3 (c4) that death is nothing unusual. Claim 3 repeats the first for death. The statement is about what this section adds: waiting for death and going graciously. Article 35 (c5.s2, the shortness of life, written alongside) owns the length of life, so 12.27’s “five years or three” and the three acts are left out here.
- Translation doubts on quoted passages (not changed, listed):
  - 12.27 (12.34–36) “the one who was responsible then for the putting together and is responsible now for the dissolving”: the translators’ note says the Greek pronoun is masculine, so not grammatically “nature” (feminine); it is god or the magistrate of the play image. Claim 3 reads it as nature, because the same passage has just said “by nature, which brought you in”. Recorded in `changed` and `decisions`.
  - 10.36 “For nature tied you to these people too … but now it unties”: the object “you” is supplied (it may be the speaker), and the note says “untie” loses the second sense of διαλύειν, “dissolve”, the usual word for a person’s dissolution at death. Claim 3 leans on that second sense with “takes me apart”.
  - 9.3 “nor violent”: ὠστικῶς is “pushing”, toward death or away from it; the English leaves it open, and so does claim 4.
  - 9.3 contains words in square brackets supplied for a gap (“[at what kind of] characters [your soul]”); the article’s quote 9.3e stops before them.
  - 9.3 “Do not despise death” and 12.27 “to despise death” use the same Greek verb in opposite spirit; the translators kept the tension. The article quotes only 9.3’s and leaves 12.27’s sentence out.
  - 2.10 (2.12b) begins in mid-chapter; “it” in quote 2.10a is “what dying is” from the sentence before. The said-once item names it as dying.

## Article 37 · What I learned, and from whom (accepted)

“I live as the people who brought me up and taught me showed me: even-tempered, careful in what I believe, and needing little.”

- Book 1 hard case: “From X: Y” is turned into “I Y” only where Marcus names a quality or habit as taken from that person. Bare descriptions of his father’s days (formal dress from Lorium, the cloak at Tusculum, bathing hours) are not made into rules. Every `follows` names the teacher.
- Too many parallels for one article. Ten long passages give about ten groups said by two or more passages. Six are claims. Four are left out and named in the decisions: tight and slack (1.5 and 1.13 use the same string image), saying plainly what I think (1.11, 1.12, 1.13), making no show (1.4, 1.6, 1.13), and valuing teachers (1.1, 1.10). None of them is passed off as “said once”.
- Title kept: “What I learned, and from whom”. It fits every passage, since each one opens “From X:”.
- Translation doubts in quoted passages (listed only, not changed):
  - 1.4 (modern 1.7) “my character”: the Greek does not say whose character; the possessive is supplied. Quoted in the said-once item 1.4a.
  - 1.4 “those who have been angry and have done wrong”: the Greek does not say against whom. Claim 6 takes it as against me (decision 4).
  - 1.11 (modern 1.14) “my brother Severus”: the translators’ note says the word “brother” has been doubted. “Unsparingly” may go with the sharing alone or with the doing good too; claim 4 takes it with the sharing.
  - 1.13 (modern 1.16) “not ‘he gave up the search too soon, content with the impressions that lay to hand’”: the translators say the text is doubtful here. Claim 3 uses it.
  - 1.13 “after his attacks of headache”: claim 2 says “an attack” (of illness).

## Article 38 · Socrates, Plato and other models (accepted)

“I measure a person by the soul, not by fame or power: a soul that is just, and for which dying is not the worst thing.”

1. **The section is a collection, not one argument (hard case 1, taken the cautious way in part).** Fourteen passages of quotations and anecdotes. Six fused claims were possible because two long passages (7.26, 7.37) and two short ones (7.23, 8.3) say overlapping things; everything else is a said-once item (8) or set aside (3). The article leans on 7.26 (three claims) and 7.37 (four), and says so in `limit`. Six claims is one more than the brief’s “aim for 3 to 5”; claims 1 and 5 rest on the same pair of passages (7.26, 7.23) but do different jobs (a judgment under “Why”, an exercise under “Practice”), so they were not merged.
2. **Title kept.** “Socrates, Plato and other models” fits every central passage (7.26 and 7.23 are Plato; 7.37, 11.23 and 11.32 are Socrates). Not changed.
3. **Much of the article is said elsewhere.** Compared against Articles 1 to 6 (the record) and the drafts of Articles 7 to 37 (read from their writers’ folders; not yet accepted, so their numbers and wording may change). Overlaps are listed in (d) and named in `limit`. What this article adds is the measure of a person: the soul, not fame or power.
4. **Words that are the editor’s, not Marcus’s: “fame” and “power”.** Neither is in the passages. 7.37 lists what was seen and told of Socrates (a more glorious death, nimbler argument, endurance, the affair of Leon); 8.3 names Alexander, Gaius and Pompey and speaks of their slavery. Recorded in claim 2’s `changed`, in `decisions`, and in the statement’s `form`, which also says that “not by fame or power” rests on two passages only because it joins two words with one witness each (7.37b, 8.3a).
5. **Plato’s hedge in 7.26.** The third paragraph of 7.26 is guarded (“see whether … may not be”, “perhaps … must”). The article reads it as Socrates’ polite way of asserting. The hedge is kept in the `follows` of 7.26c and 7.26g and in claim 1’s `shared`; claim 1’s `changed` and 7.26g’s `why` record the reading, and the flat strength of claim 1 rests on 7.23b and 7.26b, which are not hedged.
6. **6.22 under “If I doubt it”.** It says what holds on either account of the world (a universe run by reason, or atoms). It does not say what holds if the statement itself is false. Recorded in `decisions`. If the owner reads “doubt” strictly, 6.22 belongs under “Why” and the doubt label is empty.
7. **Doubts about the translation of passages quoted (not changed):**
   - 7.23 (7.23a, 7.23b): “Then such a person will count death, too, as nothing terrible?” answered by “Not in the least.” can be read in English as a denial. The Greek ἥκιστά γε agrees with the question (least of all will he think it terrible). The article reads it correctly. Suggested for the translation (reviewer’s wording): “…will not count death as anything terrible?” “Not in the least.”
   - 8.3 “their ruling parts were the same” (8.3b). The translators’ note says the text is probably doubted; readings meaning “were their own” have been proposed. The article uses this sentence only to say that 8.3 looks inside the men, which holds on either reading; now also said in claim 2’s `changed`.
   - 7.26 “ahead of disgrace” (7.26b), Greek πρὸ τοῦ αἰσχροῦ, “before the shameful”. In English “disgrace” can be heard as ill repute; the Greek means the shameful thing itself. Claim 1’s text now says “doing what is shameful” (the note’s other reading) while the quote keeps “disgrace”; `changed` says so. Seneca’s “just and at the same time disgraced” (Ep. 113.32) uses the word in the other sense; that item’s `why` says so.
   - 7.37 “a more glorious death”: ἐνδοξότερον has both glory and fame in it (the note’s other reading is “a more famous death”). The article’s “fame” leans on that.
8. **Editor’s glosses in the article’s own text, each recorded:** “Gaius Caesar” (the Greek has only “Gaius”; claim 2 `changed`), “though hardly anyone has heard of him” for Telauges (from the translators’ note; claim 2 `inferences`), “King” Perdiccas (from the note; 11.23a `why`), the names Alexander, Caesar and Pompey in claim 6 (from 8.3’s first sentence; `changed`), and the plain sense of “seed-reasons” in 6.22a (from the note; item `why`).

## 24 Nov 2026 — methodology page, polish, shared navigation, cover (owner's words, verbatim)

> Can we also have a separate page in the stoic constitution thing that explains the methodology? Embeddings, then
> clusters, then how we're combining different snippets, different pieces of text together. What's the logic of it?
> What's kind of the prompts that are used? Kind of the structure as well, like why in action practice, when it breaks,
> if doubted. That's an important part as well. And also like the parts that are why in action and practice, they're
> aligned poorly. So I want you to go over just like basic front-end design. Polish it up. […] align those whys and in
> actions. The vectors should be top aligned as well because they start at the statement. Maybe bring them up. But I
> like that they kind of scroll with the page still. That's good. Make them just start a bit higher. And there should
> be, the page that I sent with like documentation and stuff should have all the methodology step-by-step, including
> combinations with Seneca, including I don't know everything. And also homepage should like, should be a part of the,
> like all the, all the pages share navigation. This one should as well. And homepage should have some cool generated
> image like food, travel, and fitness have. There should be one for stoicism. Maybe like portrait of Marcus Aurelius,
> some like digitized cool thing. Let's pick up like let's do a few like versions of it and pick a better one. But
> yeah, make sure it fits with the style of the whole thing. Don't have to change the cards and everything. Just the
> color theme, the top navigation stuff, things like that. I think other parts of the site have the same kind of
> language selector. It could be shared with this thing. […] there should be a top button somewhere that says hide the
> what editor decided. Because I'll review it later. I haven't read it, but like when I'm reading through the whole
> thing, I kind of just don't want to. I want a smoother experience basically

Also: “phone is important part but not all of it” — test 390 and 1440 as equals.

## Found by the methods referee (24 Nov 2026), for the owner

- The build checks that each quote is an exact span and that each "gives" phrase stands in its claim; it does not check
  that the quote supports the phrase (that is a model's and the editor's judgment, awaiting your review), and an inference
  word the editor did not declare passes the build. Example: Article 1, claim 3, "So each thing I do…". A build rule for
  undeclared connectives ("so", "therefore", "because", "thus") is proposed, not yet made.
- The English of Marcus was checked against the Greek, but nothing checks it against copyrighted modern translations
  (only Seneca is checked against Gummere). Worth a check before relying on the CC0 release.
- Seven chapters is a fixed choice (scripts/aurelius-topics.py:30), not the result of a rule; cluster quality is weak
  (silhouette barely above shuffled labels). The chapters stand as an editorial grouping, to be judged by reading.

## Later on 24 Nov 2026 (verbatim)

- “stuff like this looks too repetitive Quoted from the Greek, in this project's own English. Passage numbers are those of
  the 1634 translation… Read the passages in Greek, today's English and 1634 / good frontend an do flags with buttons and
  links etc” — my reading: say it once, show small flags and a link under each title. Done (adcea8c).
- “also revie at the bottom of the page should only be admin view for me logged in and compactly hidden somewhere” — my
  reading: the review section, the Verdict buttons and the not-judged filter only for the site's admin signed in on that
  browser; for the admin, one folded row at the end. Done (see 36-finish-log.md).
- “do we need this block of text where articles are located? and with such weak title” (the intro: “The articles so far”
  and its paragraph) and “also this kinda should belong to methodology” (“1 · From the whole book to topics / How the
  topics were found”) — my reading: a real title and a one-line lede; the reading instructions folded into a key; the
  draft notice for the owner only; the grouping explanation and the linkage comparison left to the method paper (§3.2),
  linked from a section now called Contents. Done (see 36-finish-log.md).

# How should two passages become one lesson?

[Explore the visual study from concept to constitution article](../../public/apps/stoic-composition.html). Select a passage pair, read each passage piece by piece, compare the three draft articles side by side, tap any phrase to trace it to Marcus’s exact words or to the editor’s step, and remove the second passage to see which words depend on it. The study’s wordings were revised on 23 November 2026 and supersede the sample lessons below where they differ.

[Read the visual editorial review of both passage pairs and all three models](28-visual-study-review.html).

[Compare four extraction methods and the articles they produce](29-extraction-comparison.html).

Three proposals for editorial review. All three use the same two passages from the public Casaubon pilot. Each produces a different thing a reader could use. The sample lessons are editorial drafts.

## What can we extract from a sentence?

Take this sentence from 8.12, with line breaks reflowed for reading:

> As every fancy and imagination presents itself unto thee, consider (if it be possible) the true nature, and the proper qualities of it, and reason with thyself about it.

“Judgment” is a useful theme for finding the sentence again. To reconstruct the exercise, we also need to know what the pieces **do**.

| Piece | Function in this reading | What depends on it |
|---|---|---|
| “As every fancy and imagination presents itself unto thee” | Occasion | Tells the reader when to use the exercise. |
| “consider” | Mental act | Needs an object. Printing this verb alone loses the instruction. |
| “(if it be possible)” | Qualification | Travels with the direction to consider. |
| “the true nature, and the proper qualities of it” | Object of attention | Resolves “it” to the impression just mentioned. |
| “reason with thyself about it.” | Method | Gives the reader something to do with that impression. |

The model can keep “consider … the proper qualities of it” as one thought while anchoring its verb, object and qualification separately. It can also treat reasoning as a second coordinated act. The grammar leaves that choice open. Splitting at commas or taking the most quotable phrase would settle it prematurely.

## One encounter, three ways to organize it

Use these two passages for the comparison. The reference numbers follow this edition. Read the full passages alongside the excerpts. [Public Casaubon study](../../content/aurelius/backup-study.json)

| Source | Evidence used | What it supplies |
|---|---|---|
| A · 1.15 | “Betimes in the morning”; “a railer”; “my kinsman, not by the same blood and seed, but by participation of the same reason, and of the same divine particle”; “we are all born to be fellow-workers” | A morning rehearsal, a specific difficult encounter, and Marcus’s reason for resisting hostility. His fuller account of kinship also invokes participation in the divine. |
| B · 6.5 | “The best kind of revenge is, not to become like unto them.” | A criterion for the responder’s conduct. The aphorism leaves the next act and the reason for the criterion open. |

### 1. A practice organized in time

**Extraction question.** What can I rehearse, notice or do, and when? Capture the occasion, mental or outward act, object, and any condition on that act. Keep an absent action blank. Join a preparation to a later use only if the agent and situation fit. Name the step the editor supplied.

**Worked join.** A provides the preparation and its object, the anticipated railer. B supplies a criterion for examining one’s own response. Applying B during A’s encounter is the editorial step.

> In the morning, bring to mind someone who may insult you. Remember why you still count this person as kin. When the insult comes, ask whether your reply would copy it.

A reader gets a rehearsal they can actually try. The closing question is our way of practicing B. Neither passage prescribes a particular reply. This model is attractive if the book should teach repeatable exercises. Its weakness is the temptation to invent steps whenever a passage supplies only a principle.

### 2. An argument organized by dependence

**Extraction question.** What is Marcus asking me to accept, and what reason does he give me for accepting it? Capture the claim, the reason and its target, plus any objection, analogy or qualification. Join across passages only by writing the missing premise in plain language. Leave the claims side by side if that premise is too costly.

**Worked join.** A reasons from shared nature and the purpose of working together to the wrongness of hostility. B commends refusing imitation. To make A support a particular application of B, the editor needs the premise *returning abuse for abuse would set these two people further in opposition*. A and B can both be true without establishing that every form of imitation damages cooperation.

> We are fellow-workers even when one of us acts badly. Where answering abuse in kind would deepen our opposition, our shared purpose gives me a reason to answer differently.

A reader gets a reason they can accept or dispute. The conditional belongs to our inference. If a reviewer rejects that bridge, retain A’s argument and B’s aphorism as separate entries. This model suits a book whose principles should withstand the question “Why?” It produces little new prose when the evidence for a bridge is thin.

### 3. A decision examined by two independent tests

**Extraction question.** What feature of a possible act would count for or against it? Capture the decision, criterion, and what the criterion leaves undecided. Combine two criteria when a reader could apply them to the same choice and learn something different from each. Neither passage needs to supply the other’s reason.

**Worked join.** Imagine choosing how to answer a public insult. A asks what the reply does to the relationship between fellow-workers. B asks whose conduct the reply imitates. The encounter and candidate replies below are editorial examples.

| Possible reply | A · Can I still deal with this person as a fellow-worker? | B · Am I copying the insult? |
|---|---|---|
| Answer with a matching insult | The exchange gives me reason to expect further hostility. | Yes. |
| Quietly exclude the speaker from a shared task to get even | The exclusion works against our shared task. | The words and manner differ. Whether I am imitating the underlying hostility remains open. |
| Name the insult and ask to resume the task | This leaves a way to work together. | The reply as described does not repeat the insult. |

> Before you answer, ask two questions. What part of their conduct would I repeat? What would my reply do to the work we still share?

The middle row earns the second question its place. A courteous manner alone settles very little. This model suits a constitution consulted at a moment of choice. It depends heavily on examples, and a reviewer can challenge how the editor framed any one of them.

## What happens on a different pair?

Casaubon 8.12 directs examination of an impression where possible. In 9.13 Marcus asks who passes verdict on external things and answers “The understanding.” A practice can use the latter as a prompt during the former exercise: *When you can, examine the impression. Ask what verdict you have supplied.* Asking that question is an editorial method. An argument can use 9.13 to explain why looking at one’s own judgment might be relevant, provided the editor states the bridge that our verdict is itself available for examination. The two-test model should decline the join here. Identifying who judges supplies no independent criterion for whether the verdict is sound. All three models may keep 8.12 as a single-source exercise.

## A prompt for a small, blind comparison

Give a model the two full numbered passages and their immutable revision IDs. Pick one of the three model descriptions above. Withhold the worked joins and sample wording so the output can differ. The following instructions can be reused with any of the three.

~~~text
Read each passage independently first. Identify the smallest pieces needed
to preserve a complete thought. Give each piece a local id, passage
revision, exact quote and voice. Include adjacent context if the quote
occurs twice. For each thought, list its piece ids, its theme, what it
does under the selected model, and any pieces qualifying it. Preserve
the direction of a claim, its speaker and its object. Report alternate
readings where they would change the result.

Now attempt one join using the selected model's rule. Return the two
contributions, the sentence explaining their connection, and which part
of that connection the editor had to supply. If the rule fails, return
"keep separate" and say what is missing. An empty role is a valid result.

Finally draft the shortest usable lesson that follows from the join.
For each clause identify the supporting piece ids and any editorial
addition. If the passages stay separate, show their independent uses.
~~~

The existing annotation language already carries exact pieces, voice and argument relations. The thought functions above can be proposed alongside those annotations during review. For retrieval, the “idea vector plus how-to vector” intuition suggests two searches: find a principle about the concern, then look for an exercise that could put that particular principle into practice. A candidate earns a place when we can finish the sentence *this exercise implements this principle by…* and point to the pieces on both sides. The two-test and argument models ask for different relations. [Annotation language](../../docs/aurelius/annotation-language.md)

## How to decide

Read the three drafts for the insult encounter before looking at their labels. **Which would you want to find in your constitution the morning after an actual argument?** Then inspect the extraction behind that choice. Can you recover what each passage contributed? Would you endorse the editor’s added step? Does a qualification or an unanswered question disappear? Try removing B: the practice should lose its imitation check, the argument its application to answering in kind, and the decision table one entire column.

My first choice for a trial is **practice**. It tests the original idea that one passage can tell you how to use another. Keep **two independent tests** as the challenger, especially if the middle row feels more useful than the rehearsal. Prefer **argument** where the missing thing in the book is a reason to believe the rule. A useful outcome of this review could be choosing different forms for different lessons.

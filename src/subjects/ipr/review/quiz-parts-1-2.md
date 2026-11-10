# IPR quiz A (Part One u1, Part Two u2): moderator's review

Draft: `drafts/ipr/quiz-a.json`. Source: `src-notes/ipr.md`, sections 1.1–1.7 and 2.1–2.12. Spec: CONTENT-SPEC.md section 7.
Validator (`--kind quiz --units u1,u2`): **PASS** with no warnings. The draft went from 109 items to 117 (u1 49, u2 68).
All changes were applied by one script keyed by id (`work-ipr-qa/patch.mjs`, run on a backup of the original draft), so these counts are generated, not hand-counted.

## Counts

| Unit | Reviewed | Kept | Edited | Rewritten | Removed | Added | Final |
|---|---|---|---|---|---|---|---|
| u1 (Part One) | 44 | 30 | 9 | 5 | 0 | 5 | 49 |
| u2 (Part Two) | 65 | 44 | 19 | 2 | 0 | 3 | 68 |
| **Total** | **109** | **74** | **28** | **7** | **0** | **8** | **117** |

"Edited" means wording, option or explanation fixes. "Rewritten" means the stem or the answer logic was rebuilt. No item had to be removed, because every faulty one could be fixed.

Questions per section: 1.1: 7 · 1.2: 5 · 1.3: 10 · 1.4: 9 · 1.5: 6 · 1.6: 8 · 1.7: 4 · 2.1: 7 · 2.2: 6 · 2.3: 7 · 2.4: 8 · 2.5: 4 · 2.6: 7 · 2.7: 4 · 2.8: 5 · 2.9: 4 · 2.10: 5 · 2.11: 5 · 2.12: 6. Every section has at least four.

## The 5 most significant fixes

1. **Stems that gave the answer away.**
   - **u1-q30:** the stem said "a compulsory licence may be sought three years after grant", and the answer was the compulsory licence. It now says only that the law attaches a consequence to non-working after three years.
   - **u1-q39:** the stem said "post-grant opposition is open for one year". It now states both opposition routes neutrally, so the student has to apply the timing.
   - **u2-q20:** the stem listed the four missing elements of a sound valuation, and the answer repeated them. The student must now know the elements.
   - **u1-q17 and u1-q18:** the answers paraphrased the stems ("capitalise excess profit", "one figure tracked over time"). Both stems were recast as problems to solve.
2. **Arithmetic and explanation errors.**
   - **u2-q61:** the distractor "₹3,500 crore, because book value rises with the share price" did not match its own reasoning. That slip gives ₹3,850 crore, which duplicated another distractor. It is now "the gap stays fixed".
   - **u2-q50:** the explanation said the 45.01 slip came from depreciating only 2025's patents. That slip gives 48.45. The 45.01 slip comes from depreciating each year's new patents in the year they arrive.
3. **A rule stated more strongly than the notes allow.** The answer to u1-q01 made a legal or contractual right *necessary* for control. The notes say control "usually" means such a right. The answer now rests on the stem's facts: the firm has no right and no safeguard.
4. **Absolute words as a cue.**
   - In **u1-q07, u1-q28, u1-q40 and u2-q06**, every distractor used an absolute or near-absolute word ("exact", "reliable", "every", "any", "There is none"), and only the correct option was hedged.
   - In **u2-q07**, the correct option was the only one naming several countries.
   - The bank had 9 "Nothing/None is wrong" distractors, and none of them was ever the answer, so they had become a giveaway. There are now 3 (u1-q26, u2-q11, u2-q59).
   - Implausible distractors were replaced in u1-q39, u1-q40 and u2-q04: "compulsory licence because the patent is unworked", "counts matter only in the US" and "register software as a design".
5. **Coverage and teaching.**
   - **1.6** went from 4 to 8 items: offensive vs defensive blocking, classifying patenting motives, ad hoc blocking vs a strategic patent, and sporadic vs continuous filing.
   - **2.4** went from 5 to 8 items, using indices other than the Patent Asset Index: a technology-strength calculation, the step of testing an index against real outcomes, and subjective weights.
   - **1.5** gained a scorecard-method calculation, with all seven weights given in the stem.
   - **Explanations:** ten explanations did not say why the tempting distractor is wrong: u1-q36, u2-q05, q18, q19, q24, q27, q30, q48, q54 and q58. Each now does, within 2–4 sentences.

Smaller fixes:
- Trimmed correct options that were clearly the longest (u1-q16, u1-q36, u2-q14, q27, q32, q37) and lengthened short distractors (u2-q58).
- Removed stem echoes in u1-q06, u1-q24 and u1-q31.
- Added "registered as a trade mark" to u1-q02, so that the "not identifiable" distractor is clearly wrong.

## Checks performed
- **Concept-based:** no answer is a provision number, case name, year, author's name or figure to recall. Where a rule needs a figure (three years, one year, the ten-year renewals), the figure is in the stem or is not needed. Five answers are concept labels chosen from a scenario: an IC measurement family, the IC Index, an event study, absorptive capacity and the SECI stages. These test classification, not the authors.
- **Calculations:** every calculation was recomputed in node (`work-ipr-qa/calc.mjs`) using the notes' formulas, and each distractor was checked as a realistic slip:
  - market to book (u1-q05), Tobin's q (q19), VAIC (q20) and CIV (q21)
  - VC method (q34) and the new scorecard item (q49)
  - Patent Asset Index (u2-q21), the new technology strength item (q66) and γ in V = q(A + γK) (q26)
  - binomial model (q33) and decision tree (q34)
  - depreciated patent stock (q50) and RTA (q51)
  - residual gap (q61) and enterprise value (q63)
- **Notes' worked examples, all reproduced:**
  - market to book 5; VAIC 3.6; CIV 150
  - scorecard 1.155 → ₹23.1 crore; VC 26.34 / 16.34 / 38 per cent
  - PAI 4.83 vs 2.0
  - Black–Scholes d₁ 0.3864, d₂ −0.3065, C 28.11; binomial 14.82; decision tree 7.27 / 25.45 / 18.18
  - patent stock 74.20; RTA 4.0
- **No tested item is contested:** the notes contain no † markers, and no item tests the 2.11 society names, whose registration status the notes say must be checked.
- **Metadata:** every `slide` is `s<part>-<section>-1` for the section that teaches the point, and every concept label has 8 words or fewer.

## Notes flags (expertise vs notes; the quiz follows the notes in every case)
1. **Control under Ind AS 38 (1.1).** The notes' "control usually means a legal or contractual right" is correct: Ind AS 38 treats legal enforceability as the normal source of control, not a necessary one. The fault was in the draft (u1-q01), not the notes.
2. **Licence registration (1.4).** The notes say "a patent licence must be in writing and registered to be relied upon (ss. 68 and 69)". This is a fair summary but simplifies the law:
   - Section 68 makes writing (a duly executed document) a condition of validity.
   - Under s. 69(5), an unregistered document is not admitted as evidence of title *unless the Controller or court, for reasons recorded, directs otherwise*.

   u1-q26 follows the notes' wording. Consider adding the s. 69(5) proviso to the notes.
8. **Why internally generated brands are barred (1.1).** The notes give no reason for the bar in para 63. u1-q02 takes its reasoning from 1.2's relevance-versus-reliability point. The standard's own reason (para 64) is that the cost of a home-grown brand cannot be separated from the cost of building the business as a whole. That fits the reliability reading, so the item stands.
3. **Prior disclosure (2.1, 2.9).** The notes say only that Indian law allows "limited exceptions". One of those exceptions is display at a government-notified exhibition, which has a 12-month grace period. That is why u2-q06 keeps "usually destroys novelty" in its key and "any disclosure" in its wrong option. The fair in its stem is not said to be notified, so the item still has one best answer.
4. **Restoration (2.2).** Beyond s. 60, the Act also protects people who began using the invention between lapse and restoration. This strengthens u2-q11 but is not in the notes, so it was not added.
5. **Copyright societies (Quick revision, Part Two).** The quick revision cites "ss. 33 to 36A". The body of 2.11 discusses only ss. 33, 33A, 34, 35 and 36. This is a minor inconsistency, and the quiz cites only the body's sections.
6. **Black–Scholes rounding (2.6).** The notes write 65.04 minus 36.93. Exact working gives a K-term of 36.92, and the option value is still 28.11. This is rounding only and is not tested.
7. **Offensive vs defensive blocking (1.6).** The notes cover this in one sentence: offensive blocking secures market freedom, defensive blocking secures design freedom. u1-q45 is written strictly within that sentence. A fuller account of Granstrand's distinction would help the slide.

## Full change list
- u1-q01 (edited): the answer made a legal or contractual right strictly necessary for control, where the notes say "usually". It is now tied to the stem's facts.
- u1-q02 (edited): the stem says the brand is registered, so the "not identifiable" distractor is clearly wrong.
- u1-q06 (edited): the stem's list of rights was echoed by the answer.
- u1-q07 (edited): all three distractors were absolute; rewritten as hedged ones.
- u1-q16 (edited): trimmed the longest answer.
- u1-q17 (rewritten): the stem paraphrased the answer. It now describes the CIV steps, with bare family names as options.
- u1-q18 (rewritten): the answer echoed the stem; the stem is now a problem.
- u1-q24 (edited): the answer echoed "strong" and "market".
- u1-q28 (edited): all distractors were absolute. Replaced the "competition law protects every condition" distractor, which overlapped q29, with a consent misconception.
- u1-q30 (rewritten): the stem named the remedy that was the answer.
- u1-q31 (edited): the stem's "license related patents together" was echoed by the answer; both stem and answer reworded.
- u1-q36 (edited): trimmed the answer; the explanation now rebuts the distractors.
- u1-q39 (rewritten): the stem gave away post-grant opposition; it now states both routes. Weak distractor replaced.
- u1-q40 (rewritten): all distractors were absolute or implausible; replaced.
- u1-q45 to u1-q48 (added): 1.6 on blocking, patenting motives, ad hoc vs strategic patents, and sporadic vs continuous filing.
- u1-q49 (added): 1.5 scorecard calculation (₹11.40 crore; slips ₹10.43, ₹8.77 and ₹11.14 crore).
- u2-q04 (edited): replaced the implausible "register software as a design" distractor.
- u2-q05 (edited): the explanation now rebuts the "design renewable without limit" distractor.
- u2-q06 (edited): all distractors were absolute; one replaced.
- u2-q07 (rewritten): the answer was the only option naming several countries; the distractors now name several too.
- u2-q11 (edited): one of the two "Nothing" distractors replaced, and its rebuttal added.
- u2-q14 (edited): trimmed the longest answer.
- u2-q18 (edited): "None" distractor removed; the explanation now rebuts the inflation option.
- u2-q19 (edited): the explanation now rebuts the distractors.
- u2-q20 (rewritten): the stem listed what the answer repeated. A listed but wrong distractor was added for balance.
- u2-q22 (edited): "Nothing" distractor removed.
- u2-q24 (edited): the explanation now rebuts the distractors.
- u2-q27 (edited): trimmed the answer; the explanation now rebuts the distractors.
- u2-q30 (edited): the explanation now rebuts the distractors.
- u2-q32 and u2-q37 (edited): trimmed the longest answers.
- u2-q45 (edited): "None" distractor removed.
- u2-q48 (edited): the explanation now rebuts the distractors.
- u2-q50 (edited): the explanation misdescribed the 45.01 slip.
- u2-q54 (edited): the explanation now rebuts the distractors.
- u2-q58 (edited): balanced the option lengths; the explanation now rebuts the distractors.
- u2-q61 (edited): a distractor's number did not match its stated reasoning.
- u2-q66 to u2-q68 (added): 2.4 on technology strength (B 360 against A 300), testing an index against real outcomes, and subjective weights.

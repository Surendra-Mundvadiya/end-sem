# Moderator's review: IPR quiz B (Part Three, u3, sections 3.1 to 3.18)

The draft is `drafts/ipr/quiz-b.json`. I checked it against the source notes (`src-notes/ipr.md`, Part Three) and section 7 of `CONTENT-SPEC.md`.

The validator command given in the brief prints `quiz 90 (u3:90)` and **PASS**. The patch script is `scratchpad/patch-quiz-b.mjs`, and it starts from the untouched copy saved as `scratchpad/bak/quiz-b.orig.json`.

## Counts

| Reviewed | Kept unchanged | Edited | Rewritten | Removed | Added | Final |
|---|---|---|---|---|---|---|
| 81 | 52 | 21 | 8 | 0 | 9 | 90 |

- **Rewritten (8):** q13, q26, q33, q43, q58, q64, q68, q73
- **Edited (21):** q07, q14, q15, q16, q17, q18, q21, q39, q40, q42, q46, q48, q50, q52, q53, q55, q57, q60, q61, q69, q74
- **Added (9):** q82 to q90. Each new item is placed next to its section, and all existing ids are kept.

Items per section after the review:

| 3.1 | 3.2 | 3.3 | 3.4 | 3.5 | 3.6 | 3.7 | 3.8 | 3.9 | 3.10 | 3.11 | 3.12 | 3.13 | 3.14 | 3.15 | 3.16 | 3.17 | 3.18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 4 | 5 | 4 | 4 | 4 | 6 | 5 | 5 | 7 | 4 | 6 | 5 | 6 | 4 | 4 | 4 | 7 |

## The 5 most significant fixes

1. **The audit items relied on the 3.9 vs 3.17 conflict (q73 rewritten, q74 edited).**
   - q73's key said an audit is "a regular internal review; due diligence serves one deal". That follows 3.9 ("not tied to a deal"), but 3.17 describes an event-based audit carried out before a merger, investment, public issue or loan.
   - The new q73 has no deal at all. It asks why a firm whose accounts have just been signed off still needs an IP audit, and its distractors are a financial audit, a valuation and a portfolio review. Both sections of the notes agree on all three distinctions.
   - In q74, I removed "audits are regular rather than deal-driven" from the `why`, and its matching distractor. I also reworded the key, which read "review the mark for keep or drop". 3.17 gives that as the definition of a portfolio review, which it treats as separate from an audit. The key now speaks of cost savings and licensing income.

2. **Six items duplicated quiz-a, which covers Parts One and Two of the same subject.** The bank is merged, so I moved each of them onto a concept specific to Part Three.

   | Item | Duplicated | Rewritten to test |
   |---|---|---|
   | q26 | u2-q10: a joint owner needs consent to license (s. 50) | publication rights in a university collaboration (3.7) |
   | q33 | u1-q32 and u1-q33: an outside developer owns software it wrote without an assignment | owning a valid patent is not freedom to operate (one of the four due-diligence questions, 3.9) |
   | q43 | u1-q26: an oral, unrecorded patent licence; same concept label | what a copyright licence must identify under ss. 30 and 30A (3.10) |
   | q58 | u1-q11: a related-party royalty tested by transfer pricing | choosing a reliable arm's-length comparable (3.13) |
   | q64 | u2-q17: a founder's non-compete valued with and without | choosing excess earnings to value a core asset (3.14) |
   | q89 (my own first draft) | u2-q52: the counting unit must be stated | why lenders prefer several strong families (3.15) |

   I also narrowed q90 to flooding and decoy filings only, because u2-q54 already tests the depreciation of older patents. After these changes, no concept label is shared with quiz-a.

3. **q13 tested exam technique rather than a concept (rewritten).** Its key was the notes' guess about which meaning the syllabus intends by "sustaining and sustainable", which is exactly the ambiguity the brief warned about.
   - The new stem states the market-effect sense and asks the student to classify two projects: a better sedan for existing customers is sustaining innovation, and a cleaner paint shop is sustainable (green) innovation.
   - The wording avoids "large jump in performance" and "fuel efficiency", so that neither radical innovation nor green innovation becomes a defensible answer.

4. **q46 had two defensible answers.** Its key was "sell *or securitise*" the royalty stream. Securitisation works by issuing bonds (the notes' own example is the Bowie bonds), which is borrowing, but the stem says the estate "does not want to borrow". The key is now "Sell its future royalty stream to investors".

5. **Answer cues and weak distractors were removed.**
   - **q21:** all three distractors restated the CEO's closed view, so a student could rule them out without knowing anything about open innovation. They are now misreadings of open innovation.
   - **q18:** all three distractors contained "…for every change". They now mirror the key's function / looks / process structure.
   - **q68:** the key was the only complete list, set against three options beginning "only…". The item is now framed as "the charge is filed with the ROC only; what is still missing?", and it has a tempting half-right option (CERSAI only).
   - **"About" wording (q48, q50, q52, q60, q61):** the wrong undiscounted options lacked "About" while the right ones had it. Each item now uses one form throughout.
   - **Weak or absolute distractors replaced:** q07, q14, q15, q16, q17, q39, q40 and q42. Examples:
     - "radical innovation is low risk"
     - "only grants may lawfully fund"
     - "abandon the patents"
     - "buy the licensee's whole business"
     - in q15, a secrecy option that contradicted the stem, since the process is already patented

## Coverage added (9 items, all concept or application)

- **3.1:** technology push vs market pull (q82); the order of adopter groups (q83). The key depends on the order of the groups. Percentages appear only in the `why`, never in the answer.
- **3.2:** lack of complementary assets (q84).
- **3.4:** IP strategy for sustaining innovation (q85).
- **3.5:** the IP emphasis for incremental vs radical projects (q86).
- **3.8:** patent family information shows protection abroad (q87). This is a different point from q32, which covers claims vs abstract.
- **3.10:** an upfront fee, milestones and a running royalty for an uncertain, staged licence (q88).
- **3.15:** lenders prefer several strong families (q89); flooding and decoy filings inflate counts (q90).

## Other edits

- **q53, q69:** I shortened each key, which had been clearly the longest option.
- **q55:** the key now reads "near its top" (of the middle range).
- **q42, q57:** the `why` now explains why the tempting distractor is wrong.

## Calculations (all recomputed in node)

Every numeric key and every distractor slip checks out.

| Item | Key | Distractor slips |
|---|---|---|
| q48 | −0.4733 | 6, 2.4793, 29.5267 |
| q49 | 13.2 | 14.1, 10.8, 9.0 |
| q50 | 1.8708 | 103.8993, 10, −16.3110 |
| q51 | 3.5438 against 3.30 | 4.275, 4.725 |
| q52 | 50 | 36.36, 51.5, 28.57 |
| q54 | 4 | 12 |
| q55 | median 4.5, range 3.0–5.0 | mean 4.7 |
| q59 | 11.3159 | 15.0879, 14.1862, 10.8082 |
| q60 | 32.5027 | 50.0041, 42.9, 37.3781 |
| q61 | 31.1044 | 38, 34.2149, 28.2768 |
| q67 | 2.4 | 4.0, 4.8, 1.6 |
| q71 | 10 / 16 / 6 | added instead of multiplied: 7 / 8 / 5 |
| q77 | 0.30 | 0.18, 0.45, 0.75 |
| q79 | 0.15 | — |

None of the added or rewritten items involves a calculation.

## Checks beyond the validator

The validator checks only structure, so I also checked:

- **Concept labels:** 8 words or fewer.
- **`why` length:** 2 to 4 sentences, counting "Authority: …" as one sentence and treating "s." and "ss." as abbreviations.
- **Option lengths:** the key's length compared with the mean of the distractors.
- **Absolute words:** the flags that remain are distractors that state a false legal rule, so the absolute word is part of the error rather than a giveaway.
- **Duplicates:** no duplicate stems within quiz-b; duplicates against quiz-a are covered above.
- **Slide ids:** all are `s3-<n>-1`.
- **Recall:** no key is a provision number, author, case, year, rate or remembered figure. Where an item needs a rate or a band (q49, q67, q71, q77, q78, q79), the stem gives it.

## The notes' known inconsistencies: none is tested

- **3.9 vs 3.17 (is an audit tied to a deal?):** dealt with in q73 and q74 as above. q72 uses 3.17's event-based audit and does not contrast it with due diligence.
- **Sustaining vs sustainable:** dealt with in q13. q14 and q85 plainly concern Christensen's sense; q15 plainly concerns green innovation.
- **₹1.815 vs ₹1.81 crore (3.16):** not used; q67 has its own figures.
- **43.645 vs 43.644 (3.12, Example 3):** not used; q50 has its own figures.

## Inaccuracies and points to note in the notes

No item depends on any of these; every item follows the notes.

1. **3.12, Example 3.** The present value of the year 4–8 income is 43.6444, but the notes print 43.645. The risk-adjusted NPV is 4.147, which still rounds to the notes' 4.15.
2. **3.16.** 3.63 × 50% = ₹1.815 crore, printed as ₹1.81 crore; it rounds to 1.82. The loan of "about ₹0.91 crore" (0.9075) is correct.
3. **3.9 vs 3.17.** 3.9 says an audit is "not tied to a deal", but 3.17 describes an "event based audit … before a merger, investment, public issue, loan". A consistent wording would be: an audit is the firm's own review of its IP, which may be general or prompted by an event, whereas due diligence investigates IP for a particular transaction.
4. **3.7, 3.9, 3.10 and 3.16 overstate s. 69 (expert comment).** These sections say a patent licence or mortgage "must be in writing and registered (ss. 68 and 69)".
   - Under s. 68, an unwritten licence, assignment or mortgage is indeed not valid.
   - Under s. 69, failing to register does not void the document. Section 69(5) says only that an unregistered document is not admitted as evidence of title, unless the Controller or a court directs otherwise.
5. **3.9 overstates copyright assignments (expert comment).** It says the chain of title needs "written *and registered* assignments … Copyright Act, s. 19". Section 19 requires writing, but Indian law has no requirement to register a copyright assignment. Registration applies to patent assignments (ss. 68 and 69) and trade mark assignments (s. 45).
6. **3.18 cites provisions of the new Act that I could not check from here:** ss. 393(1) and (2), 207, 159, 33(1)(b) and 194(1), and Form 65. No item tests a provision number. Form 65 appears only in q78's `why`, as the notes state it.
7. **Other figures confirmed exactly:**
   - Example 1: NPV 9.84, IRR 20.50%
   - Example 2: 5.62, 5.92 and 5.34; the lump sum is 4.5 after tax
   - WACC: 12.66%
   - Relief from royalty: 11.66
   - Multi-period excess earnings: 39.98
   - With and without: 20.34
   - 25 per cent rule: 5%

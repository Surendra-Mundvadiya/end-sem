# Study Kit

An interactive study app for law subjects, starting with Taxation Law (Income Tax Act, 2025). It has readable notes with a recall mode, a spoken tutor, concept-based quizzes, spaced-repetition flashcards, a cases explorer, visual memory tools and one-page revision sheets.

**Live site:** https://surendra-mundvadiya.github.io/end-sem/

Each subject has its own address (`…/end-sem/#/tax/…`) and keeps its own progress in the browser.

## Folder structure

```
tax/                          Taxation Law source material
  Taxation_Law_Study_Material.pdf
  The Income Tax Act, 2025.pdf    (bare act)
  syllabus.md
src/
  subjects/
    registry.ts               The list of subjects (title, PDFs, which tools it has)
    tax/content.json          All Taxation Law notes, cases, questions and flashcards
    tax/review/               The professor review logs for the question bank
  data/index.ts               Typed access to the current subject's content
  features/                   One folder per section of the app:
    learn/                      notes reader with recall mode
    tutor/                      spoken lessons (browser text-to-speech)
    flashcards/                 spaced-repetition flashcards
    quiz/                       practice, exam and weak-spot quizzes
    cases/                      cases explorer and concept-match game
    lab/                        Taxation Law tools: calculators, decision tree, timeline, mnemonics
    revise/                     one-page unit summaries
    reference/                  key figures, section finder, PDFs
  components/, lib/, styles/  App shell, search, progress store, theme and design tokens
.github/workflows/deploy.yml  Builds and deploys to GitHub Pages on every push to main
```

## Adding a subject

1. Put the subject's PDFs in a new top-level folder, for example `contract/`. The build copies every PDF in such folders.
2. Create `src/subjects/contract/content.json` in the format below.
3. Register the subject in `src/subjects/registry.ts`: its id (used in the URL), title, subtitle, PDFs, and `hasLab: false` unless you also add Memory Lab tools for it.

Every section works for any subject. Sections without content (for example no cases, key figures or section finder) are hidden automatically.

```jsonc
{
  "units":  [{ "id": "u1", "short": "Unit I", "name": "Formation of Contract", "hours": 6 }],
  "slides": [{ "id": "s0", "u": 0, "part": "1. Offer", "title": "1.1 Meaning of offer", "html": "<p>…</p>", "plain": "…" }],
  "cases":  [{ "u": "u1", "part": "1. Offer", "slide": 0, "name": "Carlill v. Carbolic Smoke Ball Co. [1893] 1 QB 256", "h": "What was held", "plain": "…" }],
  "quiz":   [{ "id": "u1-q01", "u": "u1", "concept": "Offer vs invitation to treat", "slide": "s0", "q": "…", "ok": "…", "no": ["…", "…", "…"], "why": "…" }],
  "cards":  [{ "id": "u1-k01", "u": "u1", "k": "concept", "f": "…", "b": "…" }],
  "about": "<p>How to read these notes</p>",
  "appA": "",
  "appB": ""
}
```

`slides[].u` is the unit's position (0 for the first unit). Everything else refers to units by id. Slide HTML may use `<p>`, `<strong>`, `<em>`, `<ol class="pts">`, `<div class="case"><p class="cname">…</p><p>…</p></div>`, `<aside class="focus">` and `<div class="clause">`.

## Question style

Quiz questions and flashcards test **concepts**: understanding, application and the ability to tell ideas apart. They do not test recall of section numbers, case names, citations, years or figures.

- Prefer scenarios ("A municipality charges each household for collecting its garbage: tax or fee, and why?"), distinctions, the reason behind a rule, and spotting flawed reasoning.
- The answer is never a section number, case name or bare number. If applying a rule needs a threshold, the question states it.
- Exactly one defensible answer, three plausible distractors, options of similar length.
- The explanation says why the answer is right and why the tempting wrong answer fails. It may end with the authority (section or case) for further reading.
- Every question names its `concept` and links to the `slide` that teaches it.

The Taxation Law questions were written and then independently reviewed against the notes, in the role of a taxation law professor and practising tax counsel. The review logs are in `src/subjects/tax/review/`.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/end-sem/
npm run build    # type-checks, builds to dist/ and copies the PDFs
```

On networks that inspect TLS traffic, npm may hang or fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Let Node trust the operating system's certificates instead of disabling SSL checks:

```bash
NODE_OPTIONS=--use-system-ca npm install
```

# Study Kit

An interactive study app for law subjects. Each subject has:
- readable notes, one idea per slide, with a recall mode
- a spoken tutor
- concept-based quizzes
- spaced-repetition flashcards
- a Memory Lab: course map, topic-order game, comparison matrices, sorting games, calculators, decision trees, timelines and mnemonics
- one-page revision sheets and a glossary

**Live site:** https://surendra-mundvadiya.github.io/end-sem/ (currently IPR Management)

Each subject has its own address (`…/end-sem/#/ipr/…`) and keeps its own progress in the browser.

## Folder structure

```
study/                        Source notes (Word) for each subject
src/
  subjects/
    registry.ts               The list of subjects (title, PDFs, which tools it has)
    ipr/content.json          IPR Management: notes, quiz, flashcards, glossary, Memory Lab data
  data/index.ts               Typed access to the current subject's content
  features/                   One folder per section of the app:
    learn/                      notes reader with recall mode
    tutor/                      spoken lessons (browser text-to-speech)
    flashcards/                 spaced-repetition flashcards
    quiz/                       practice, exam and weak-spot quizzes
    cases/                      cases explorer and concept-match game
    lab/                        Memory Lab, generated from each subject's lab data
    revise/                     one-page unit summaries
    reference/                  glossary, key facts, section finder, PDFs
  lib/formula.ts              Safe arithmetic for the Memory Lab calculators (no eval)
  components/, lib/, styles/  App shell, search, progress store, theme, note styles
.github/workflows/deploy.yml  Builds and deploys to GitHub Pages on every push to main
```

## Adding a subject

1. Put any PDFs in a top-level folder, for example `contract/`. The build copies every PDF in such folders.
2. Create `src/subjects/<id>/content.json` in the format below.
3. Register the subject in `src/subjects/registry.ts`.

Every section works for any subject. Sections without content are hidden automatically: no quiz, cases, glossary, key facts, section finder or PDFs means no corresponding section.

```jsonc
{
  "units":  [{ "id": "u1", "short": "Part One", "name": "…", "hours": 0 }],
  "slides": [{ "id": "s1-1-1", "u": 0, "part": "1.1 Topic", "title": "One idea", "html": "<p class=\"lead\">The big idea…</p>…", "plain": "…", "practice": false }],
  "cases":  [{ "u": "u1", "part": "1.1 Topic", "slide": "s1-1-1", "name": "A v. B, citation", "h": "What was held", "plain": "…" }],
  "quiz":   [{ "id": "u1-q01", "u": "u1", "concept": "…", "slide": "s1-1-1", "q": "…", "ok": "…", "no": ["…", "…", "…"], "why": "…" }],
  "cards":  [{ "id": "u1-k01", "u": "u1", "k": "concept", "f": "…", "b": "…" }],
  "glossary": [{ "term": "…", "def": "…", "slide": "s1-1-1" }],
  "about": "<p>How to use these notes</p>",
  "appA": "",
  "appB": "<ol class=\"pts\"><li><strong>Label:</strong> key fact</li></ol>",
  "lab": { "compare": [], "sort": [], "timeline": [], "mnemonics": [], "formulas": [], "flows": [] }
}
```

`slides[].u` is the unit's position (0 for the first unit). Everything else refers to units by id.

**Slide HTML.** Every slide starts with `<p class="lead">`, its big idea. After that, a slide may use:
- `<ol class="pts">` (points) and `<ol class="steps">` (a process)
- `<table class="cmp">` (comparison)
- `<div class="formula">` and `<div class="example">`
- `<div class="case">` (with an optional `<dl class="brief">`)
- `<div class="clause">` (a provision)
- `<aside class="focus">` (exam tip) and `<aside class="update">` (law update)
- `<div class="remember">` (memory hook)
- `<div class="grid">` tiles and `<dl class="terms">`

**Memory Lab formulas** use variables, `+ - * / ^`, parentheses and min/max/abs/round/sqrt/ln/exp. Each one carries the notes' own worked example, which the calculator reproduces.

## Question style

Quiz questions and flashcards test **concepts**: understanding, application and the ability to tell ideas apart. They do not test recall of section numbers, case names, citations, years or figures.
- Prefer scenarios, distinctions, the reason behind a rule, and spotting flawed reasoning. When a figure is needed, the question gives it.
- Each question has exactly one defensible answer and three plausible distractors of similar length.
- The explanation says why the answer is right and why the tempting wrong answer fails.
- Every question names its `concept` and links to the slide that teaches it.

Questions are written against the notes and then independently reviewed in the role of a professor and practising lawyer in the subject.

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

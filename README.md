# Study Notes

End-term notes in syllabus order, with quiz questions for revision. Plain black and white.

**Live site:** https://surendra-mundvadiya.github.io/end-sem/

| Subject | Notes | Quiz |
|---|---|---|
| IPR Management | 3 parts, 46 topics | 207 questions with explanations |
| IT Law | 4 parts, 34 topics | 204 questions with explanations |
| Legal Regulation in Life Sciences | 5 parts, 31 topics | — |

The quiz questions test concepts, not recall of section numbers. Each has one best answer and an explanation, and links to the notes that teach it. "Read all questions with answers" lists the whole bank for revision.

## Structure

```
src/
  content/ipr.json, itlaw.json, lrls.json   Notes (units, slides) and quiz questions
  subjects.ts                               Subject list and topic grouping
  pages/                                    Home, Contents, Topic (notes), Quiz
  styles.css                                Black-and-white styles
.github/workflows/deploy.yml                Deploys to GitHub Pages on every push to main
```

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173/end-sem/
npm run build
```

On networks that inspect TLS traffic, run `NODE_OPTIONS=--use-system-ca npm install`.

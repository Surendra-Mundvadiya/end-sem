import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const NOT_MATERIALS = new Set(['node_modules', 'dist', 'src', 'public', 'scripts'])

/** Top-level folders holding a subject's PDFs (tax/, and any added later). */
function materialDirs(): string[] {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !NOT_MATERIALS.has(d.name))
    .map((d) => d.name)
    .filter((dir) => fs.readdirSync(path.join(ROOT, dir)).some((f) => f.toLowerCase().endsWith('.pdf')))
}

// The PDFs stay in their subject folders (not public/), so serve them in dev and copy them into dist/ on build.
function studyMaterials(): Plugin {
  return {
    name: 'study-materials',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/([^/?#]+)\/([^/?#]+\.pdf)(?:[?#].*)?$/i)
        if (!m || !materialDirs().includes(m[1])) return next()
        let name: string
        try {
          name = path.basename(decodeURIComponent(m[2]))
        } catch {
          return next()
        }
        const file = path.join(ROOT, m[1], name)
        if (!fs.existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/pdf')
        fs.createReadStream(file).pipe(res)
      })
    },
    writeBundle(options) {
      const outDir = options.dir ?? path.join(ROOT, 'dist')
      for (const dir of materialDirs()) {
        const out = path.join(outDir, dir)
        fs.mkdirSync(out, { recursive: true })
        for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.toLowerCase().endsWith('.pdf'))) {
          fs.copyFileSync(path.join(ROOT, dir, f), path.join(out, f))
        }
      }
    },
  }
}

export default defineConfig({
  base: '/end-sem/',
  build: {
    // Content loads with top-level await (src/data/index.ts).
    target: 'es2022',
    // One shared vendor chunk instead of dozens of tiny per-icon chunks.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] } } },
  },
  plugins: [react(), studyMaterials()],
})

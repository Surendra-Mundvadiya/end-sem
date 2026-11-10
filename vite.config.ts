import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/end-sem/',
  plugins: [react()],
  // Each subject's notes are one JSON chunk, loaded when the subject is opened.
  build: { chunkSizeWarningLimit: 1000 },
})

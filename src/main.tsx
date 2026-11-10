import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Global styles first, so feature stylesheets (imported through App) win ties.
import './styles/tokens.css'
import './styles/global.css'
import './styles/notes-blocks.css'
import App from './App'
import { SUBJECT } from './data'
import { normalizeHash, watchSubjectChanges } from './subjects/registry'

normalizeHash(SUBJECT)
watchSubjectChanges(SUBJECT)
document.title = `${SUBJECT.title} · Study Kit`

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

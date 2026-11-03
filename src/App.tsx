import { Suspense, lazy, useEffect } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './components/AppShell'
import ErrorBoundary from './components/ErrorBoundary'
import { SUBJECT } from './data'
import { easeOut } from './lib/motion'
import HomePage from './pages/HomePage'

// Each section is its own chunk; Home and the shell load first.
const sections = {
  learn: () => import('./features/learn/LearnPage'),
  flashcards: () => import('./features/flashcards/FlashcardsPage'),
  quiz: () => import('./features/quiz/QuizPage'),
  cases: () => import('./features/cases/CasesPage'),
  lab: () => import('./features/lab/LabPage'),
  revise: () => import('./features/revise/RevisePage'),
  tutor: () => import('./features/tutor/TutorPage'),
  reference: () => import('./features/reference/ReferencePage'),
}

const LearnPage = lazy(sections.learn)
const FlashcardsPage = lazy(sections.flashcards)
const QuizPage = lazy(sections.quiz)
const CasesPage = lazy(sections.cases)
const LabPage = lazy(sections.lab)
const RevisePage = lazy(sections.revise)
const TutorPage = lazy(sections.tutor)
const ReferencePage = lazy(sections.reference)

/** Fetch the other sections in the background once the first screen is up, so navigation stays instant. */
function usePrefetchSections() {
  useEffect(() => {
    const run = () => Object.values(sections).forEach((load) => void load().catch(() => {}))
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback
    if (idle) idle(run)
    else window.setTimeout(run, 1500)
  }, [])
}

function AnimatedRoutes() {
  const location = useLocation()
  // Animate between sections only; moving within a section (e.g. slide to slide) is animated by the feature itself.
  const section = location.pathname.split('/')[1] || 'home'
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
      <motion.div
        key={section}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.26, ease: easeOut }}
      >
        <ErrorBoundary>
        <Suspense fallback={<div className="route-loading" aria-label="Loading" />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/learn/:slideId" element={<LearnPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/cases" element={<CasesPage />} />
            <Route path="/lab" element={SUBJECT.hasLab ? <LabPage /> : <Navigate to="/" replace />} />
            <Route path="/lab/:toolId" element={SUBJECT.hasLab ? <LabPage /> : <Navigate to="/" replace />} />
            <Route path="/revise" element={<RevisePage />} />
            <Route path="/revise/:unitId" element={<RevisePage />} />
            <Route path="/tutor" element={<TutorPage />} />
            <Route path="/tutor/:slideId" element={<TutorPage />} />
            <Route path="/reference" element={<ReferencePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  usePrefetchSections()
  return (
    <MotionConfig reducedMotion="user">
      {/* Every route lives under its subject: #/tax/learn/s7 */}
      <HashRouter basename={`/${SUBJECT.id}`}>
        <AppShell>
          <AnimatedRoutes />
        </AppShell>
      </HashRouter>
    </MotionConfig>
  )
}

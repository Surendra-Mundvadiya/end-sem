import { useEffect } from 'react'
import { HashRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { SUBJECTS } from './subjects'
import Contents from './pages/Contents'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import TopicPage from './pages/Topic'

function Header() {
  const { pathname } = useLocation()
  const id = pathname.split('/')[1]
  const subject = SUBJECTS.find((s) => s.id === id)
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link to="/" className="site-name">
          Study Notes
        </Link>
        {subject && (
          <nav className="subject-nav" aria-label={subject.title}>
            <span className="subject-name">{subject.title}</span>
            <NavLink to={`/${subject.id}`} end>
              Notes
            </NavLink>
            {subject.hasQuiz && <NavLink to={`/${subject.id}/quiz`}>Quiz</NavLink>}
          </nav>
        )}
      </div>
    </header>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

function SubjectRoute({ page }: { page: 'contents' | 'quiz' }) {
  const { subject } = useParams()
  const meta = SUBJECTS.find((s) => s.id === subject)
  if (!meta) return <Navigate to="/" replace />
  if (page === 'quiz' && !meta.hasQuiz) return <Navigate to={`/${meta.id}`} replace />
  return page === 'contents' ? <Contents /> : <Quiz />
}

export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Header />
      <main className="wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:subject" element={<SubjectRoute page="contents" />} />
          <Route path="/:subject/notes/:topic" element={<TopicPage />} />
          <Route path="/:subject/quiz" element={<SubjectRoute page="quiz" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </HashRouter>
  )
}

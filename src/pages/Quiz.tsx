import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { topicKey, type Question } from '../subjects'
import { useSubject } from '../useSubject'

interface Item {
  q: Question
  options: string[]
  picked: number | null
}

function shuffle<T>(items: readonly T[]): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const LETTERS = ['A', 'B', 'C', 'D']

export default function Quiz() {
  const { subject: id } = useParams()
  const data = useSubject(id)
  const [unit, setUnit] = useState('all')
  const [count, setCount] = useState(20)
  const [phase, setPhase] = useState<'setup' | 'run' | 'done' | 'read'>('setup')
  const [items, setItems] = useState<Item[]>([])
  const [index, setIndex] = useState(0)

  const current = items[index]

  useEffect(() => {
    if (phase !== 'run') return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).tagName === 'SELECT') return
      const n = Number(e.key)
      if (current && current.picked === null && n >= 1 && n <= current.options.length) pick(n - 1)
      else if (current && current.picked !== null && e.key === 'Enter') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!data) return <p className="muted">Loading…</p>
  const { subject, content } = data
  const pool = content.quiz.filter((q) => unit === 'all' || q.u === unit)
  const unitName = (u: string) => content.units.find((x) => x.id === u)?.short ?? ''
  const notesLink = (q: Question) => `/${subject.id}/notes/${topicKey(q.slide)}`

  function start() {
    const chosen = shuffle(pool).slice(0, count > 0 ? count : pool.length)
    setItems(chosen.map((q) => ({ q, options: shuffle([q.ok, ...q.no]), picked: null })))
    setIndex(0)
    setPhase('run')
  }

  function pick(i: number) {
    setItems((all) => all.map((it, k) => (k === index ? { ...it, picked: i } : it)))
  }

  function next() {
    if (index + 1 < items.length) setIndex(index + 1)
    else setPhase('done')
  }

  if (phase === 'setup') {
    return (
      <>
        <h1>{subject.title}: quiz</h1>
        <p className="muted">Concept questions on the notes. Each answer comes with an explanation.</p>
        <div className="form">
          <label>
            Unit{' '}
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="all">All units ({content.quiz.length})</option>
              {content.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.short}: {u.name} ({content.quiz.filter((q) => q.u === u.id).length})
                </option>
              ))}
            </select>
          </label>
          <label>
            Questions{' '}
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={0}>All</option>
            </select>
          </label>
        </div>
        <p className="actions">
          <button type="button" className="primary" onClick={start} disabled={!pool.length}>
            Start quiz
          </button>
          <button type="button" onClick={() => setPhase('read')} disabled={!pool.length}>
            Read all questions with answers
          </button>
        </p>
      </>
    )
  }

  if (phase === 'read') {
    return (
      <>
        <h1>{subject.title}: questions and answers</h1>
        <p className="actions">
          <button type="button" onClick={() => setPhase('setup')}>
            ← Back
          </button>
        </p>
        <ol className="qa-list">
          {pool.map((q) => (
            <li key={q.id}>
              <p className="meta">
                {unitName(q.u)} · {q.concept}
              </p>
              <p className="question">{q.q}</p>
              <p>
                <strong>Answer:</strong> {q.ok}
              </p>
              <p className="explanation">{q.why}</p>
              <p className="meta">
                <Link to={notesLink(q)}>Read the notes</Link>
              </p>
            </li>
          ))}
        </ol>
      </>
    )
  }

  if (phase === 'done') {
    const answeredItems = items.filter((it) => it.picked !== null)
    const right = answeredItems.filter((it) => it.options[it.picked as number] === it.q.ok)
    const missed = answeredItems.filter((it) => it.options[it.picked as number] !== it.q.ok)
    return (
      <>
        <h1>
          Score: {right.length} / {answeredItems.length}
        </h1>
        <p className="actions">
          <button type="button" className="primary" onClick={start}>
            New quiz
          </button>
          <button type="button" onClick={() => setPhase('setup')}>
            Change settings
          </button>
        </p>
        {missed.length > 0 && <h2>Review the ones you missed</h2>}
        <ol className="qa-list">
          {missed.map((it) => (
            <li key={it.q.id}>
              <p className="question">{it.q.q}</p>
              <p>Your answer: {it.picked === null ? '(none)' : it.options[it.picked]}</p>
              <p>
                <strong>Correct answer:</strong> {it.q.ok}
              </p>
              <p className="explanation">{it.q.why}</p>
              <p className="meta">
                <Link to={notesLink(it.q)}>Read the notes</Link>
              </p>
            </li>
          ))}
        </ol>
      </>
    )
  }

  const answered = current.picked !== null
  const correctIndex = current.options.indexOf(current.q.ok)
  return (
    <>
      <p className="meta">
        Question {index + 1} of {items.length} · {unitName(current.q.u)}
      </p>
      <h1 className="question">{current.q.q}</h1>
      <ol className="options">
        {current.options.map((o, i) => {
          const state = !answered ? '' : i === correctIndex ? 'correct' : i === current.picked ? 'wrong' : ''
          return (
            <li key={i}>
              <button type="button" className={`option ${state}`} onClick={() => !answered && pick(i)} disabled={answered && !state}>
                <span className="letter">{LETTERS[i]}</span> {o}
                {state === 'correct' && <span className="mark"> ✓ Correct</span>}
                {state === 'wrong' && <span className="mark"> ✗ Your answer</span>}
              </button>
            </li>
          )
        })}
      </ol>
      {answered && (
        <div className="feedback" aria-live="polite">
          <p>
            <strong>{current.picked === correctIndex ? 'Correct.' : 'Not quite.'}</strong> {current.q.why}
          </p>
          <p className="meta">
            Concept: {current.q.concept} · <Link to={notesLink(current.q)}>Read the notes</Link>
          </p>
        </div>
      )}
      <p className="actions">
        {answered && (
          <button type="button" className="primary" onClick={next}>
            {index + 1 < items.length ? 'Next question' : 'See score'}
          </button>
        )}
        <button type="button" onClick={() => setPhase('done')}>
          End quiz
        </button>
      </p>
    </>
  )
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Check, Eye, EyeOff, Play, RotateCcw, Target, X, type LucideIcon } from 'lucide-react'
import type { CompareTool as CompareData } from '../../../data'
import { easeOut, pop } from '../../../lib/motion'
import { shuffle } from '../../../lib/text'
import { celebrate } from '../../flashcards/confetti'
import { useHotkeys } from '../../quiz/useHotkeys'
import { Rich, pct, plainText, useWidth } from '../util'
import './compare.css'

/*
 * Comparison matrix in three modes: Study (everything visible), Test (cells hidden; reveal by cell, row or column)
 * and Quiz (one cell at a time, pick its text from four taken from the same column).
 */

type Mode = 'study' | 'test' | 'quiz'

const MODES: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'test', label: 'Test', icon: EyeOff },
  { id: 'quiz', label: 'Quiz', icon: Target },
]

interface Row {
  label: string
  cells: string[]
}

interface Question {
  r: number
  c: number
  options: string[]
  answer: number
}

const key = (r: number, c: number) => `${r}:${c}`
const norm = (s: string) => plainText(s).toLowerCase().replace(/\s+/g, ' ').trim()

function buildQuiz(rows: Row[], cols: number): Question[] {
  const qs: Question[] = []
  for (let c = 0; c < cols; c++) {
    // Distinct, non-empty values in this column.
    const values: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const v = row.cells[c]
      const n = norm(v)
      if (!n || seen.has(n)) continue
      seen.add(n)
      values.push(v)
    }
    if (values.length < 2) continue
    rows.forEach((row, r) => {
      const right = row.cells[c]
      if (!norm(right)) return
      const wrong = shuffle(values.filter((v) => norm(v) !== norm(right))).slice(0, 3)
      const options = shuffle([right, ...wrong])
      qs.push({ r, c, options, answer: options.indexOf(right) })
    })
  }
  return shuffle(qs)
}

export default function CompareTool({ tool }: { tool: CompareData }) {
  const { rowHead, heads, rows } = useMemo(() => {
    const columns = tool.columns ?? []
    const heads = columns.slice(1)
    // Ragged rows are padded (or cut) to the column count.
    const rows: Row[] = (tool.rows ?? []).map((r) => ({
      label: r.label ?? '',
      cells: heads.map((_, i) => r.cells?.[i] ?? ''),
    }))
    return { rowHead: columns[0] ?? '', heads, rows }
  }, [tool])

  const [mode, setMode] = useState<Mode>('study')
  const [ref, width] = useWidth<HTMLDivElement>()
  // A real table when there's room for every column, one card per row otherwise.
  const asTable = width === 0 ? true : width >= Math.max(600, (heads.length + 1) * 160)

  if (!heads.length || !rows.length) {
    return <p className="lab-empty">This comparison has no rows yet.</p>
  }

  const quizCount = buildQuizCount(rows, heads.length)

  return (
    <div className="lab-cmp" ref={ref}>
      <div className="lab-bar">
        <div className="segmented lab-seg" role="group" aria-label="Mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              disabled={m.id === 'quiz' && quizCount === 0}
              title={m.id === 'quiz' && quizCount === 0 ? 'Needs at least two different answers in a column' : undefined}
            >
              <m.icon size={14} aria-hidden="true" /> {m.label}
            </button>
          ))}
        </div>
        <span className="lab-cmp__size">
          {rows.length} × {heads.length}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: easeOut }}
        >
          {mode === 'study' && <StudyView rowHead={rowHead} heads={heads} rows={rows} asTable={asTable} />}
          {mode === 'test' && <TestView rowHead={rowHead} heads={heads} rows={rows} asTable={asTable} />}
          {mode === 'quiz' && <QuizView rowHead={rowHead} heads={heads} rows={rows} asTable={asTable} onStudy={() => setMode('study')} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function buildQuizCount(rows: Row[], cols: number): number {
  let n = 0
  for (let c = 0; c < cols; c++) {
    const distinct = new Set(rows.map((r) => norm(r.cells[c])).filter(Boolean))
    if (distinct.size >= 2) n += rows.filter((r) => norm(r.cells[c])).length
  }
  return n
}

interface MatrixProps {
  rowHead: string
  heads: string[]
  rows: Row[]
  asTable: boolean
  /** Renders one cell; defaults to its text. */
  cell?: (r: number, c: number) => ReactNode
  /** Extra content in a column header (e.g. a reveal button). */
  headExtra?: (c: number) => ReactNode
  /** Extra content beside a row label. */
  rowExtra?: (r: number) => ReactNode
  cellClass?: (r: number, c: number) => string | undefined
}

/** The matrix as a table (wide) or a stack of row cards (narrow), with the same cell renderer. */
function Matrix({ rowHead, heads, rows, asTable, cell, headExtra, rowExtra, cellClass }: MatrixProps) {
  const render = cell ?? ((r: number, c: number) => <Rich text={rows[r].cells[c]} />)
  if (asTable) {
    return (
      <div className="lab-cmp__scroll">
        <table className="lab-cmp__table">
          <thead>
            <tr>
              <th scope="col" className="lab-cmp__corner">
                <Rich text={rowHead} />
              </th>
              {heads.map((h, c) => (
                <th key={c} scope="col">
                  <span className="lab-cmp__head">
                    <Rich text={h} />
                    {headExtra?.(c)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
            {rows.map((row, r) => (
              <motion.tr key={r} variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } } }}>
                <th scope="row">
                  <span className="lab-cmp__rowlabel">
                    <Rich text={row.label} />
                    {rowExtra?.(r)}
                  </span>
                </th>
                {heads.map((_, c) => (
                  <td key={c} className={cellClass?.(r, c)}>
                    {render(r, c)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    )
  }
  return (
    <motion.ul className="lab-cmp__cards" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}>
      {rows.map((row, r) => (
        <motion.li key={r} className="lab-cmp__card" variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOut } } }}>
          <div className="lab-cmp__card-head">
            <span className="lab-cmp__card-kicker">
              <Rich text={rowHead} />
            </span>
            <span className="lab-cmp__rowlabel">
              <Rich text={row.label} as="span" className="lab-cmp__card-title" />
              {rowExtra?.(r)}
            </span>
          </div>
          <dl className="lab-cmp__dl">
            {heads.map((h, c) => (
              <div key={c} className={`lab-cmp__pair ${cellClass?.(r, c) ?? ''}`}>
                <dt>
                  <Rich text={h} />
                </dt>
                <dd>{render(r, c)}</dd>
              </div>
            ))}
          </dl>
        </motion.li>
      ))}
    </motion.ul>
  )
}

function StudyView(props: Omit<MatrixProps, 'cell'>) {
  return <Matrix {...props} />
}

/* ---------- Test: hide and reveal ---------- */

function TestView({ rowHead, heads, rows, asTable }: Omit<MatrixProps, 'cell'>) {
  const [shown, setShown] = useState<Set<string>>(() => new Set())
  const total = rows.length * heads.length
  const all = () => new Set(rows.flatMap((_, r) => heads.map((__, c) => key(r, c))))

  const toggle = (keys: string[], on: boolean) =>
    setShown((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (on) next.add(k)
        else next.delete(k)
      }
      return next
    })
  const rowKeys = (r: number) => heads.map((_, c) => key(r, c))
  const colKeys = (c: number) => rows.map((_, r) => key(r, c))
  const isAll = (keys: string[]) => keys.every((k) => shown.has(k))

  const plainHead = (c: number) => plainText(heads[c])
  const plainRow = (r: number) => plainText(rows[r].label)

  return (
    <>
      <div className="lab-bar lab-cmp__testbar">
        <div className="lab-score" aria-live="polite">
          <span>
            {shown.size} of {total} revealed
          </span>
          <span className="bar lab-score__bar" aria-hidden="true">
            <span style={{ width: `${pct(shown.size, total)}%` }} />
          </span>
        </div>
        <div className="lab-bar__group">
          <button type="button" className="btn btn-sm" onClick={() => setShown(all())} disabled={shown.size === total}>
            <Eye size={15} aria-hidden="true" /> Reveal all
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setShown(new Set())} disabled={shown.size === 0}>
            <EyeOff size={15} aria-hidden="true" /> Hide all
          </button>
        </div>
      </div>

      {!asTable && (
        <div className="lab-cmp__colchips" role="group" aria-label="Reveal a column">
          <span className="lab-cmp__colchips-label">Columns</span>
          {heads.map((h, c) => {
            const on = isAll(colKeys(c))
            return (
              <button key={c} type="button" className="chip" aria-pressed={on} onClick={() => toggle(colKeys(c), !on)}>
                {on ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                {plainHead(c)}
              </button>
            )
          })}
        </div>
      )}

      <Matrix
        rowHead={rowHead}
        heads={heads}
        rows={rows}
        asTable={asTable}
        cellClass={(r, c) => (shown.has(key(r, c)) ? 'is-shown' : 'is-hidden')}
        headExtra={(c) => {
          const on = isAll(colKeys(c))
          return (
            <button
              type="button"
              className="lab-cmp__mini"
              aria-pressed={on}
              aria-label={`${on ? 'Hide' : 'Reveal'} column ${plainHead(c)}`}
              title={on ? 'Hide column' : 'Reveal column'}
              onClick={() => toggle(colKeys(c), !on)}
            >
              {on ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            </button>
          )
        }}
        rowExtra={(r) => {
          const on = isAll(rowKeys(r))
          return (
            <button
              type="button"
              className="lab-cmp__mini"
              aria-pressed={on}
              aria-label={`${on ? 'Hide' : 'Reveal'} row ${plainRow(r)}`}
              title={on ? 'Hide row' : 'Reveal row'}
              onClick={() => toggle(rowKeys(r), !on)}
            >
              {on ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            </button>
          )
        }}
        cell={(r, c) => {
          const k = key(r, c)
          const on = shown.has(k)
          return (
            <button
              type="button"
              className="lab-cmp__reveal"
              aria-expanded={on}
              aria-label={on ? undefined : `Reveal ${plainRow(r)}, ${plainHead(c)}`}
              onClick={() => toggle([k], !on)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {on ? (
                  <motion.span key="on" className="lab-cmp__text" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <Rich text={rows[r].cells[c]} />
                  </motion.span>
                ) : (
                  <motion.span key="off" className="lab-cmp__mask" aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                    <span />
                    <span />
                    <Eye size={14} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        }}
      />
      <p className="lab-hint">Say each answer out loud before you reveal it.</p>
    </>
  )
}

/* ---------- Quiz: one cell at a time ---------- */

function QuizView({ rowHead, heads, rows, asTable, onStudy }: Omit<MatrixProps, 'cell'> & { onStudy: () => void }) {
  const [qs, setQs] = useState<Question[]>(() => buildQuiz(rows, heads.length))
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const focusOptions = useRef(false)

  // After "Next cell", focus moves to the first option of the new cell (the Next button is disabled again).
  useEffect(() => {
    if (!focusOptions.current) return
    focusOptions.current = false
    optionsRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [i])

  const done = i >= qs.length
  const q = qs[i]
  const answered = picked !== null

  const pick = (n: number) => {
    if (!q || answered || n < 0 || n >= q.options.length) return
    setPicked(n)
    const ok = n === q.answer
    const newRight = right + (ok ? 1 : 0)
    if (ok) setRight(newRight)
    if (i === qs.length - 1 && newRight === qs.length) celebrate(1)
    window.setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 30)
  }
  const next = () => {
    focusOptions.current = true
    setPicked(null)
    setI((n) => n + 1)
  }
  const restart = () => {
    setQs(buildQuiz(rows, heads.length))
    setI(0)
    setPicked(null)
    setRight(0)
  }

  useHotkeys((e) => {
    if (done || !q) return
    const n = Number(e.key)
    if (!answered && Number.isInteger(n) && n >= 1 && n <= q.options.length) {
      e.preventDefault()
      pick(n - 1)
    }
  })

  if (done) {
    const p = pct(right, qs.length)
    return (
      <motion.div className="lab-done" variants={pop} initial="hidden" animate="show" role="status">
        <div className="lab-done__text">
          <div className="lab-done__title">{p === 100 ? 'Every cell, perfect.' : p >= 70 ? 'Strong recall.' : 'Worth another round.'}</div>
          <p className="lab-done__sub">
            {right} of {qs.length} cells right · <span className="lab-done__pct">{p}%</span>
          </p>
        </div>
        <div className="lab-done__actions">
          <button type="button" className="btn btn-unit" onClick={restart}>
            <RotateCcw size={16} aria-hidden="true" /> Play again
          </button>
          <button type="button" className="btn" onClick={onStudy}>
            <BookOpen size={16} aria-hidden="true" /> Study the matrix
          </button>
        </div>
      </motion.div>
    )
  }

  const correctText = q.options[q.answer]
  const ok = picked === q.answer

  return (
    <div className="lab-cmp__quiz">
      <div className="lab-bar">
        <div className="lab-score">
          <span>
            Cell {i + 1} of {qs.length}
          </span>
          <span className="bar lab-score__bar" aria-hidden="true">
            <span style={{ width: `${pct(i + (answered ? 1 : 0), qs.length)}%` }} />
          </span>
          <span className="lab-score__ok">
            <Check size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} /> {right}
          </span>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={restart}>
          <RotateCcw size={15} aria-hidden="true" /> Restart
        </button>
      </div>

      <Matrix
        rowHead={rowHead}
        heads={heads}
        rows={rows}
        asTable={asTable}
        cellClass={(r, c) => (r === q.r && c === q.c ? `is-target${answered ? (ok ? ' is-ok' : ' is-bad') : ''}` : c === q.c ? 'is-masked' : undefined)}
        cell={(r, c) => {
          if (r === q.r && c === q.c) {
            return answered ? (
              <motion.span className="lab-cmp__text" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
                <Rich text={rows[r].cells[c]} />
              </motion.span>
            ) : (
              <span className="lab-cmp__blank">
                <span aria-hidden="true">?</span>
                <span className="sr-only">The blank to fill</span>
              </span>
            )
          }
          if (c === q.c) {
            return (
              <span className="lab-cmp__mask lab-cmp__mask--static">
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span className="sr-only">Hidden</span>
              </span>
            )
          }
          return <Rich text={rows[r].cells[c]} />
        }}
      />

      <div className="lab-cmp__ask" style={{ marginTop: 18 }}>
        <p className="lab-cmp__prompt" id="lab-cmp-prompt">
          <span className="lab-cmp__prompt-row">
            <Rich text={rows[q.r].label} />
          </span>
          <span className="lab-cmp__prompt-sep" aria-hidden="true">
            ·
          </span>
          <span className="lab-cmp__prompt-col">
            <Rich text={heads[q.c]} />
          </span>
          <span className="sr-only">: which fits the blank?</span>
        </p>
        <div ref={optionsRef} className="lab-cmp__options" role="group" aria-labelledby="lab-cmp-prompt">
          {q.options.map((o, n) => {
            const state = !answered ? '' : n === q.answer ? ' is-ok' : n === picked ? ' is-bad' : ' is-dim'
            return (
              <motion.button
                key={`${i}-${n}`}
                type="button"
                className={`lab-cmp__option${state}`}
                onClick={() => pick(n)}
                aria-disabled={answered || undefined}
                initial={{ opacity: 0, y: 8 }}
                animate={answered && n === picked && n !== q.answer ? { opacity: 1, y: 0, x: [0, -6, 6, -3, 0] } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: answered ? 0 : n * 0.04 }}
              >
                <span className="kbd" aria-hidden="true">
                  {n + 1}
                </span>
                <Rich text={o} className="lab-cmp__option-text" />
                {answered && n === q.answer && <Check size={16} aria-hidden="true" className="lab-cmp__option-mark" />}
                {answered && n === picked && n !== q.answer && <X size={16} aria-hidden="true" className="lab-cmp__option-mark" />}
              </motion.button>
            )
          })}
        </div>

        <div aria-live="polite" className="lab-cmp__live">
          {answered && (
            <motion.div className={`lab-feedback ${ok ? 'lab-feedback--ok' : 'lab-feedback--bad'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: easeOut }}>
              {ok ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
              <span>
                <span className="lab-feedback__title">{ok ? 'Right.' : 'Not quite.'}</span>
                {!ok && (
                  <span className="lab-feedback__why">
                    {plainText(rows[q.r].label)} · {plainText(heads[q.c])}: <Rich text={correctText} />
                  </span>
                )}
              </span>
            </motion.div>
          )}
        </div>

        <div className="lab-cmp__next">
          <button ref={nextRef} type="button" className="btn btn-unit" onClick={next} disabled={!answered}>
            {i === qs.length - 1 ? 'See score' : 'Next cell'} <Play size={14} aria-hidden="true" />
          </button>
        </div>
        <p className="lab-hint lab-hint--keys">
          Press <span className="kbd">1</span>–<span className="kbd">{q.options.length}</span> to answer, <span className="kbd">Enter</span> for the next cell.
        </p>
      </div>
    </div>
  )
}

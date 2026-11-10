import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, CircleX, Info, ListTree, Route, RotateCcw } from 'lucide-react'
import { unitVars, type FlowNode, type FlowTool as FlowToolData } from '../../../data'
import { easeOut } from '../../../lib/motion'
import './FlowTool.css'

/*
 * A decision tree from the notes, walked one question at a time, with the answers so far as a
 * breadcrumb, a result coloured by its tone, and an outline of the whole tree.
 */

type Tone = 'good' | 'bad' | 'neutral'

/** Problems that would stop the walk: a missing start, a dangling `next`, or a node with neither question nor result. */
function problemsOf(tool: FlowToolData): string[] {
  const nodes = tool.nodes ?? {}
  const out: string[] = []
  if (!nodes[tool.start]) out.push(`the start node "${tool.start}" does not exist`)
  for (const [id, n] of Object.entries(nodes)) {
    const isQuestion = !!n.q && Array.isArray(n.options) && n.options.length > 0
    if (!isQuestion && !n.result) out.push(`node "${id}" has neither a question with options nor a result`)
    for (const o of n.options ?? []) if (!nodes[o.next]) out.push(`node "${id}" points to "${o.next}", which does not exist`)
  }
  return out
}

const isLeaf = (n: FlowNode) => !(n.q && n.options?.length)

function toneOf(n: FlowNode): Tone {
  return n.tone === 'good' || n.tone === 'bad' ? n.tone : 'neutral'
}

function ToneIcon({ tone, size = 20 }: { tone: Tone; size?: number }) {
  if (tone === 'good') return <CircleCheck size={size} aria-hidden="true" />
  if (tone === 'bad') return <CircleX size={size} aria-hidden="true" />
  return <Info size={size} aria-hidden="true" />
}

/** Keyed on the tool, so moving to another tree starts at its first question. */
export default function FlowTool({ tool }: { tool: FlowToolData }) {
  return <Flow key={tool.id} tool={tool} />
}

function Flow({ tool }: { tool: FlowToolData }) {
  const problems = useMemo(() => problemsOf(tool), [tool])
  const [view, setView] = useState<'walk' | 'tree'>('walk')
  /** Node ids visited, from the start; `answers[k]` is the option chosen at `steps[k]`. */
  const [steps, setSteps] = useState<string[]>([tool.start])
  const [answers, setAnswers] = useState<number[]>([])
  const [dir, setDir] = useState<1 | -1>(1)
  const moved = useRef(false)
  const reduce = useReducedMotion()
  const baseId = useId()
  const style = tool.unitId ? unitVars(tool.unitId) : undefined

  // After every move, focus the new question or result as it mounts, so keyboard and screen-reader users
  // follow. (An effect would run before AnimatePresence mode="wait" mounts the new card.)
  const focusOnMount = useCallback((el: HTMLHeadingElement | null) => {
    if (el && moved.current) el.focus({ preventScroll: true })
  }, [])

  if (problems.length) {
    return (
      <div className="flw" style={style}>
        <div className="flw-card flw-problem" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <div>
            <p className="flw-problem__title">This decision tree cannot be shown.</p>
            <ul>
              {problems.slice(0, 5).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const nodes = tool.nodes
  const currentId = steps[steps.length - 1]
  const current = nodes[currentId]
  const leaf = isLeaf(current)
  const questionNo = steps.length

  const choose = (i: number) => {
    const next = current.options?.[i]?.next
    if (!next) return
    moved.current = true
    setDir(1)
    setAnswers((a) => [...a.slice(0, steps.length - 1), i])
    setSteps((s) => [...s, next])
  }
  const goTo = (k: number) => {
    if (k < 0 || k >= steps.length - 1) return
    moved.current = true
    setDir(-1)
    setSteps((s) => s.slice(0, k + 1))
    setAnswers((a) => a.slice(0, k))
  }
  const back = () => goTo(steps.length - 2)
  const restart = () => {
    moved.current = true
    setDir(-1)
    setSteps([tool.start])
    setAnswers([])
  }

  const slide = reduce ? 0 : 36
  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d * slide }),
    show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: easeOut } },
    leave: (d: number) => ({ opacity: 0, x: d * -slide, transition: { duration: 0.18 } }),
  }

  return (
    <div className="flw" style={style}>
      <div className="flw-bar">
        <div className="segmented" role="group" aria-label="View">
          <button
            type="button"
            aria-pressed={view === 'walk'}
            onClick={() => {
              moved.current = true
              setView('walk')
            }}
          >
            <Route size={14} aria-hidden="true" /> Walk through
          </button>
          <button
            type="button"
            aria-pressed={view === 'tree'}
            onClick={() => {
              moved.current = false
              setView('tree')
            }}
          >
            <ListTree size={14} aria-hidden="true" /> See the whole tree
          </button>
        </div>
        {view === 'walk' && (
          <div className="flw-row">
            <button type="button" className="btn btn-sm btn-ghost" onClick={back} disabled={steps.length < 2}>
              <ArrowLeft size={15} aria-hidden="true" /> Back
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={restart} disabled={steps.length < 2}>
              <RotateCcw size={15} aria-hidden="true" /> Start again
            </button>
          </div>
        )}
      </div>

      {view === 'walk' ? (
        <>
          {answers.length > 0 && (
            <nav className="flw-crumbs" aria-label="Your answers so far">
              <ol>
                {answers.map((choice, k) => {
                  const n = nodes[steps[k]]
                  return (
                    <li key={`${k}-${steps[k]}`}>
                      <button type="button" className="flw-crumb" onClick={() => goTo(k)} title="Change this answer">
                        <span className="flw-crumb__q">{n.q}</span>
                        <span className="flw-crumb__a">{n.options?.[choice]?.label}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </nav>
          )}

          <div className="flw-stage">
            <AnimatePresence mode="wait" initial={false} custom={dir}>
              <motion.div key={steps.length} custom={dir} variants={variants} initial="enter" animate="show" exit="leave">
                {leaf ? (
                  <section className="flw-card flw-result" data-tone={toneOf(current)} aria-labelledby={`${baseId}-h`}>
                    <div className="flw-result__icon">
                      <ToneIcon tone={toneOf(current)} size={26} />
                    </div>
                    <div className="flw-result__body">
                      <p className="flw-kicker">Result</p>
                      <h3 id={`${baseId}-h`} ref={focusOnMount} tabIndex={-1} className="flw-result__title">
                        {current.result}
                      </h3>
                      {current.detail && <p className="flw-result__detail">{current.detail}</p>}
                      <div className="flw-row">
                        <button type="button" className="btn btn-unit" onClick={restart}>
                          <RotateCcw size={16} aria-hidden="true" /> Start again
                        </button>
                        {steps.length > 1 && (
                          <button type="button" className="btn" onClick={back}>
                            <ArrowLeft size={16} aria-hidden="true" /> Back
                          </button>
                        )}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="flw-card flw-question" aria-labelledby={`${baseId}-h`}>
                    <p className="flw-kicker">Question {questionNo}</p>
                    <h3 id={`${baseId}-h`} ref={focusOnMount} tabIndex={-1} className="flw-question__q">
                      {current.q}
                    </h3>
                    <div className="flw-options" role="group" aria-label="Answers">
                      {current.options?.map((o, i) => (
                        <motion.button
                          key={`${i}-${o.label}`}
                          type="button"
                          className="flw-option"
                          onClick={() => choose(i)}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="flw-option__key" aria-hidden="true">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flw-option__label">{o.label}</span>
                          <ArrowRight size={17} aria-hidden="true" className="flw-option__go" />
                        </motion.button>
                      ))}
                    </div>
                  </section>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      ) : (
        <TreeOutline tool={tool} onPath={new Set(steps)} />
      )}
    </div>
  )
}

/* ---------- the whole tree ---------- */

function TreeOutline({ tool, onPath }: { tool: FlowToolData; onPath: Set<string> }) {
  // A node met a second time (shared branch or loop) is named, not expanded again.
  const expanded = new Set<string>()

  const render = (id: string, depth: number): ReactNode => {
    const n = tool.nodes[id]
    if (!n) return null
    if (expanded.has(id) || depth > 40) {
      return (
        <p className="flw-tree__ref">
          {isLeaf(n) ? n.result : n.q} <span className="flw-tree__see">(see above)</span>
        </p>
      )
    }
    expanded.add(id)
    if (isLeaf(n)) {
      const tone = toneOf(n)
      return (
        <div className="flw-tree__leaf" data-tone={tone} data-on={onPath.has(id) ? 'true' : undefined}>
          <ToneIcon tone={tone} size={16} />
          <div>
            <p className="flw-tree__result">{n.result}</p>
            {n.detail && <p className="flw-tree__detail">{n.detail}</p>}
          </div>
        </div>
      )
    }
    return (
      <div className="flw-tree__node">
        <p className="flw-tree__q" data-on={onPath.has(id) ? 'true' : undefined}>
          {n.q}
        </p>
        <ul className="flw-tree__branches">
          {n.options?.map((o, i) => (
            <li key={`${i}-${o.label}`}>
              <span className="flw-tree__opt">{o.label}</span>
              {render(o.next, depth + 1)}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <section className="flw-card flw-tree" aria-label="The whole decision tree">
      <p className="flw-kicker">Every path, from the first question</p>
      {render(tool.start, 0)}
    </section>
  )
}

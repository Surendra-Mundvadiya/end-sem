/*
 * Recall mode: post-processes the rendered (trusted) slide HTML so key terms become
 * tap-to-reveal chips and decided cases collapse to their names.
 *
 * The reader remounts the notes element (fresh HTML) whenever recall mode or its options change,
 * so these functions only ever add to clean markup. They are idempotent, because React StrictMode
 * runs layout effects twice on the same DOM.
 */

/** Clause labels such as "(a)", "(ii)" or "(12)" carry nothing to remember. */
const CLAUSE_LABEL = /^\((?:[a-z]{1,2}|[ivx]+|\d+)\)$/i
/** Structural block labels written in <strong> ("Exam focus.", "Law update.", "Remember:" …) stay visible. */
const PLAIN_LABEL =
  /^(?:exam focus|exam tip|illustration|law update|current law update|update|remember|memory hook|worked example|example|key point|note|caution)\s*[.:]?$/i

/**
 * Numbers worth memorising: amounts ("Rs. 7,50,000", "Rs. 10 crore"), percentages ("50%"),
 * and the number part of statutory references ("section 9(11)", "sections 15 to 19", "Chapter VIII").
 * Groups: 1 amount, 2 percentage, 3 reference prefix (kept visible), 4 reference number (hidden).
 */
const NUMBER_RE =
  /((?:Rs\.\s?|₹\s?)\d+(?:,\d+)*(?:\.\d+)?(?:\s(?:lakh|crore))?)|(\b\d+(?:\.\d+)?\s?%)|(\b(?:[Ss]ections?|Articles?|Schedules?|Chapters?)\s)(\d+[A-Z]*(?:\([0-9A-Za-z]+\))*(?:\s(?:to|and)\s\d+[A-Z]*(?:\([0-9A-Za-z]+\))*)?|[IVXL]+\b(?:\s(?:to|and)\s[IVXL]+\b)?)/g

const EYE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/></svg>'

export interface RecallStats {
  total: number
  revealed: number
  /** With numbers off: how many numbers could be hidden (for the empty-state hint). */
  numbers: number
}

export const NO_RECALL: RecallStats = { total: 0, revealed: 0, numbers: 0 }

function numberRanges(text: string): [number, number][] {
  const out: [number, number][] = []
  for (const m of text.matchAll(NUMBER_RE)) {
    const value = m[4] ?? m[1] ?? m[2] ?? m[0]
    const start = (m.index ?? 0) + (m[4] && m[3] ? m[3].length : 0)
    out.push([start, start + value.length])
  }
  return out
}

/** Text nodes that may hold numbers: outside terms, cases and controls we added. */
function numberTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement?.closest('strong, em, .case, .lrn-num, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: Text[] = []
  while (walker.nextNode()) nodes.push(walker.currentNode as Text)
  return nodes
}

function countNumbers(root: HTMLElement): number {
  return numberTextNodes(root).reduce((n, node) => n + numberRanges(node.data).length, 0)
}

function wrapNumbers(root: HTMLElement) {
  for (const node of numberTextNodes(root)) {
    const text = node.data
    const ranges = numberRanges(text)
    if (!ranges.length) continue
    const frag = document.createDocumentFragment()
    let pos = 0
    for (const [a, b] of ranges) {
      if (a > pos) frag.append(text.slice(pos, a))
      const span = document.createElement('span')
      span.className = 'lrn-num'
      span.textContent = text.slice(a, b)
      frag.append(span)
      pos = b
    }
    if (pos < text.length) frag.append(text.slice(pos))
    node.replaceWith(frag)
  }
}

function hideTerm(el: HTMLElement) {
  el.dataset.lrnItem = 'term'
  el.classList.add('lrn-term')
  el.tabIndex = 0
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', 'Hidden term, press to reveal')
}

function hideCase(box: HTMLElement) {
  box.dataset.lrnItem = 'case'
  box.classList.add('lrn-case', 'is-hidden')
  const name = box.querySelector('.cname')
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'lrn-holding-btn'
  btn.setAttribute('aria-expanded', 'false')
  btn.setAttribute('aria-label', `Show holding${name?.textContent ? `: ${name.textContent}` : ''}`)
  btn.innerHTML = `${EYE_SVG}<span>Show holding</span>`
  if (name) name.after(btn)
  else box.prepend(btn)
}

/** Hides the key terms (and optionally numbers) and collapses cases. Returns the resulting stats. */
export function prepareRecall(root: HTMLElement, opts: { numbers: boolean }): RecallStats {
  if (opts.numbers) wrapNumbers(root)

  root.querySelectorAll<HTMLElement>('strong, em, .lrn-num').forEach((el) => {
    if (el.dataset.lrnItem || el.closest('.case')) return
    const text = (el.textContent ?? '').trim()
    if (!text) return
    if (!el.classList.contains('lrn-num') && (CLAUSE_LABEL.test(text) || PLAIN_LABEL.test(text))) return
    hideTerm(el)
  })

  root.querySelectorAll<HTMLElement>('.case').forEach((box) => {
    if (!box.dataset.lrnItem) hideCase(box)
  })

  // Reading-order index drives the staggered "cover" animation in learn.css.
  root.querySelectorAll<HTMLElement>('[data-lrn-item]').forEach((el, i) => el.style.setProperty('--lrn-i', String(i)))

  return readStats(root, opts.numbers)
}

export function readStats(root: HTMLElement, numbersOn: boolean): RecallStats {
  return {
    total: root.querySelectorAll('[data-lrn-item]').length,
    revealed: root.querySelectorAll('[data-lrn-item].is-revealed').length,
    numbers: numbersOn ? 0 : countNumbers(root),
  }
}

/** Reveals one hidden item. Returns a short description for screen readers, or null if it was already shown. */
export function revealItem(item: HTMLElement): string | null {
  if (item.classList.contains('is-revealed')) return null
  item.classList.add('is-revealed')
  if (item.dataset.lrnItem === 'case') {
    item.classList.remove('is-hidden')
    item.tabIndex = -1
    item.querySelector('.lrn-holding-btn')?.setAttribute('aria-expanded', 'true')
    return `Holding shown for ${item.querySelector('.cname')?.textContent ?? 'the case'}`
  }
  // Stay focusable programmatically so a focused term does not drop focus to <body>.
  item.tabIndex = -1
  item.removeAttribute('role')
  item.removeAttribute('aria-label')
  return `Revealed: ${(item.textContent ?? '').trim()}`
}

export function revealAll(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-lrn-item]:not(.is-revealed)').forEach((el) => revealItem(el))
}

/** The next still-hidden item after `from` in reading order. */
export function nextHidden(root: HTMLElement, from: HTMLElement): HTMLElement | null {
  const hidden = Array.from(root.querySelectorAll<HTMLElement>('[data-lrn-item]:not(.is-revealed)'))
  return hidden.find((el) => el !== from && from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) ?? null
}

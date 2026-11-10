/*
 * The subjects in the study kit. To add one:
 *   1. Put its PDFs in a top-level folder named after it (e.g. contract/).
 *   2. Add src/subjects/<id>/content.json in the same format as tax/content.json (see README).
 *   3. Register it below.
 * Every page works for any subject; the Memory Lab tools are subject-specific (hasLab).
 */

export interface SubjectMaterial {
  id: string
  title: string
  subtitle: string
  /** Path from the repo root, e.g. "tax/The Income Tax Act, 2025.pdf". */
  path: string
}

export interface SubjectMeta {
  /** Used in the URL: #/<id>/learn/... */
  id: string
  title: string
  subtitle: string
  description: string
  /** True when the subject has its own Memory Lab tools. */
  hasLab: boolean
  materials: SubjectMaterial[]
  load: () => Promise<unknown>
}

export const SUBJECTS: SubjectMeta[] = [
  {
    id: 'ipr',
    title: 'IPR Management',
    subtitle: 'Intellectual Property Rights Management',
    description: 'Measuring and extracting value, portfolio management, and innovation and IP protection.',
    hasLab: true,
    materials: [],
    load: () => import('./ipr/content.json').then((m) => m.default),
  },
]

const LAST_KEY = 'studykit-subject'

function hashSegment(): string {
  return location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
}

/** The subject named in the URL (#/tax/...), else the last one used, else the first. */
export function resolveSubject(): SubjectMeta {
  let id: string | null = hashSegment()
  if (!SUBJECTS.some((s) => s.id === id)) {
    try {
      id = localStorage.getItem(LAST_KEY)
    } catch {
      id = null
    }
  }
  const subject = SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0]
  try {
    localStorage.setItem(LAST_KEY, subject.id)
  } catch {
    /* ignore */
  }
  return subject
}

/** Make sure the hash starts with the subject id, keeping old-style links (#/learn/s7 → #/tax/learn/s7). */
export function normalizeHash(subject: SubjectMeta) {
  if (hashSegment() === subject.id) return
  const raw = location.hash.replace(/^#/, '') || '/'
  const rest = raw.startsWith('/') ? raw : `/${raw}`
  history.replaceState(null, '', `${location.pathname}${location.search}#/${subject.id}${rest === '/' ? '/' : rest}`)
}

/** Reload the app on another subject. */
export function switchSubject(id: string) {
  try {
    localStorage.setItem(LAST_KEY, id)
  } catch {
    /* ignore */
  }
  location.hash = `#/${id}/`
  location.reload()
}

/** Reload when the hash is changed by hand to a different subject. */
export function watchSubjectChanges(current: SubjectMeta) {
  window.addEventListener('hashchange', () => {
    const seg = hashSegment()
    if (seg !== current.id && SUBJECTS.some((s) => s.id === seg)) location.reload()
  })
}

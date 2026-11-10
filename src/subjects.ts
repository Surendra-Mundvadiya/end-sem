/* The subjects and their content. Each content file holds units, note slides and (optionally) quiz questions. */

export interface Unit {
  id: string
  short: string
  name: string
}

export interface Slide {
  id: string
  /** Index of the unit in `units`. */
  u: number
  /** The topic the slide belongs to. */
  part: string
  title: string
  /** Trusted HTML from the notes. */
  html: string
  practice?: boolean
}

export interface Question {
  id: string
  /** Unit id. */
  u: string
  concept: string
  /** Slide that teaches the concept. */
  slide: string
  q: string
  ok: string
  no: string[]
  why: string
}

export interface Content {
  units: Unit[]
  slides: Slide[]
  quiz: Question[]
}

export interface Topic {
  /** URL key, e.g. "s1-1" or "ch5". */
  key: string
  unit: number
  title: string
  slides: Slide[]
}

export interface Subject {
  id: string
  title: string
  description: string
  /** IPR Management and IT Law have quiz questions; LRLS is notes only. */
  hasQuiz: boolean
  load: () => Promise<Content>
}

export const SUBJECTS: Subject[] = [
  {
    id: 'ipr',
    title: 'IPR Management',
    description: 'Measuring and extracting value, portfolio management, and innovation and IP protection.',
    hasQuiz: true,
    load: () => import('./content/ipr.json').then((m) => m.default as unknown as Content),
  },
  {
    id: 'itlaw',
    title: 'IT Law',
    description: 'The EU GDPR, the DPDP Act 2023 and Rules 2025, and cyber contraventions and crimes under the IT Act 2000.',
    hasQuiz: true,
    load: () => import('./content/itlaw.json').then((m) => m.default as unknown as Content),
  },
  {
    id: 'lrls',
    title: 'Legal Regulation in Life Sciences',
    description: 'Plant varieties and biodiversity law, biopiracy and DSI, genus and species patents, geographical indications, and layout designs.',
    hasQuiz: false,
    load: () => import('./content/lrls.json').then((m) => m.default as unknown as Content),
  },
]

/** "s1-1-3" → "s1-1", "ch5-2" → "ch5". */
export function topicKey(slideId: string): string {
  return slideId.replace(/-\d+$/, '')
}

/** Consecutive slides with the same unit and topic form one topic page. */
export function topicsOf(content: Content): Topic[] {
  const topics: Topic[] = []
  for (const s of content.slides) {
    const last = topics[topics.length - 1]
    if (last && last.unit === s.u && last.title === s.part) last.slides.push(s)
    else topics.push({ key: topicKey(s.id), unit: s.u, title: s.part, slides: [s] })
  }
  return topics
}

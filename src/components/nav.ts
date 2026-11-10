import { BookOpen, FlaskConical, Headphones, House, Layers, Library, ListChecks, Scale, Zap, type LucideIcon } from 'lucide-react'
import { CASES, HAS_QUIZ, SUBJECT } from '../data'

export interface NavItem {
  to: string
  label: string
  hint: string
  icon: LucideIcon
  group: 'study' | 'remember'
}

const ALL_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', hint: 'Your dashboard', icon: House, group: 'study' },
  { to: '/learn', label: 'Notes', hint: 'Read every topic', icon: BookOpen, group: 'study' },
  { to: '/tutor', label: 'Tutor', hint: 'Listen to spoken lessons', icon: Headphones, group: 'study' },
  { to: '/flashcards', label: 'Flashcards', hint: 'Spaced repetition', icon: Layers, group: 'study' },
  { to: '/quiz', label: 'Quiz', hint: 'Test yourself', icon: ListChecks, group: 'study' },
  { to: '/lab', label: 'Memory Lab', hint: 'Visual tools and mnemonics', icon: FlaskConical, group: 'remember' },
  { to: '/cases', label: 'Cases', hint: 'Leading cases and a concept game', icon: Scale, group: 'remember' },
  { to: '/revise', label: 'Rapid revision', hint: 'One-page unit summaries', icon: Zap, group: 'remember' },
  { to: '/reference', label: 'Reference', hint: 'Glossary, key facts and sources', icon: Library, group: 'remember' },
]

/** The sections the current subject has content for. */
export const NAV_ITEMS: NavItem[] = ALL_ITEMS.filter((n) =>
  n.to === '/lab' ? SUBJECT.hasLab : n.to === '/cases' ? CASES.length > 0 : n.to === '/quiz' ? HAS_QUIZ : true,
)

export function isNavActive(pathname: string, to: string): boolean {
  return to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
}

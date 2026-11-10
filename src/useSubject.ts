import { useEffect, useState } from 'react'
import { SUBJECTS, topicsOf, type Content, type Subject, type Topic } from './subjects'

export interface LoadedSubject {
  subject: Subject
  content: Content
  topics: Topic[]
}

const cache = new Map<string, Promise<LoadedSubject>>()

function load(subject: Subject): Promise<LoadedSubject> {
  let p = cache.get(subject.id)
  if (!p) {
    p = subject.load().then((content) => ({ subject, content, topics: topicsOf(content) }))
    cache.set(subject.id, p)
  }
  return p
}

/** Loads a subject's content. `undefined` while loading, `null` for an unknown subject. */
export function useSubject(id: string | undefined): LoadedSubject | null | undefined {
  const subject = SUBJECTS.find((s) => s.id === id)
  const [data, setData] = useState<LoadedSubject | undefined>(undefined)
  useEffect(() => {
    if (!subject) return
    let live = true
    setData(undefined)
    load(subject).then((d) => live && setData(d))
    return () => {
      live = false
    }
  }, [subject])
  if (!subject) return null
  return data && data.subject.id === subject.id ? data : undefined
}

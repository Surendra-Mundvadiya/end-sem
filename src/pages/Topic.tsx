import { Link, Navigate, useParams } from 'react-router-dom'
import { useSubject } from '../useSubject'

export default function TopicPage() {
  const { subject: id, topic: key } = useParams()
  const data = useSubject(id)
  if (data === null) return <Navigate to="/" replace />
  if (!data) return <p className="muted">Loading…</p>
  const { subject, content, topics } = data
  const i = topics.findIndex((t) => t.key === key)
  if (i < 0) return <Navigate to={`/${subject.id}`} replace />
  const topic = topics[i]
  const unit = content.units[topic.unit]
  const prev = topics[i - 1]
  const next = topics[i + 1]
  return (
    <article>
      <p className="crumbs">
        <Link to={`/${subject.id}`}>{subject.title}</Link> · {unit.short}: {unit.name}
      </p>
      <h1>{topic.title}</h1>
      {topic.slides.map((s) => (
        <section key={s.id} className="note-section">
          {!s.practice && topic.slides.length > 1 && <h2>{s.title}</h2>}
          <div className="notes" dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      ))}
      <nav className="pager" aria-label="Topics">
        {prev ? <Link to={`/${subject.id}/notes/${prev.key}`}>← {prev.title}</Link> : <span />}
        <Link to={`/${subject.id}`}>Contents</Link>
        {next ? <Link to={`/${subject.id}/notes/${next.key}`}>{next.title} →</Link> : <span />}
      </nav>
    </article>
  )
}

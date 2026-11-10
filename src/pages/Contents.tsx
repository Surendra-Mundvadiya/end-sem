import { Link, useParams } from 'react-router-dom'
import { useSubject } from '../useSubject'

export default function Contents() {
  const { subject: id } = useParams()
  const data = useSubject(id)
  if (!data) return <p className="muted">Loading…</p>
  const { subject, content, topics } = data
  return (
    <>
      <h1>{subject.title}</h1>
      <p className="muted">{subject.description}</p>
      {subject.hasQuiz && (
        <p>
          <Link to={`/${subject.id}/quiz`}>Practise with {content.quiz.length} quiz questions →</Link>
        </p>
      )}
      {content.units.map((unit, ui) => (
        <section key={unit.id} className="toc-unit">
          <h2>
            {unit.short}: {unit.name}
          </h2>
          <ol className="toc">
            {topics
              .filter((t) => t.unit === ui)
              .map((t) => (
                <li key={t.key}>
                  <Link to={`/${subject.id}/notes/${t.key}`}>{t.title}</Link>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </>
  )
}

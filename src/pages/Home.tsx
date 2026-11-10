import { Link } from 'react-router-dom'
import { SUBJECTS } from '../subjects'

export default function Home() {
  return (
    <>
      <h1>Study Notes</h1>
      <p className="muted">End-term notes, topic by topic, in syllabus order.</p>
      <ul className="subject-list">
        {SUBJECTS.map((s) => (
          <li key={s.id}>
            <h2>
              <Link to={`/${s.id}`}>{s.title}</Link>
            </h2>
            <p>{s.description}</p>
            <p className="links">
              <Link to={`/${s.id}`}>Notes</Link>
              {s.hasQuiz && <Link to={`/${s.id}/quiz`}>Quiz questions</Link>}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}

import { Navigate, useParams } from 'react-router-dom'
import { slideById } from '../../data'
import LessonPicker from './LessonPicker'
import TutorPlayer from './TutorPlayer'
import './tutor.css'

/** /tutor = lesson picker; /tutor/:slideId = the spoken lesson for that slide. */
export default function TutorPage() {
  const { slideId } = useParams()
  if (slideId === undefined) return <LessonPicker />
  const slide = slideById(slideId)
  if (!slide) return <Navigate to="/tutor" replace />
  return <TutorPlayer slide={slide} />
}

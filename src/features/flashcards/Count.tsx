import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { easeOut } from '../../lib/motion'

interface Props {
  value: number
  /** Start value on mount (e.g. 0 for a count-up). Defaults to value, so only later changes animate. */
  from?: number
  className?: string
}

/** A number that eases to each new value. Imperative animate() ignores MotionConfig, so reduced motion is checked here. */
export default function Count({ value, from, className }: Props) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : (from ?? value))
  const text = useTransform(mv, (v) => String(Math.round(v)))

  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: 0.8, ease: easeOut })
    return () => controls.stop()
  }, [mv, value, reduce])

  return <motion.span className={className}>{text}</motion.span>
}

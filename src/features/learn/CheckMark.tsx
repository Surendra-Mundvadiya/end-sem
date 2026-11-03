import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { bouncy, easeOut } from '../../lib/motion'

/**
 * Animated "understood" check: the disc springs in, the tick draws itself and a ring bursts outward.
 * The burst plays only when the value flips to true while mounted (not when a slide opens already understood).
 */
export default function CheckMark({ on, size = 28 }: { on: boolean; size?: number }) {
  const [burst, setBurst] = useState(0)
  const prev = useRef(on)

  useEffect(() => {
    if (on && !prev.current) setBurst((b) => b + 1)
    prev.current = on
  }, [on])

  return (
    <span className="lrn-check" data-on={on || undefined} style={{ width: size, height: size }} aria-hidden="true">
      <span className="lrn-check-ring" />
      <motion.span className="lrn-check-fill" initial={false} animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }} transition={bouncy} />
      <svg className="lrn-check-svg" viewBox="0 0 24 24" width={size} height={size}>
        <motion.path
          d="M6.6 12.6l3.5 3.5 7.3-7.7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
          transition={{ pathLength: { duration: on ? 0.38 : 0.15, ease: easeOut, delay: on ? 0.08 : 0 }, opacity: { duration: 0.12 } }}
        />
      </svg>
      <AnimatePresence>
        {burst > 0 && (
          <motion.span
            key={burst}
            className="lrn-check-burst"
            initial={{ scale: 0.7, opacity: 0.6 }}
            animate={{ scale: 2.3, opacity: 0 }}
            transition={{ duration: 0.65, ease: easeOut }}
          />
        )}
      </AnimatePresence>
    </span>
  )
}

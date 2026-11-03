import {
  animate,
  motion,
  useAnimationControls,
  useIsPresent,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
  type Transition,
  type Variants,
} from 'framer-motion'
import { Check, Hash, Lightbulb, RotateCcw, RotateCw, ScrollText, type LucideIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import UnitPill from '../../components/UnitPill'
import { unitVars, type Card, type CardKind } from '../../data'
import { easeOut, softSpring } from '../../lib/motion'
import { MAX_BOX } from '../../lib/progress'
import { KIND_META, htmlToText } from './deck'

export const KIND_ICON: Record<CardKind, LucideIcon> = { case: ScrollText, concept: Lightbulb, figure: Hash }

/** Each card behind the top one sits this much lower and smaller, so its bottom edge peeks out. */
const PEEK_Y = 14
const PEEK_SCALE = 0.05
/** Drag distance (px) or flick speed (px/s) that counts as a swipe. */
const SWIPE_PX = 110
const SWIPE_SPEED = 600

const FLIP: Transition = { type: 'spring', stiffness: 240, damping: 25 }

/* Exit direction comes from AnimatePresence's `custom` (exiting cards keep frozen props): 1 = knew it, -1 = again, 0 = undo. */
const variants: Variants = {
  exit: (dir: number | undefined) =>
    dir === 1 || dir === -1
      ? {
          x: dir * 560,
          y: 26,
          opacity: 0,
          zIndex: 60,
          transition: {
            x: { type: 'spring', stiffness: 190, damping: 26, restDelta: 2, restSpeed: 60 },
            y: { duration: 0.5, ease: easeOut },
            opacity: { duration: 0.3, delay: 0.12, ease: 'easeOut' },
            zIndex: { duration: 0 },
          },
        }
      : { opacity: 0, y: 64, scale: 0.84, transition: { duration: 0.22, ease: easeOut } },
}

interface Props {
  card: Card
  /** 0 = top of the stack. */
  depth: number
  flipped: boolean
  /** Current Leitner box (0 = never reviewed). */
  box: number
  /** 1-based position in the session, for the accessible label. */
  index: number
  total: number
  /** Undo brings a card back in from the side it left: 1 right, -1 left, 0 normal deal. */
  enterFrom: -1 | 0 | 1
  dealDelay: number
  onFlip: () => void
  onSwipe: (knewIt: boolean) => void
}

export default function StackCard({ card, depth, flipped, box, index, total, enterFrom, dealDelay, onFlip, onSwipe }: Props) {
  const reduce = useReducedMotion()
  const isPresent = useIsPresent()
  const top = depth === 0 && isPresent

  // One motion value drives the tilt, the green/red tint and the stamp, so they all follow the finger.
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-420, 0, 420], [-12, 0, 12])
  const okOpacity = useTransform(x, [24, 120], [0, 1])
  const badOpacity = useTransform(x, [-120, -24], [1, 0])
  const okScale = useTransform(x, [24, 120], [0.7, 1])
  const badScale = useTransform(x, [-120, -24], [1, 0.7])

  const dragged = useRef(false)
  const settled = useRef(false)
  const lastFlipped = useRef(flipped)
  const lift = useAnimationControls()

  useEffect(() => {
    settled.current = true
  }, [])

  // A small lift while the card turns over, like picking it up off the table.
  useEffect(() => {
    if (lastFlipped.current === flipped) return
    lastFlipped.current = flipped
    if (reduce) return
    void lift.start({ scale: [1, 1.035, 1], transition: { duration: 0.55, times: [0, 0.4, 1], ease: 'easeInOut' } })
  }, [flipped, reduce, lift])

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const dx = info.offset.x
    const vx = info.velocity.x
    const dir = dx > SWIPE_PX || (vx > SWIPE_SPEED && dx > 40) ? 1 : dx < -SWIPE_PX || (vx < -SWIPE_SPEED && dx < -40) ? -1 : 0
    if (dir === 0) {
      animate(x, 0, reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 520, damping: 34 })
      return
    }
    // Framer stops the drag with a zero-velocity settle; restart the throw with the release velocity so the
    // exit animation (which picks up x's live velocity) keeps the flick's momentum instead of pausing.
    if (!reduce) animate(x, dir * 560, { type: 'spring', stiffness: 190, damping: 26, velocity: vx })
    onSwipe(dir === 1)
  }

  const meta = KIND_META[card.kind]
  const Icon = KIND_ICON[card.kind]
  const promptLen = htmlToText(card.front).length
  const answerLen = htmlToText(card.back).length
  const promptSize = promptLen <= 70 ? 'lg' : promptLen <= 150 ? 'md' : 'sm'
  const bigAnswer = answerLen > 0 && answerLen <= 90

  return (
    <motion.div
      className="fc-card"
      role="group"
      aria-roledescription="flashcard"
      aria-label={`Card ${index} of ${total}`}
      aria-hidden={top ? undefined : true}
      inert={!top}
      tabIndex={top ? -1 : undefined}
      data-top={top ? 'true' : undefined}
      data-leaving={isPresent ? undefined : 'true'}
      data-draggable={top && flipped ? 'true' : undefined}
      style={{ ...unitVars(card.unitId), x, rotate, zIndex: 30 - depth * 10 }}
      initial={
        enterFrom
          ? { x: enterFrom * 420, y: 0, scale: 1, opacity: 0 }
          : { x: 0, y: depth * PEEK_Y + 60, scale: 0.86, opacity: 0 }
      }
      animate={{ x: 0, y: depth * PEEK_Y, scale: 1 - depth * PEEK_SCALE, opacity: 1 }}
      exit="exit"
      variants={variants}
      transition={{ ...softSpring, delay: settled.current ? 0 : dealDelay }}
      drag={top && flipped ? 'x' : false}
      dragMomentum={false}
      onPointerDown={() => {
        dragged.current = false
      }}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        // A drag that snaps back still ends in a click; it must not flip the card.
        if (dragged.current) {
          dragged.current = false
          return
        }
        if (top) onFlip()
      }}
    >
      <motion.div className="fc-lift" animate={lift}>
        <motion.div className="fc-flipper" initial={false} animate={{ rotateY: flipped ? 180 : 0 }} transition={FLIP}>
          <div className="fc-face fc-face--front" aria-hidden={flipped || undefined}>
            <div className="fc-face__top">
              <span className="fc-kind">
                <Icon size={14} strokeWidth={2.4} aria-hidden />
                {meta.label}
              </span>
              <UnitPill unitId={card.unitId} />
              <BoxMeter box={box} />
            </div>
            <div className="fc-face__body">
              <span className="sr-only">Question: </span>
              <div className={`notes fc-prompt fc-prompt--${promptSize}`} dangerouslySetInnerHTML={{ __html: card.front }} />
            </div>
            <div className="fc-face__foot">
              <span className="fc-cue">Answer it in your head first</span>
              <span className="fc-tap">
                <RotateCw size={14} aria-hidden />
                <span className="fc-pointer-fine">Click or press Space</span>
                <span className="fc-pointer-coarse">Tap to flip</span>
              </span>
            </div>
            <Icon className="fc-watermark" strokeWidth={1.3} aria-hidden />
          </div>

          <div className="fc-face fc-face--back" aria-hidden={!flipped || undefined}>
            <div className="fc-face__top">
              <span className="fc-kind fc-kind--answer">
                <Check size={14} strokeWidth={2.6} aria-hidden />
                Answer
              </span>
              <UnitPill unitId={card.unitId} />
            </div>
            <p className="fc-recap">{htmlToText(card.front)}</p>
            <div className="fc-face__body">
              <span className="sr-only">Answer: </span>
              <div className={`notes fc-answer${bigAnswer ? ' fc-answer--big' : ''}`} dangerouslySetInnerHTML={{ __html: card.back }} />
            </div>
            <div className="fc-face__foot">
              <span className="fc-tap">
                <RotateCcw size={14} aria-hidden />
                <span className="fc-pointer-fine">Drag sideways to grade, or click to turn back</span>
                <span className="fc-pointer-coarse">Swipe to grade, or tap to turn back</span>
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        className="fc-shade"
        aria-hidden
        initial={false}
        animate={{ opacity: depth === 0 ? 0 : depth === 1 ? 0.34 : 0.58 }}
        transition={softSpring}
      />
      <motion.div className="fc-tint fc-tint--ok" aria-hidden style={{ opacity: okOpacity }} />
      <motion.div className="fc-tint fc-tint--bad" aria-hidden style={{ opacity: badOpacity }} />
      <motion.span className="fc-stamp fc-stamp--ok" aria-hidden style={{ opacity: okOpacity, scale: okScale }}>
        <Check size={18} strokeWidth={3} aria-hidden />
        Knew it
      </motion.span>
      <motion.span className="fc-stamp fc-stamp--bad" aria-hidden style={{ opacity: badOpacity, scale: badScale }}>
        <RotateCcw size={18} strokeWidth={3} aria-hidden />
        Again
      </motion.span>
    </motion.div>
  )
}

function BoxMeter({ box }: { box: number }) {
  if (box <= 0) return <span className="fc-new">New</span>
  return (
    <span className="fc-meter" role="img" aria-label={`Leitner box ${box} of ${MAX_BOX}`} title={`Leitner box ${box} of ${MAX_BOX}`}>
      {Array.from({ length: MAX_BOX }, (_, i) => (
        <span key={i} data-on={i < box ? 'true' : undefined} />
      ))}
    </span>
  )
}

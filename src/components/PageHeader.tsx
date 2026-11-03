import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { easeOut } from '../lib/motion'

interface Props {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}

/** Standard page title block used at the top of every view. */
export default function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <motion.header
      className="page-header"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
    >
      <div className="page-header__text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </motion.header>
  )
}

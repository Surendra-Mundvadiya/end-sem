import { useId } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { spring } from '../../lib/motion'

interface Props {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder: string
  autoFocus?: boolean
}

/** Search field with a visible label, a leading icon and an animated clear button. */
export default function SearchBox({ value, onChange, label, placeholder, autoFocus }: Props) {
  const id = useId()
  return (
    <div className="ref-search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="ref-search__icon" size={18} aria-hidden="true" />
      <input
        id={id}
        className="input ref-search__input"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onChange('')
          }
        }}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            className="ref-search__clear"
            aria-label="Clear search"
            onClick={() => onChange('')}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={spring}
          >
            <X size={16} aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

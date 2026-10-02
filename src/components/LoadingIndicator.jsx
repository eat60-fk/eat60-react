import { motion, useReducedMotion } from 'motion/react'

export default function LoadingIndicator({ label = 'Loading EAT60…', compact = false }) {
  const reduceMotion = useReducedMotion()
  return <div className={`eat60-loading${compact ? ' compact' : ''}`} role="status" aria-live="polite">
    <motion.span
      className="eat60-loading-mark"
      aria-hidden="true"
      animate={reduceMotion ? undefined : { rotate: 360 }}
      transition={reduceMotion ? undefined : { duration: 1.2, repeat: Infinity, ease: 'linear' }}
    >E<span>60</span></motion.span>
    <span>{label}</span>
  </div>
}

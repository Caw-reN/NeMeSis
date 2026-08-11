import { motion } from 'framer-motion'
import { statusColors } from '../../utils/helpers'

/**
 * StatusBadge — displays device status with a color-coded badge.
 * UP = emerald, DOWN = rose, UNKNOWN = slate
 */
export default function StatusBadge({ status, size = 'sm' }) {
  const { text, bg, border, dot } = statusColors(status ?? 'unknown')
  const label = status ? status.toUpperCase() : 'UNKNOWN'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${text} ${bg} ${border} ${size === 'lg' ? 'text-sm' : 'text-xs'}`}
    >
      {/* Animated pulse dot for UP status */}
      {status === 'up' ? (
        <motion.span
          className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      )}
      {label}
    </span>
  )
}

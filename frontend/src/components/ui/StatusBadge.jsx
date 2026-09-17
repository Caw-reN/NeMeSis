import { motion } from 'framer-motion'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { statusColors } from '../../utils/helpers'

/**
 * StatusBadge - displays device status with an arrow icon.
 * UP = green arrow up, DOWN = red arrow down, UNKNOWN = slate dash
 */
export default function StatusBadge({ status, size = 'sm' }) {
  const { text, bg, border } = statusColors(status ?? 'unknown')
  const label = status ? status.toUpperCase() : 'UNKNOWN'

  const Icon =
    status === 'up'   ? ArrowUp   :
    status === 'down' ? ArrowDown :
    Minus

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium ${text} ${bg} ${border} ${size === 'lg' ? 'text-sm' : 'text-xs'}`}
    >
      {status === 'up' ? (
        <motion.span
          animate={{ y: [0, -1.5, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center"
        >
          <Icon size={size === 'lg' ? 13 : 11} strokeWidth={2.5} />
        </motion.span>
      ) : (
        <Icon size={size === 'lg' ? 13 : 11} strokeWidth={2.5} />
      )}
      {label}
    </span>
  )
}

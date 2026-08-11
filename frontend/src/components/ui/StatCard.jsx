import { motion } from 'framer-motion'

/**
 * StatCard — KPI metric card for Dashboard.
 *
 * Props:
 *   label    — Card title (e.g., "Total Devices")
 *   value    — Main metric number
 *   icon     — Lucide icon element
 *   accent   — Tailwind bg class for icon background (e.g., 'bg-indigo-50')
 *   iconColor— Tailwind text class for icon (e.g., 'text-indigo-500')
 *   sub      — Optional subtitle below value
 *   index    — For staggered animation delay
 */
export default function StatCard({ label, value, icon, accent = 'bg-slate-100', iconColor = 'text-slate-500', sub, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.07, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4"
    >
      {/* Icon */}
      <div className={`flex-none rounded-xl p-3 ${accent}`}>
        <span className={iconColor}>{icon}</span>
      </div>

      {/* Content */}
      <div className="min-w-0">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <p className="font-display text-3xl font-extrabold text-slate-900 leading-tight mt-0.5">
          {value ?? '—'}
        </p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
    </motion.div>
  )
}

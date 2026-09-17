import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X, Loader2 } from 'lucide-react'
import { registerToastHandler, unregisterToastHandler } from '../../utils/toast'

const ICONS = {
  success: <CheckCircle size={18} className="text-emerald-500 shrink-0" />,
  error:   <XCircle    size={18} className="text-rose-500 shrink-0" />,
  warning: <AlertTriangle size={18} className="text-amber-500 shrink-0" />,
  info:    <Info       size={18} className="text-indigo-500 shrink-0" />,
  loading: <Loader2    size={18} className="text-indigo-500 shrink-0 animate-spin" />,
}

const BG = {
  success: 'bg-white border-emerald-200',
  error:   'bg-white border-rose-200',
  warning: 'bg-white border-amber-200',
  info:    'bg-white border-indigo-200',
  loading: 'bg-white border-indigo-200',
}

const AUTO_DISMISS_MS = 4500

function ToastItem({ toast: t, onDismiss }) {
  useEffect(() => {
    // Loading toasts don't auto-dismiss - they wait to be replaced or manually dismissed
    if (t.type === 'loading') return
    const timer = setTimeout(() => onDismiss(t.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [t.id, t.type, onDismiss])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 12, scale: 0.95  }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`flex items-start gap-3 w-80 rounded-xl border shadow-lg px-4 py-3 ${BG[t.type] ?? BG.info}`}
    >
      {ICONS[t.type] ?? ICONS.info}
      <p className="flex-1 text-sm text-slate-700 leading-snug">{t.message}</p>
      <button
        onClick={() => onDismiss(t.id)}
        className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
      >
        <X size={15} />
      </button>
    </motion.div>
  )
}

/**
 * ToastContainer - mount once in App.jsx.
 * Registers itself with the global toast utility so Axios interceptors can trigger it.
 */
export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((t) => {
    if (t.type === 'dismiss') {
      // Handle explicit dismiss by ID
      setToasts(prev => prev.filter(x => x.id !== t.id))
      return
    }
    setToasts(prev => {
      // If a toast with the same ID already exists, replace it (e.g. loading → success)
      const exists = prev.some(x => x.id === t.id)
      if (exists) {
        return prev.map(x => x.id === t.id ? t : x)
      }
      return [...prev.slice(-4), t] // keep max 5 toasts
    })
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    registerToastHandler(addToast)
    return () => unregisterToastHandler()
  }, [addToast])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}


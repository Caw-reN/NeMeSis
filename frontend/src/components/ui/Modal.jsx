import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Modal — Radix Dialog with Framer Motion scale-in animation.
 *
 * Props:
 *   open, onOpenChange — controlled state
 *   title, description — optional header text
 *   children — modal body
 *   maxWidth — Tailwind class e.g. 'max-w-lg' (default)
 */
export default function Modal({ open, onOpenChange, title, description, children, maxWidth = 'max-w-lg' }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {/* Content */}
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1,    y: 0 }}
                exit={{    opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className={`fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${maxWidth} bg-white rounded-2xl border border-slate-200 shadow-xl p-6 focus:outline-none`}
              >
                {/* Header */}
                {(title || description) && (
                  <div className="mb-5">
                    {title && (
                      <Dialog.Title className="font-display text-xl font-bold text-slate-900">
                        {title}
                      </Dialog.Title>
                    )}
                    {description && (
                      <Dialog.Description className="text-sm text-slate-500 mt-1">
                        {description}
                      </Dialog.Description>
                    )}
                  </div>
                )}

                {/* Close button */}
                <Dialog.Close asChild>
                  <button className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition">
                    <X size={18} />
                  </button>
                </Dialog.Close>

                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

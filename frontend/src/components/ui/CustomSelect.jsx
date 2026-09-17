import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'

export default function CustomSelect({ value, onChange, options = [], placeholder = 'Select...', disabled = false, placement = 'bottom' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedOption = options.find(opt => opt.value === value)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div className="relative w-full text-sm" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border bg-white transition-all
          ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer hover:border-indigo-300'}
          ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-300'}
        `}
      >
        <span className={`truncate text-left flex-1 mr-2 ${selectedOption ? 'text-slate-800' : 'text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className={`shrink-0 text-slate-400 transition-transform duration-300 ${isOpen ? (placement === 'top' ? '' : 'rotate-180') : (placement === 'top' ? 'rotate-180' : '')}`} 
          size={16} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: placement === 'top' ? 5 : -5, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'top' ? 5 : -5, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[999] w-full bg-white/90 backdrop-blur-xl border border-white/60 shadow-xl rounded-xl overflow-hidden ${
              placement === 'top' ? 'bottom-full mb-2' : 'mt-2'
            }`}
          >
            <ul className="max-h-60 overflow-y-auto p-1">
              {options.map((option) => (
                <li
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`
                    flex items-center justify-between px-3 py-2.5 my-0.5 rounded-lg cursor-pointer transition-colors
                    ${option.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-100/80'}
                  `}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && <Check size={16} className="shrink-0" />}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

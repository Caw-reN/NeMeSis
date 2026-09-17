import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Monitor, Network, Settings,
  Radio, X, Zap
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/devices',   icon: <Monitor  size={18} />, label: 'Devices'   },
  { to: '/topology',  icon: <Network  size={18} />, label: 'Topology'  },
  { to: '/settings',  icon: <Settings size={18} />, label: 'Settings'  },
]

/**
 * Sidebar - Fixed navigation on desktop, slide-in drawer on mobile.
 * Props: open (mobile), onClose (mobile)
 */
export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Desktop sidebar (always visible on lg+) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 bg-white border-r border-slate-200 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
              onClick={onClose}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="fixed top-0 left-0 z-50 flex flex-col w-60 h-screen bg-white border-r border-slate-200 lg:hidden"
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
              <SidebarContent onNavClick={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function SidebarContent({ onNavClick }) {
  return (
    <div className="flex flex-col h-full py-6">
      {/* Logo */}
      <div className="px-5 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Zap size={15} className="text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-slate-900 text-sm leading-none">NMS</p>
            <p className="text-xs text-slate-400 mt-0.5">Command Center</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">
          Navigation
        </p>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom info */}
      <div className="px-5 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400">Worker active</span>
        </div>
        <p className="text-xs text-slate-300 mt-1">NMS v0.2.0 - Fase 2</p>
      </div>
    </div>
  )
}

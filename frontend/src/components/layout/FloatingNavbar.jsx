import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutDashboard, Monitor, Network, Zap, Map, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/devices',   icon: <Monitor  size={18} />, label: 'Devices'   },
  { to: '/topology',  icon: <Network  size={18} />, label: 'Topology'  },
  { to: '/areas',     icon: <Map      size={18} />, label: 'Maps'      },
  { to: '/settings',  icon: <Settings size={18} />, label: 'Settings'  },
]

/**
 * FloatingNavbar - Modern floating bottom navigation pill bar.
 */
export default function FloatingNavbar() {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex items-center gap-1.5 p-1.5 bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-full shadow-2xl shadow-slate-900/10 ring-1 ring-black/5"
      >
        {/* Brand Badge */}
        <div className="flex items-center gap-2 pl-2.5 pr-2 py-1">
          <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center shadow-sm">
            <Zap size={14} className="text-white" />
          </div>
          <span className="font-display font-bold text-xs text-slate-900 hidden sm:inline-block">
            NMS
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 my-auto mx-0.5" />

        {/* Nav items */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors duration-200 ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active Pill Highlight Animation */}
                  {isActive && (
                    <motion.div
                      layoutId="activePillTab"
                      className="absolute inset-0 bg-zinc-900 rounded-full shadow-md -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {item.icon}
                    <span className="hidden xs:inline-block">{item.label}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-200 my-auto mx-0.5 hidden sm:block" />

        {/* Worker Status Dot */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100/80 rounded-full border border-slate-200/50">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
            Active
          </span>
        </div>
      </motion.div>
    </div>
  )
}

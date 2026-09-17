import { useLocation, useNavigate } from 'react-router-dom'
import { LogOut, User, Zap } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../utils/toast'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/devices':   'Devices',
  '/topology':  'Topology Map',
}

/**
 * Header - Clean top bar with brand badge, current page title, and user dropdown.
 */
export default function Header() {
  const { pathname }     = useLocation()
  const { user, logout } = useAuth()
  const navigate          = useNavigate()

  const title = PAGE_TITLES[pathname] ?? 'NMS Command Center'

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      toast.error('Logout failed. Please try again.')
    }
  }

  return (
    <header className="absolute top-0 w-full z-30 px-4 lg:px-6 py-4 flex items-center justify-between pointer-events-none transition-all">
      {/* Left: Brand + Page Title */}
      <div className="flex items-center gap-3 bg-white/90 backdrop-blur-md shadow-sm border border-slate-200/80 rounded-2xl pr-4 p-1.5 pointer-events-auto">
        <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center shadow-sm shrink-0">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <h1 className="font-display font-bold text-slate-900 text-sm leading-tight">
            {title}
          </h1>
          <p className="text-[10px] text-slate-400 font-medium hidden sm:block leading-none mt-0.5">
            NMS Command Center
          </p>
        </div>
      </div>

      {/* Right: user dropdown */}
      <div className="pointer-events-auto">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2.5 bg-white shadow-sm rounded-full pl-1.5 pr-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 border border-slate-200/80 transition outline-none">
            <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center shadow-sm">
              <User size={13} className="text-white" />
            </div>
            <span className="font-semibold text-xs max-w-[120px] truncate">
              {user?.name ?? 'Admin'}
            </span>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-[190px] bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 text-sm animate-in fade-in zoom-in-95"
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <p className="font-semibold text-slate-900 text-xs truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
            <DropdownMenu.Item
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer outline-none transition text-xs font-semibold"
            >
              <LogOut size={14} />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      </div>
    </header>
  )
}

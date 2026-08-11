import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, LogOut, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '../../context/AuthContext'
import { toast } from '../../utils/toast'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/devices':   'Devices',
  '/topology':  'Topology Map',
}

/**
 * Header — top bar with page title, hamburger (mobile), and user dropdown.
 */
export default function Header({ onMenuToggle }) {
  const { pathname }  = useLocation()
  const { user, logout } = useAuth()
  const navigate       = useNavigate()

  const title = PAGE_TITLES[pathname] ?? 'NMS'

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch {
      toast.error('Logout failed. Please try again.')
    }
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200 px-4 lg:px-6 h-16 flex items-center justify-between">
      {/* Left: hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-display font-bold text-slate-900 text-lg">{title}</h1>
      </div>

      {/* Right: user dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition">
            <div className="w-7 h-7 rounded-full bg-zinc-900 flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <span className="hidden sm:block font-medium max-w-[120px] truncate">
              {user?.name ?? 'Admin'}
            </span>
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="z-50 min-w-[180px] bg-white rounded-xl border border-slate-200 shadow-lg p-1 text-sm animate-in fade-in zoom-in-95"
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <p className="font-semibold text-slate-900 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <DropdownMenu.Item
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer outline-none transition"
            >
              <LogOut size={15} />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  )
}

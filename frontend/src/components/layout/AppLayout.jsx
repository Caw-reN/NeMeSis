import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import FloatingNavbar from './FloatingNavbar'

/**
 * AppLayout — shell layout with floating top header, full-width main content area,
 * and a floating rounded bottom navigation bar.
 *
 * Header is absolutely positioned — it floats above content.
 * FloatingNavbar is fixed to bottom — it floats above content.
 * Main fills the full viewport.
 * Non-topology pages add top/bottom padding to avoid overlap with floaters.
 */
export default function AppLayout() {
  const { pathname } = useLocation()
  const isFullBleed = pathname === '/topology'

  return (
    <div className="h-screen bg-slate-50 relative overflow-hidden">
      {/* Floating header — absolutely positioned, does not take flow space */}
      <Header />

      {/* Main content area — fills full screen */}
      <main className={`absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden${
        isFullBleed ? '' : ' p-4 lg:p-6 pt-24 lg:pt-24 pb-28 lg:pb-28'
      }`}>
        <Outlet />
      </main>

      {/* Floating bottom navbar — fixed, does not take flow space */}
      <FloatingNavbar />
    </div>
  )
}


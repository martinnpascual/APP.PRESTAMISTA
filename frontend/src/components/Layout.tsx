import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  UsersIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UsersIcon as UsersIconSolid,
  BanknotesIcon as BanknotesIconSolid,
  ClipboardDocumentListIcon as ClipboardSolid,
  ChartBarIcon as ChartBarIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
} from '@heroicons/react/24/solid'
import { useAuthStore } from '../stores/authStore'
import clsx from 'clsx'

const navItems = [
  { to: '/',          label: 'Inicio',    icon: HomeIcon,                    iconSolid: HomeIconSolid,          adminOnly: false },
  { to: '/clientes',  label: 'Clientes',  icon: UsersIcon,                   iconSolid: UsersIconSolid,         adminOnly: false },
  { to: '/prestamos', label: 'Préstamos', icon: BanknotesIcon,               iconSolid: BanknotesIconSolid,     adminOnly: false },
  { to: '/cobros',    label: 'Cobros',    icon: ClipboardDocumentListIcon,   iconSolid: ClipboardSolid,         adminOnly: false },
  { to: '/reportes',  label: 'Reportes',  icon: ChartBarIcon,                iconSolid: ChartBarIconSolid,      adminOnly: false },
  { to: '/usuarios',  label: 'Usuarios',  icon: Cog6ToothIcon,               iconSolid: Cog6ToothIconSolid,     adminOnly: true  },
]

export default function Layout() {
  const { user, signOut, session } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = session?.user?.app_metadata?.rol === 'admin' || session?.user?.user_metadata?.rol === 'admin'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = user?.email?.split('@')[0] ?? 'Usuario'

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ── Sidebar desktop ────────────────────────────────── */}
      <aside className="hidden w-56 flex-col border-r border-gray-200 bg-white lg:flex">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <BanknotesIcon className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-gray-900">prestamos.app</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {navItems.filter(item => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon, iconSolid: IconSolid }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              {({ isActive }) =>
                isActive
                  ? <><IconSolid className="h-4 w-4 shrink-0" />{label}</>
                  : <><Icon className="h-4 w-4 shrink-0" />{label}</>
              }
            </NavLink>
          ))}
        </nav>

        {/* Usuario */}
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-2 rounded-lg px-2 py-2">
            <UserCircleIcon className="h-7 w-7 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-800">{displayName}</p>
              <p className="truncate text-[10px] text-gray-400">{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              title="Cerrar sesión"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BanknotesIcon className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-bold text-gray-900">prestamos.app</span>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            title="Cerrar sesión"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      {/* ── Bottom nav mobile ──────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-gray-200 bg-white lg:hidden">
        {navItems.filter(item => !item.adminOnly || isAdmin).map(({ to, label, icon: Icon, iconSolid: IconSolid }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'text-blue-600' : 'text-gray-400'
              )
            }
          >
            {({ isActive }) =>
              isActive
                ? <><IconSolid className="h-5 w-5" />{label}</>
                : <><Icon className="h-5 w-5" />{label}</>
            }
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

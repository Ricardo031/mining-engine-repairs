import {
  ClipboardList,
  Cog,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { cn } from '../../lib/cn';
import { ROLE_LABELS } from '../../lib/labels';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Órdenes', icon: ClipboardList },
  { to: '/clients', label: 'Clientes', icon: Factory },
  { to: '/engines', label: 'Motores', icon: Cog },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex size-9 items-center justify-center rounded-lg bg-brand-500 text-slate-900">
        <Cog className="size-5" aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-white">Mining Repairs</p>
        <p className="text-xs text-slate-400">Taller de motores</p>
      </div>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin } = useAuth();
  const items = isAdmin
    ? [...NAV_ITEMS, { to: '/users', label: 'Usuarios', icon: ShieldCheck }]
    : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1" aria-label="Principal">
      {items.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={'end' in rest ? rest.end : false}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-white/10 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('size-5', isActive ? 'text-brand-500' : 'text-slate-400')} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function UserBox() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
      <div className="flex size-9 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">
        {initials}
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-white">
          {user.firstName} {user.lastName}
        </p>
        <p className="truncate text-xs text-slate-400">{ROLE_LABELS[user.role]}</p>
      </div>
      <button
        type="button"
        onClick={() => logout('manual')}
        className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut className="size-5" />
      </button>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-8 bg-slate-900 px-4 py-5">
      <Brand />
      <div className="flex-1">
        <Navigation onNavigate={() => setMobileOpen(false)} />
      </div>
      <UserBox />
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-slate-900 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1 text-slate-300 hover:text-white"
          aria-label="Abrir menú"
        >
          <Menu className="size-6" />
        </button>
        <span className="text-sm font-semibold text-white">Mining Repairs</span>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">
            {sidebar}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-5 rounded-md p-1 text-slate-400 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

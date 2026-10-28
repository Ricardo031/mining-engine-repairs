import {
  ChevronRight,
  ClipboardList,
  Cog,
  LayoutGrid,
  LogOut,
  Menu,
  ShieldCheck,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { useAuth } from '../../auth/useAuth';
import { cn } from '../../lib/cn';
import { ROLE_LABELS } from '../../lib/labels';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/orders', label: 'Órdenes', icon: ClipboardList },
  { to: '/clients', label: 'Clientes', icon: UserPlus },
  { to: '/engines', label: 'Motores', icon: Cog },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-navy-950 shadow-[0_6px_16px_-6px_rgba(245,164,0,0.7)]">
        <Cog className="size-5" strokeWidth={2.4} aria-hidden />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-bold text-white">Mining Repairs</p>
        <p className="text-xs text-slate-400">Gestión de taller</p>
      </div>
    </div>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin } = useAuth();
  const items: NavItem[] = isAdmin
    ? [...NAV_ITEMS, { to: '/users', label: 'Usuarios', icon: ShieldCheck }]
    : NAV_ITEMS;

  return (
    <nav aria-label="Principal">
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        Plataforma
      </p>
      <ul className="flex flex-col gap-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-navy-800 text-white ring-1 ring-inset ring-white/10'
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
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** User box at the bottom of the sidebar; opens a small menu with "Cerrar sesión". */
function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div ref={ref} className="relative border-t border-white/10 pt-4">
      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-xl bg-navy-800 p-1 shadow-xl ring-1 ring-white/10"
        >
          <p className="truncate px-3 py-2 text-xs text-slate-400">{user.email}</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => logout('manual')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-xs font-bold text-navy-950">
          {initials}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">
            {user.firstName} {user.lastName}
          </span>
          <span className="block truncate text-xs text-slate-400">{ROLE_LABELS[user.role]}</span>
        </span>
        <ChevronRight
          className={cn('size-4 text-slate-500 transition-transform', open && '-rotate-90')}
          aria-hidden
        />
      </button>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-9 bg-navy-950 px-4 py-5">
      <Brand />
      <div className="flex-1">
        <Navigation onNavigate={() => setMobileOpen(false)} />
      </div>
      <UserMenu />
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex items-center gap-3 bg-navy-950 px-4 py-3 lg:hidden">
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
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72">
            {sidebar}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-6 rounded-md p-1 text-slate-400 hover:text-white"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

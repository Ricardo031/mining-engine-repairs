import type { IdentificationType, OrderStatus, Role } from '../api/types';

/** The API speaks in codes; the UI shows Spanish labels. */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: 'Recibido',
  IN_DIAGNOSIS: 'En diagnóstico',
  AWAITING_APPROVAL: 'Esperando aprobación',
  IN_REPAIR: 'En reparación',
  IN_TESTING: 'En pruebas',
  COMPLETED: 'Finalizado',
  DELIVERED: 'Entregado',
};

/** Tailwind classes per status, from "just arrived" to "done". */
export const STATUS_STYLES: Record<OrderStatus, { badge: string; dot: string }> = {
  RECEIVED: { badge: 'bg-slate-100 text-slate-700 ring-slate-200', dot: 'bg-slate-400' },
  IN_DIAGNOSIS: { badge: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  AWAITING_APPROVAL: { badge: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500' },
  IN_REPAIR: { badge: 'bg-orange-50 text-orange-700 ring-orange-200', dot: 'bg-orange-500' },
  IN_TESTING: { badge: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
  COMPLETED: { badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  DELIVERED: { badge: 'bg-teal-50 text-teal-800 ring-teal-200', dot: 'bg-teal-600' },
};

export const IDENTIFICATION_LABELS: Record<IdentificationType, string> = {
  NIT: 'NIT',
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  PASSPORT: 'Pasaporte',
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  operator: 'Operativo',
};

const dateFormatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Formats "YYYY-MM-DD" (a calendar date, no time zone) or an ISO timestamp.
 * Plain dates are parsed as local dates so they do not shift one day back.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const plainDate = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  const date = plainDate ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

/** Today as "YYYY-MM-DD" in local time (for <input type="date">). */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** True when a delivery date already passed and the order is not delivered. */
export function isOverdue(estimated: string, delivered: string | null): boolean {
  return !delivered && estimated < todayIso();
}

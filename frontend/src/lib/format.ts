const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'short' });
const longDayFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Parses "YYYY-MM-DD" as a local date (so it does not shift one day back) or an ISO timestamp. */
export function parseDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

/** "18 Nov, 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = monthFormatter.format(date).replace('.', '');
  return `${date.getDate()} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${date.getFullYear()}`;
}

/** "LUNES, 27 DE OCTUBRE" style eyebrow (returned in normal case; CSS uppercases it). */
export function formatLongDay(date: Date = new Date()): string {
  return longDayFormatter.format(date);
}

/** "Buenos días" / "Buenas tardes" / "Buenas noches" depending on the local hour. */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
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

import type { OrderStatus } from '../api/types';
import { cn } from '../lib/cn';
import { STATUS_LABELS, STATUS_STYLES } from '../lib/labels';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        style.badge,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

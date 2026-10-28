import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

/**
 * Data table. When `onRowClick` is provided the whole row is clickable and a
 * chevron button is added at the end (keyboard users can focus that button).
 */
export function Table<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  rowLabel,
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  /** Accessible name of the chevron button, e.g. (row) => `Ver orden ${row.order_number}`. */
  rowLabel?: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-y border-slate-100 bg-slate-50/70">
            {columns.map((column) => (
              <th
                key={column.header}
                scope="col"
                className={cn(
                  'px-6 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
            {onRowClick && (
              <th scope="col" className="w-14 px-6 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && 'group cursor-pointer transition-colors hover:bg-brand-50/40')}
            >
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={cn('whitespace-nowrap px-6 py-4 text-slate-700', column.className)}
                >
                  {column.cell(row)}
                </td>
              ))}
              {onRowClick && (
                <td className="px-6 py-4 text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRowClick(row);
                    }}
                    aria-label={rowLabel ? rowLabel(row) : 'Ver detalle'}
                    className="inline-flex size-7 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition group-hover:bg-brand-500 group-hover:text-navy-950"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

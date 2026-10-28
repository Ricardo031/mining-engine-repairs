import { CircleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { Button, ButtonLink } from '../components/ui/Button';

/** Shown instead of a blank/technical screen when a page crashes while rendering. */
export function RouteErrorPage() {
  const error = useRouteError();
  // Technical details only in development; production users see a friendly message.
  const detail = import.meta.env.DEV && error instanceof Error ? error.message : null;

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-24 text-center">
      <div className="rounded-full bg-red-50 p-3">
        <CircleAlert className="size-7 text-red-500" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold text-navy-950">Algo salió mal</h1>
      <p className="max-w-md text-sm text-slate-500">
        No pudimos mostrar esta página. Intenta recargarla; si el problema continúa, verifica que
        los servicios estén actualizados y en ejecución.
      </p>
      {detail && (
        <code className="max-w-lg rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">{detail}</code>
      )}
      <div className="mt-2 flex gap-2">
        <Button onClick={() => window.location.reload()}>Recargar</Button>
        <ButtonLink to="/" variant="secondary">
          Ir al dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

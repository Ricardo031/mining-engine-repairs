import { ButtonLink } from '../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">Página no encontrada</h1>
      <p className="text-sm text-slate-500">La dirección que buscas no existe.</p>
      <ButtonLink to="/" variant="secondary" className="mt-2">
        Ir al dashboard
      </ButtonLink>
    </div>
  );
}

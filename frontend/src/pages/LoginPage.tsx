import { zodResolver } from '@hookform/resolvers/zod';
import { Cog } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { getErrorMessage } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/feedback';
import { Field, Input } from '../components/ui/form';

const schema = z.object({
  email: z.string().trim().min(1, 'Ingresa tu correo').email('Correo no válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { user, login, logoutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to={from} replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <div className="flex min-h-dvh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-12 lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-brand-500/10 blur-3xl"
          aria-hidden
        />
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand-500 text-slate-900">
            <Cog className="size-6" aria-hidden />
          </div>
          <span className="text-lg font-semibold text-white">Mining Repairs</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Control de reparaciones de motores de minería pesada
          </h2>
          <p className="mt-4 text-slate-400">
            Registra clientes y motores, crea órdenes de reparación y sigue cada servicio desde la
            recepción hasta la entrega.
          </p>
        </div>
        <p className="text-xs text-slate-500">Uso interno del taller</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Inicia sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa con tu cuenta del taller.</p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            {logoutReason === 'expired' && !serverError && (
              <Alert>Tu sesión expiró. Vuelve a iniciar sesión.</Alert>
            )}
            {serverError && <Alert>{serverError}</Alert>}

            <Field label="Correo electrónico" error={errors.email?.message}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-describedby={describedBy}
                  invalid={!!errors.email}
                  {...register('email')}
                />
              )}
            </Field>

            <Field label="Contraseña" error={errors.password?.message}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  type="password"
                  autoComplete="current-password"
                  aria-describedby={describedBy}
                  invalid={!!errors.password}
                  {...register('password')}
                />
              )}
            </Field>

            <Button type="submit" loading={isSubmitting} className="w-full">
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

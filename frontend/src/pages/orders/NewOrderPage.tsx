import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { enginesApi, ordersApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import { useToast } from '../../components/toast/context';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/feedback';
import { Field, Input, Select, Textarea } from '../../components/ui/form';
import { Card, PageHeader } from '../../components/ui/layout';
import { todayIso } from '../../lib/format';

const optionalText = z.string().trim().max(5000, 'Máximo 5000 caracteres');

const schema = z
  .object({
    engine_id: z.string().min(1, 'Selecciona el motor'),
    received_at: z.string().min(1, 'Indica la fecha de recepción'),
    estimated_delivery_date: z.string().min(1, 'Indica la fecha estimada de entrega'),
    technician: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120, 'Máximo 120 caracteres'),
    reported_problem: z.string().trim().min(1, 'Describe el problema reportado').max(5000),
    diagnosis: optionalText,
    work_performed: optionalText,
    observations: optionalText,
  })
  .refine((v) => v.estimated_delivery_date >= v.received_at, {
    path: ['estimated_delivery_date'],
    message: 'No puede ser anterior a la fecha de recepción',
  });

type FormValues = z.infer<typeof schema>;

const emptyToUndefined = (value: string) => (value.trim() ? value.trim() : undefined);

export function NewOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  // Only active engines can receive new orders.
  const engines = useQuery({
    queryKey: ['engines', 'options', 'active'],
    queryFn: () => enginesApi.list({ is_active: true, limit: 100 }),
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      engine_id: params.get('engine_id') ?? '',
      received_at: todayIso(),
      estimated_delivery_date: '',
      technician: '',
      reported_problem: '',
      diagnosis: '',
      work_performed: '',
      observations: '',
    },
  });

  const selectedEngineId = useWatch({ control, name: 'engine_id' });
  const selectedEngine = engines.data?.data.find((e) => e.id === selectedEngineId);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      ordersApi.create({
        ...values,
        diagnosis: emptyToUndefined(values.diagnosis),
        work_performed: emptyToUndefined(values.work_performed),
        observations: emptyToUndefined(values.observations),
      }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`Orden ${order.order_number} creada.`);
      navigate(`/orders/${order.id}`);
    },
    onError: (error) => setServerError(getErrorMessage(error)),
  });

  return (
    <>
      <PageHeader
        back={
          <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="size-4" /> Órdenes
          </Link>
        }
        title="Nueva orden de reparación"
        description="El número de orden y el cliente se asignan automáticamente a partir del motor."
      />

      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="space-y-6 lg:col-span-2">
          {serverError && <Alert>{serverError}</Alert>}

          <Card title="Recepción">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Motor" required error={errors.engine_id?.message} className="sm:col-span-2">
                {(id, d) => (
                  <Select
                    id={id}
                    aria-describedby={d}
                    invalid={!!errors.engine_id}
                    disabled={engines.isPending}
                    {...register('engine_id')}
                  >
                    <option value="">{engines.isPending ? 'Cargando motores…' : 'Selecciona un motor'}</option>
                    {engines.data?.data.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.serial_number} — {e.manufacturer} {e.model} ({e.client.name})
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Fecha de recepción" required error={errors.received_at?.message}>
                {(id, d) => (
                  <Input id={id} type="date" aria-describedby={d} invalid={!!errors.received_at} {...register('received_at')} />
                )}
              </Field>
              <Field label="Fecha estimada de entrega" required error={errors.estimated_delivery_date?.message}>
                {(id, d) => (
                  <Input
                    id={id}
                    type="date"
                    aria-describedby={d}
                    invalid={!!errors.estimated_delivery_date}
                    {...register('estimated_delivery_date')}
                  />
                )}
              </Field>
              <Field
                label="Técnico responsable"
                required
                error={errors.technician?.message}
                className="sm:col-span-2"
              >
                {(id, d) => (
                  <Input id={id} aria-describedby={d} invalid={!!errors.technician} {...register('technician')} />
                )}
              </Field>
              <Field
                label="Problema reportado"
                required
                error={errors.reported_problem?.message}
                className="sm:col-span-2"
              >
                {(id, d) => (
                  <Textarea
                    id={id}
                    rows={4}
                    aria-describedby={d}
                    invalid={!!errors.reported_problem}
                    placeholder="Lo que el cliente reporta: síntomas, fallas, condiciones de operación…"
                    {...register('reported_problem')}
                  />
                )}
              </Field>
            </div>
          </Card>

          <Card title="Información técnica (opcional)">
            <p className="mb-4 text-sm text-slate-500">
              Normalmente se completa más adelante, al avanzar el estado de la orden.
            </p>
            <div className="space-y-4">
              <Field label="Diagnóstico técnico" error={errors.diagnosis?.message}>
                {(id, d) => <Textarea id={id} aria-describedby={d} {...register('diagnosis')} />}
              </Field>
              <Field label="Trabajo realizado o reparación requerida" error={errors.work_performed?.message}>
                {(id, d) => <Textarea id={id} aria-describedby={d} {...register('work_performed')} />}
              </Field>
              <Field label="Observaciones" error={errors.observations?.message}>
                {(id, d) => <Textarea id={id} aria-describedby={d} {...register('observations')} />}
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Resumen">
            {selectedEngine ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Cliente</dt>
                  <dd className="font-medium text-slate-900">{selectedEngine.client.name}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Motor</dt>
                  <dd className="text-slate-900">
                    {selectedEngine.serial_number}
                    <span className="block text-slate-500">
                      {selectedEngine.manufacturer} {selectedEngine.model} · {selectedEngine.power}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Estado inicial</dt>
                  <dd className="text-slate-900">Recibido</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Selecciona un motor para ver su propietario.</p>
            )}
          </Card>
          <Button type="submit" loading={mutation.isPending} className="w-full">
            Crear orden
          </Button>
        </div>
      </form>
    </>
  );
}

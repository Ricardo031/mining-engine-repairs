import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { clientsApi, enginesApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { Engine } from '../../api/types';
import { useToast } from '../../components/toast/context';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/feedback';
import { Field, Input, Select } from '../../components/ui/form';

const text = (max: number) =>
  z.string().trim().min(1, 'Campo obligatorio').max(max, `Máximo ${max} caracteres`);

const schema = z.object({
  serial_number: z.string().trim().min(3, 'Mínimo 3 caracteres').max(60, 'Máximo 60 caracteres'),
  manufacturer: text(120),
  model: text(120),
  engine_type: text(120),
  power: text(60),
  client_id: z.string().min(1, 'Selecciona el cliente propietario'),
});

type FormValues = z.infer<typeof schema>;

export function EngineForm({
  engine,
  defaultClientId,
  onDone,
  onCancel,
}: {
  engine?: Engine;
  defaultClientId?: string;
  onDone: (engine: Engine) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  // Only active clients can receive engines.
  const clients = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => clientsApi.list({ is_active: true, limit: 100 }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: engine
      ? {
          serial_number: engine.serial_number,
          manufacturer: engine.manufacturer,
          model: engine.model,
          engine_type: engine.engine_type,
          power: engine.power,
          client_id: engine.client.id,
        }
      : { client_id: defaultClientId ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      engine ? enginesApi.update(engine.id, values) : enginesApi.create(values),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['engines'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(engine ? 'Motor actualizado.' : 'Motor registrado.');
      onDone(saved);
    },
    onError: (error) => setServerError(getErrorMessage(error)),
  });

  // Copy: never mutate the cached query data.
  const clientOptions = [...(clients.data?.data ?? [])];
  // Keep the current owner selectable even if it was deactivated later.
  if (engine && !clientOptions.some((c) => c.id === engine.client.id)) {
    clientOptions.unshift({ ...engine.client, email: '', is_active: false, created_at: '', updated_at: '' });
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => {
        setServerError(null);
        mutation.mutate(values);
      })}
      className="space-y-4"
    >
      {serverError && <Alert>{serverError}</Alert>}

      <Field label="Cliente propietario" required error={errors.client_id?.message}>
        {(id, d) => (
          <Select
            id={id}
            aria-describedby={d}
            invalid={!!errors.client_id}
            disabled={clients.isPending}
            {...register('client_id')}
          >
            <option value="">{clients.isPending ? 'Cargando clientes…' : 'Selecciona un cliente'}</option>
            {clientOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.identification_number}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Código interno o número de serie"
        required
        hint="Se guarda en mayúsculas y no se puede repetir."
        error={errors.serial_number?.message}
      >
        {(id, d) => (
          <Input id={id} aria-describedby={d} invalid={!!errors.serial_number} {...register('serial_number')} />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fabricante" required error={errors.manufacturer?.message}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} placeholder="Caterpillar" invalid={!!errors.manufacturer} {...register('manufacturer')} />
          )}
        </Field>
        <Field label="Modelo" required error={errors.model?.message}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} placeholder="C175-16" invalid={!!errors.model} {...register('model')} />
          )}
        </Field>
        <Field label="Tipo de motor" required error={errors.engine_type?.message}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} placeholder="Diésel V16" invalid={!!errors.engine_type} {...register('engine_type')} />
          )}
        </Field>
        <Field label="Potencia o capacidad" required error={errors.power?.message}>
          {(id, d) => (
            <Input id={id} aria-describedby={d} placeholder="2800 HP" invalid={!!errors.power} {...register('power')} />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {engine ? 'Guardar cambios' : 'Registrar motor'}
        </Button>
      </div>
    </form>
  );
}

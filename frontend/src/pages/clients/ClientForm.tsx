import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { clientsApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { Client } from '../../api/types';
import { useToast } from '../../components/toast/context';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/feedback';
import { Field, Input, Select } from '../../components/ui/form';
import { IDENTIFICATION_LABELS } from '../../lib/labels';

// Same rules as the API (app/schemas/clients.py), so most errors never reach the server.
const schema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(160, 'Máximo 160 caracteres'),
  identification_type: z.enum(['NIT', 'CC', 'CE', 'PASSPORT']),
  identification_number: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(30, 'Máximo 30 caracteres')
    .regex(/^[A-Za-z0-9-]+$/, 'Solo letras, números y guiones'),
  email: z.string().trim().email('Correo no válido').max(160),
});

type FormValues = z.infer<typeof schema>;

export function ClientForm({
  client,
  onDone,
  onCancel,
}: {
  client?: Client;
  onDone: (client: Client) => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: client
      ? {
          name: client.name,
          identification_type: client.identification_type,
          identification_number: client.identification_number,
          email: client.email,
        }
      : { identification_type: 'NIT' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      client ? clientsApi.update(client.id, values) : clientsApi.create(values),
    onSuccess: (saved) => {
      // Engines and orders show the client name, so they are refreshed too.
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({ queryKey: ['engines'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(client ? 'Cliente actualizado.' : 'Cliente registrado.');
      onDone(saved);
    },
    onError: (error) => setServerError(getErrorMessage(error)),
  });

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

      <Field label="Nombre o razón social" required error={errors.name?.message}>
        {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.name} {...register('name')} />}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de identificación" required error={errors.identification_type?.message}>
          {(id, d) => (
            <Select id={id} aria-describedby={d} {...register('identification_type')}>
              {Object.entries(IDENTIFICATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Número" required error={errors.identification_number?.message}>
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              invalid={!!errors.identification_number}
              {...register('identification_number')}
            />
          )}
        </Field>
      </div>

      <Field label="Correo electrónico" required error={errors.email?.message}>
        {(id, d) => (
          <Input id={id} type="email" aria-describedby={d} invalid={!!errors.email} {...register('email')} />
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {client ? 'Guardar cambios' : 'Registrar cliente'}
        </Button>
      </div>
    </form>
  );
}

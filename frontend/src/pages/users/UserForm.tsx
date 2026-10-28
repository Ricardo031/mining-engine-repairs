import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { usersApi } from '../../api/endpoints';
import { getErrorMessage } from '../../api/errors';
import type { User } from '../../api/types';
import { useToast } from '../../components/toast/context';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/feedback';
import { Field, Input, Select } from '../../components/ui/form';
import { ROLE_LABELS } from '../../lib/labels';

const name = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres');

const baseSchema = z.object({
  firstName: name,
  lastName: name,
  email: z.string().trim().email('Correo no válido').max(160),
  role: z.enum(['admin', 'operator']),
});

// Same password policy as the auth service.
const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Debe tener al menos una letra')
  .regex(/\d/, 'Debe tener al menos un número');

type FormValues = z.infer<typeof baseSchema> & { password?: string };

/** The password is only asked (and required) when creating a user. */
function schemaFor(isNew: boolean): z.ZodType<FormValues, FormValues> {
  return baseSchema.extend({ password: isNew ? passwordSchema : z.string().optional() });
}

export function UserForm({
  user,
  onDone,
  onCancel,
}: {
  user?: User;
  onDone: () => void;
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
    resolver: zodResolver(schemaFor(!user)),
    defaultValues: user
      ? { firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }
      : { role: 'operator' },
  });

  const mutation = useMutation({
    mutationFn: ({ password, ...values }: FormValues) =>
      user ? usersApi.update(user.id, values) : usersApi.create({ ...values, password: password ?? '' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(user ? 'Usuario actualizado.' : 'Usuario creado.');
      onDone();
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombres" required error={errors.firstName?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.firstName} {...register('firstName')} />}
        </Field>
        <Field label="Apellidos" required error={errors.lastName?.message}>
          {(id, d) => <Input id={id} aria-describedby={d} invalid={!!errors.lastName} {...register('lastName')} />}
        </Field>
      </div>

      <Field label="Correo electrónico" required error={errors.email?.message}>
        {(id, d) => (
          <Input id={id} type="email" aria-describedby={d} invalid={!!errors.email} {...register('email')} />
        )}
      </Field>

      {!user && (
        <Field
          label="Contraseña inicial"
          required
          hint="Mínimo 8 caracteres, con al menos una letra y un número."
          error={errors.password?.message}
        >
          {(id, d) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={d}
              invalid={!!errors.password}
              {...register('password')}
            />
          )}
        </Field>
      )}

      <Field label="Rol" required error={errors.role?.message}>
        {(id, d) => (
          <Select id={id} aria-describedby={d} {...register('role')}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {user ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}

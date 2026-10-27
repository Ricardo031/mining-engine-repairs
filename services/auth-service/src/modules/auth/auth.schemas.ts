import { z } from 'zod';
import { emailSchema } from '../users/users.schemas';

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(72),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

import { z } from 'zod';
import { USER_ROLES } from '../../db/entities/user.entity';

export const userRoleSchema = z.enum(USER_ROLES);

const nameSchema = z.string().trim().min(2, 'Must have at least 2 characters').max(80);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Must be a valid email address')
  .max(160);

/**
 * bcrypt only considers the first 72 bytes, so longer passwords are rejected
 * instead of silently truncated. A letter + a number keeps a minimum quality.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Must have at least 8 characters')
  .max(72, 'Must have at most 72 characters')
  .regex(/[A-Za-z]/, 'Must contain at least one letter')
  .regex(/\d/, 'Must contain at least one number');

export const createUserSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    role: userRoleSchema.default('operator'),
  })
  .strict();

export const updateUserSchema = z
  .object({
    email: emailSchema.optional(),
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const updateOwnProfileSchema = z
  .object({
    email: emailSchema.optional(),
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(72),
    newPassword: passwordSchema,
  })
  .strict();

export const userIdParamsSchema = z.object({
  id: z.uuid('Must be a valid user id'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(160).optional(),
  role: userRoleSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

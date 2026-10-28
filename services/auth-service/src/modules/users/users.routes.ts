import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { usersController } from './users.controller';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateOwnProfileSchema,
  updateUserSchema,
  userIdParamsSchema,
} from './users.schemas';

export const usersRouter = Router();

usersRouter.use(authenticate);

// --- Current user (any authenticated role) ---
usersRouter.get('/me', usersController.me);
usersRouter.patch('/me', validate({ body: updateOwnProfileSchema }), usersController.updateMe);
usersRouter.post(
  '/me/change-password',
  validate({ body: changePasswordSchema }),
  usersController.changeMyPassword,
);

// --- User administration (admin only) ---
usersRouter.get(
  '/',
  authorize('admin'),
  validate({ query: listUsersQuerySchema }),
  usersController.list,
);
usersRouter.post(
  '/',
  authorize('admin'),
  validate({ body: createUserSchema }),
  usersController.create,
);
usersRouter.get(
  '/:id',
  authorize('admin'),
  validate({ params: userIdParamsSchema }),
  usersController.getById,
);
usersRouter.patch(
  '/:id',
  authorize('admin'),
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.updateById,
);
usersRouter.delete(
  '/:id',
  authorize('admin'),
  validate({ params: userIdParamsSchema }),
  usersController.deactivate,
);

import type { Request, Response } from 'express';
import { requireUser } from '../../middlewares/authenticate';
import { validated } from '../../middlewares/validate';
import { type CreateUserInput } from '../users/users.schemas';
import { usersService } from '../users/users.service';
import type { LoginInput } from './auth.schemas';
import { authService } from './auth.service';

export const authController = {
  async login(_req: Request, res: Response): Promise<void> {
    const body = validated<LoginInput>(res, 'body');
    const result = await authService.login(body.email, body.password);

    res.status(200).json({ data: result });
  },

  /** Admin-only alias of POST /users, kept for the authentication flow. */
  async register(_req: Request, res: Response): Promise<void> {
    const body = validated<CreateUserInput>(res, 'body');
    const user = await usersService.create(body);

    res.status(201).json({ data: user });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await usersService.findById(requireUser(req).id);

    res.status(200).json({ data: user });
  },
};

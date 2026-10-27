import type { Request, Response } from 'express';
import { requireUser } from '../../middlewares/authenticate';
import { validated } from '../../middlewares/validate';
import type {
  ChangePasswordInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from './users.schemas';
import { usersService } from './users.service';

export const usersController = {
  async create(_req: Request, res: Response): Promise<void> {
    const body = validated<CreateUserInput>(res, 'body');
    const user = await usersService.create(body);

    res.status(201).json({ data: user });
  },

  async list(_req: Request, res: Response): Promise<void> {
    const query = validated<ListUsersQuery>(res, 'query');
    const result = await usersService.list(query);

    res.status(200).json(result);
  },

  async getById(_req: Request, res: Response): Promise<void> {
    const { id } = validated<{ id: string }>(res, 'params');
    const user = await usersService.findById(id);

    res.status(200).json({ data: user });
  },

  async me(req: Request, res: Response): Promise<void> {
    const actor = requireUser(req);
    const user = await usersService.findById(actor.id);

    res.status(200).json({ data: user });
  },

  async updateById(req: Request, res: Response): Promise<void> {
    const { id } = validated<{ id: string }>(res, 'params');
    const body = validated<UpdateUserInput>(res, 'body');
    const user = await usersService.update(id, body, requireUser(req));

    res.status(200).json({ data: user });
  },

  async updateMe(req: Request, res: Response): Promise<void> {
    const body = validated<UpdateOwnProfileInput>(res, 'body');
    const user = await usersService.update(requireUser(req).id, body, requireUser(req));

    res.status(200).json({ data: user });
  },

  async changeMyPassword(req: Request, res: Response): Promise<void> {
    const body = validated<ChangePasswordInput>(res, 'body');
    await usersService.changePassword(requireUser(req).id, body);

    res.status(204).send();
  },

  async deactivate(req: Request, res: Response): Promise<void> {
    const { id } = validated<{ id: string }>(res, 'params');
    const user = await usersService.deactivate(id, requireUser(req));

    res.status(200).json({ data: user });
  },
};

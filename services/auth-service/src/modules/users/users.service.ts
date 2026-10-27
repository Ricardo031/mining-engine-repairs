import type { AuthenticatedUser } from '../auth/auth.types';
import { AppError } from '../../common/errors';
import {
  buildPaginationMeta,
  getPaginationOffset,
  type PaginatedResult,
} from '../../common/pagination';
import { AppDataSource } from '../../config/data-source';
import { User } from '../../db/entities/user.entity';
import { hashPassword, verifyPassword } from '../../utils/password';
import type {
  ChangePasswordInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateOwnProfileInput,
  UpdateUserInput,
} from './users.schemas';
import type { PublicUser } from './users.types';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export class UsersService {
  private get repository() {
    return AppDataSource.getRepository(User);
  }

  async create(input: CreateUserInput): Promise<PublicUser> {
    const email = input.email.toLowerCase();
    const emailTaken = await this.repository.exists({ where: { email } });

    if (emailTaken) {
      throw AppError.conflict('A user with that email already exists');
    }

    const user = this.repository.create({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    });

    await this.repository.save(user);

    return toPublicUser(user);
  }

  async list(query: ListUsersQuery): Promise<PaginatedResult<PublicUser>> {
    const qb = this.repository.createQueryBuilder('user');

    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${escapeLikePattern(query.search)}%` },
      );
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive: query.isActive });
    }

    const [users, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip(getPaginationOffset(query.page, query.limit))
      .take(query.limit)
      .getManyAndCount();

    return {
      data: users.map(toPublicUser),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findById(id: string): Promise<PublicUser> {
    return toPublicUser(await this.getEntityOrFail(id));
  }

  /** Includes the password hash; only for authentication flows. */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = :email', { email: email.toLowerCase() })
      .getOne();
  }

  async update(
    id: string,
    input: UpdateUserInput | UpdateOwnProfileInput,
    actor: AuthenticatedUser,
  ): Promise<PublicUser> {
    const user = await this.getEntityOrFail(id);

    if (input.email && input.email !== user.email) {
      const emailTaken = await this.repository.exists({ where: { email: input.email } });
      if (emailTaken) {
        throw AppError.conflict('A user with that email already exists');
      }
    }

    if ('role' in input && input.role !== undefined && input.role !== user.role) {
      if (actor.id === user.id) {
        throw AppError.forbidden('You cannot change your own role');
      }
    }

    if ('isActive' in input && input.isActive === false && actor.id === user.id) {
      throw AppError.forbidden('You cannot deactivate your own account');
    }

    if (input.email !== undefined) user.email = input.email;
    if (input.firstName !== undefined) user.firstName = input.firstName;
    if (input.lastName !== undefined) user.lastName = input.lastName;
    if ('role' in input && input.role !== undefined) user.role = input.role;
    if ('isActive' in input && input.isActive !== undefined) user.isActive = input.isActive;

    await this.repository.save(user);

    return toPublicUser(user);
  }

  async changePassword(id: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();

    if (!user) {
      throw AppError.notFound('User not found');
    }

    const currentPasswordMatches = await verifyPassword(input.currentPassword, user.passwordHash);

    if (!currentPasswordMatches) {
      throw AppError.unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');
    }

    if (await verifyPassword(input.newPassword, user.passwordHash)) {
      throw AppError.badRequest('The new password must be different from the current one');
    }

    user.passwordHash = await hashPassword(input.newPassword);
    await this.repository.save(user);
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.getEntityOrFail(id);

    if (actor.id === user.id) {
      throw AppError.forbidden('You cannot deactivate your own account');
    }

    if (!user.isActive) {
      return toPublicUser(user);
    }

    user.isActive = false;
    await this.repository.save(user);

    return toPublicUser(user);
  }

  private async getEntityOrFail(id: string): Promise<User> {
    const user = await this.repository.findOne({ where: { id } });

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return user;
  }
}

export const usersService = new UsersService();

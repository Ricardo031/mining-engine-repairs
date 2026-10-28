import { config } from '../config';
import { request, type QueryParams } from './http';
import type {
  AuthPaginationMeta,
  Client,
  Engine,
  IdentificationType,
  LoginResult,
  Order,
  OrderListItem,
  OrderStatus,
  OrdersSummary,
  Paginated,
  Role,
  User,
} from './types';

const auth = config.authApiUrl;
const repairs = config.repairsApiUrl;

type Data<T> = { data: T };

// --- auth-service -----------------------------------------------------------

export const authApi = {
  login: (email: string, password: string) =>
    request<Data<LoginResult>>(auth, '/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }).then((r) => r.data),

  me: () => request<Data<User>>(auth, '/auth/me').then((r) => r.data),
};

export interface UserCreateInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export type UserUpdateInput = Partial<Omit<UserCreateInput, 'password'>> & { isActive?: boolean };

export const usersApi = {
  list: (query: QueryParams) =>
    request<Paginated<User, AuthPaginationMeta>>(auth, '/users', { query }),
  create: (body: UserCreateInput) =>
    request<Data<User>>(auth, '/users', { method: 'POST', body }).then((r) => r.data),
  update: (id: string, body: UserUpdateInput) =>
    request<Data<User>>(auth, `/users/${id}`, { method: 'PATCH', body }).then((r) => r.data),
  deactivate: (id: string) =>
    request<Data<User>>(auth, `/users/${id}`, { method: 'DELETE' }).then((r) => r.data),
};

// --- repairs-service --------------------------------------------------------

export interface ClientInput {
  name: string;
  identification_type: IdentificationType;
  identification_number: string;
  email: string;
}

export const clientsApi = {
  list: (query: QueryParams) => request<Paginated<Client>>(repairs, '/clients', { query }),
  get: (id: string) => request<Data<Client>>(repairs, `/clients/${id}`).then((r) => r.data),
  create: (body: ClientInput) =>
    request<Data<Client>>(repairs, '/clients', { method: 'POST', body }).then((r) => r.data),
  update: (id: string, body: Partial<ClientInput> & { is_active?: boolean }) =>
    request<Data<Client>>(repairs, `/clients/${id}`, { method: 'PATCH', body }).then((r) => r.data),
};

export interface EngineInput {
  serial_number: string;
  manufacturer: string;
  model: string;
  engine_type: string;
  power: string;
  client_id: string;
}

export const enginesApi = {
  list: (query: QueryParams) => request<Paginated<Engine>>(repairs, '/engines', { query }),
  get: (id: string) => request<Data<Engine>>(repairs, `/engines/${id}`).then((r) => r.data),
  create: (body: EngineInput) =>
    request<Data<Engine>>(repairs, '/engines', { method: 'POST', body }).then((r) => r.data),
  update: (id: string, body: Partial<EngineInput> & { is_active?: boolean }) =>
    request<Data<Engine>>(repairs, `/engines/${id}`, { method: 'PATCH', body }).then((r) => r.data),
};

export interface OrderInput {
  engine_id: string;
  received_at: string;
  reported_problem: string;
  technician: string;
  estimated_delivery_date: string;
  diagnosis?: string;
  work_performed?: string;
  observations?: string;
}

export interface StatusChangeInput {
  status: OrderStatus;
  note?: string;
  actual_delivery_date?: string;
  diagnosis?: string;
  work_performed?: string;
  observations?: string;
}

export const ordersApi = {
  list: (query: QueryParams) => request<Paginated<OrderListItem>>(repairs, '/orders', { query }),
  /** `today` (YYYY-MM-DD, local time) so the dashboard numbers use the user's time zone. */
  summary: (today: string) =>
    request<Data<OrdersSummary>>(repairs, '/orders/summary', { query: { today } }).then((r) => r.data),
  get: (id: string) => request<Data<Order>>(repairs, `/orders/${id}`).then((r) => r.data),
  create: (body: OrderInput) =>
    request<Data<Order>>(repairs, '/orders', { method: 'POST', body }).then((r) => r.data),
  changeStatus: (id: string, body: StatusChangeInput) =>
    request<Data<Order>>(repairs, `/orders/${id}/status`, { method: 'PATCH', body }).then(
      (r) => r.data,
    ),
};

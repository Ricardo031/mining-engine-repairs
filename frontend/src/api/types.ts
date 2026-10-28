// Types mirror the JSON returned by both APIs.

export type Role = 'admin' | 'operator';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

/** auth-service uses camelCase pagination meta. */
export interface AuthPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** repairs-service uses snake_case pagination meta. */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T, M = PaginationMeta> {
  data: T[];
  meta: M;
}

export type IdentificationType = 'NIT' | 'CC' | 'CE' | 'PASSPORT';

export interface ClientSummary {
  id: string;
  name: string;
  identification_type: IdentificationType;
  identification_number: string;
}

export interface Client extends ClientSummary {
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngineSummary {
  id: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  engine_type: string;
  power: string;
}

export interface Engine extends EngineSummary {
  client: ClientSummary;
  registered_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const ORDER_STATUSES = [
  'RECEIVED',
  'IN_DIAGNOSIS',
  'AWAITING_APPROVAL',
  'IN_REPAIR',
  'IN_TESTING',
  'COMPLETED',
  'DELIVERED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface StatusHistoryEntry {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  changed_by: string;
  changed_by_email: string;
  changed_at: string;
}

export interface OrderListItem {
  id: string;
  order_number: string;
  status: OrderStatus;
  engine: EngineSummary;
  client: ClientSummary;
  technician: string;
  received_at: string;
  estimated_delivery_date: string;
  actual_delivery_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order extends OrderListItem {
  reported_problem: string;
  diagnosis: string | null;
  work_performed: string | null;
  observations: string | null;
  created_by: string;
  created_by_email: string;
  status_history: StatusHistoryEntry[];
  allowed_next_statuses: OrderStatus[];
}

export interface OrdersSummary {
  today: string;
  total: number;
  by_status: { status: OrderStatus; count: number }[];
  /** Not delivered yet. */
  active: number;
  overdue: number;
  /** Active orders due today or in the next 6 days. */
  due_soon: number;
  delivered_this_month: number;
  delivered_last_month: number;
  received_last_7_days: number;
  received_previous_7_days: number;
  received_by_day: { date: string; count: number }[];
}

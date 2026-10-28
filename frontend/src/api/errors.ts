import { ApiError } from './http';

/** Known server messages (English) translated for the user. */
const KNOWN_MESSAGES: [RegExp, string][] = [
  [/invalid email or password/i, 'Correo o contraseña incorrectos.'],
  [/too many failed login attempts/i, 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.'],
  [/client with identification number/i, 'Ya existe un cliente con ese número de identificación.'],
  [/engine with serial number/i, 'Ya existe un motor con ese número de serie.'],
  [/user with that email/i, 'Ya existe un usuario con ese correo.'],
  [/already has an open repair order/i, 'Este motor ya tiene una orden de reparación abierta.'],
  [/order for an inactive engine/i, 'No se pueden crear órdenes para un motor inactivo.'],
  [/order for an inactive client/i, 'No se pueden crear órdenes para un cliente inactivo.'],
  [/engines can only be assigned to active clients/i, 'Solo se pueden asignar motores a clientes activos.'],
  [/invalid status change/i, 'Ese cambio de estado no está permitido.'],
  [/actual_delivery_date can only be set when delivering/i, 'La fecha de entrega solo se registra al entregar.'],
  [/cannot be before the reception date/i, 'La fecha de entrega no puede ser anterior a la de recepción.'],
  [/cannot change your own role/i, 'No puedes cambiar tu propio rol.'],
  [/cannot deactivate your own account/i, 'No puedes desactivar tu propia cuenta.'],
];

const BY_CODE: Record<string, string> = {
  NETWORK_ERROR: 'No hay conexión con el servidor. Verifica que los servicios estén en ejecución.',
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  UNAUTHORIZED: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  INVALID_TOKEN: 'Tu sesión no es válida. Inicia sesión de nuevo.',
  TOKEN_EXPIRED: 'Tu sesión expiró. Inicia sesión de nuevo.',
  FORBIDDEN: 'No tienes permisos para realizar esta acción.',
  NOT_FOUND: 'El registro no existe.',
  CONFLICT: 'El registro ya existe.',
  RATE_LIMITED: 'Demasiadas solicitudes. Espera un momento.',
  BUSINESS_RULE_VIOLATION: 'La operación no cumple las reglas del negocio.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado en el servidor.',
};

/** User friendly message (in Spanish) for any error thrown by the API layer. */
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Ocurrió un error inesperado.';

  for (const [pattern, message] of KNOWN_MESSAGES) {
    if (pattern.test(error.message)) return message;
  }
  return BY_CODE[error.code] ?? 'Ocurrió un error inesperado.';
}

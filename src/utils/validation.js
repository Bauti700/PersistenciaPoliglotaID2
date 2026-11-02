const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function errorValidacion(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function textoRequerido(valor, campo, { min = 1, max = 255 } = {}) {
  if (typeof valor !== 'string') {
    throw errorValidacion(`El campo ${campo} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (!limpio) {
    throw errorValidacion(`El campo ${campo} es obligatorio.`);
  }
  if (limpio.length < min) {
    throw errorValidacion(`El campo ${campo} debe tener al menos ${min} caracteres.`);
  }
  if (limpio.length > max) {
    throw errorValidacion(`El campo ${campo} no puede superar los ${max} caracteres.`);
  }
  return limpio;
}

export function textoOpcional(valor, campo, { min = 0, max = 255 } = {}) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw errorValidacion(`El campo ${campo} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (!limpio) return null;
  if (limpio.length < min) {
    throw errorValidacion(`El campo ${campo} debe tener al menos ${min} caracteres.`);
  }
  if (limpio.length > max) {
    throw errorValidacion(`El campo ${campo} no puede superar los ${max} caracteres.`);
  }
  return limpio;
}

export function emailValido(valor, campo = 'email') {
  const limpio = textoRequerido(valor, campo, { max: 100 }).toLowerCase();
  if (!EMAIL_REGEX.test(limpio)) {
    throw errorValidacion(`El campo ${campo} no tiene un formato válido.`);
  }
  return limpio;
}

export function cuitValido(valor) {
  const limpio = textoRequerido(valor, 'cuit', { max: 20 });
  if (!/^[0-9-]{8,20}$/.test(limpio)) {
    throw errorValidacion('El CUIT debe contener solo números y guiones (ej: 30-12345678-9).');
  }
  return limpio;
}

export function enteroPositivo(valor, campo, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < min || numero > max) {
    throw errorValidacion(`El campo ${campo} debe ser un entero entre ${min} y ${max}.`);
  }
  return numero;
}

export function numeroPositivo(valor, campo, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < min || numero > max) {
    throw errorValidacion(`El campo ${campo} debe ser un número entre ${min} y ${max}.`);
  }
  return numero;
}

export function unoDe(valor, permitidos, campo) {
  const normalizado = String(valor || '').trim().toUpperCase();
  if (!permitidos.includes(normalizado)) {
    throw errorValidacion(`El campo ${campo} es inválido. Valores permitidos: ${permitidos.join(', ')}.`);
  }
  return normalizado;
}

export function idTexto(valor, campo = 'id') {
  return textoRequerido(valor, campo, { max: 50 });
}

export function objetoJson(valor, campo = 'permisos') {
  if (valor === undefined || valor === null || valor === '') return {};
  if (typeof valor === 'object' && !Array.isArray(valor)) return valor;
  try {
    const parseado = JSON.parse(valor);
    if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) {
      throw new Error('no es un objeto');
    }
    return parseado;
  } catch {
    throw errorValidacion(`El campo ${campo} debe ser un objeto JSON válido.`);
  }
}

export function booleano(valor, campo = 'activa') {
  if (typeof valor === 'boolean') return valor;
  const normalizado = String(valor || '').trim().toLowerCase();
  if (['true', '1', 's', 'si', 'sí'].includes(normalizado)) return true;
  if (['false', '0', 'n', 'no'].includes(normalizado)) return false;
  throw errorValidacion(`El campo ${campo} debe ser booleano.`);
}

// ---------------------------------------------------------------------------
// Validaciones del módulo comercial / financiero
// ---------------------------------------------------------------------------

export const TIPOS_ACTOR_FINANCIERO = ['CLIENTE', 'PROVEEDOR', 'OPERADOR'];
export const TIPOS_FACTURA = ['EMITIDA', 'RECIBIDA'];
export const ESTADOS_FACTURA = ['PENDIENTE', 'PAGADA', 'ANULADA'];
export const MEDIOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA_BANCARIA', 'TARJETA', 'CHEQUE'];

/**
 * Valida un importe monetario positivo (máximo compatible con NUMERIC(12,2)).
 */
export function montoPositivo(valor, campo = 'importe') {
  return numeroPositivo(valor, campo, { min: 0.01, max: 9999999999.99 });
}

/**
 * Valida una fecha en formato YYYY-MM-DD y devuelve el texto normalizado.
 * Rechaza fechas inexistentes como 2026-02-31.
 */
export function fechaValida(valor, campo = 'fecha') {
  const limpio = textoRequerido(valor, campo, { max: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    throw errorValidacion(`El campo ${campo} debe tener formato YYYY-MM-DD.`);
  }
  const [anio, mes, dia] = limpio.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw errorValidacion(`El campo ${campo} no es una fecha válida.`);
  }
  return limpio;
}

/**
 * Valida un período contable en formato YYYY-MM.
 */
export function periodoMensual(valor, campo = 'periodo') {
  const limpio = textoRequerido(valor, campo, { max: 7 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(limpio)) {
    throw errorValidacion(`El campo ${campo} debe tener formato YYYY-MM (ej: 2026-10).`);
  }
  return limpio;
}

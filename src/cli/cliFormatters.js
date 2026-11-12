const locale = 'es-AR';

// Función para formatear fechas en un formato legible según la configuración regional 'es-AR'. Si el valor es inválido o nulo, devuelve un guion '-'.
export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

// Función para formatear valores monetarios en la configuración regional 'es-AR'. Si el valor es inválido o nulo, devuelve un guion '-'.
export function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(locale, { style: 'currency', currency: 'ARS' })
    : '-';
}

// Función para formatear números en la configuración regional 'es-AR', con un número específico de decimales. Si el valor es inválido o nulo, devuelve un guion '-'.
export function formatNumber(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    : '-';
}

// Función para formatear valores booleanos, devolviendo 'Sí' para true y 'No' para false. Si el valor es nulo o indefinido, devuelve un guion '-'.
export function formatJson(value) {
  if (value === null || value === undefined) return '-';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// Función para formatear filas de una tabla, aplicando el formateo adecuado a cada valor según su tipo. Devuelve un array de valores formateados.
export function formatTableRows(rows) {
  return rows.map(row => formatTableValue(row, false));
}

// Función recursiva para formatear valores de una tabla, manejando tipos primitivos, arrays y objetos. Devuelve el valor formateado según su tipo.
function formatTableValue(value, nested) {
  if (value === null || value === undefined) return '-';
  if (typeof value.toNumber === 'function') return value.toNumber();
  if (Array.isArray(value)) {
    const formatted = value.map(item => formatTableValue(item, true));
    return nested ? JSON.stringify(formatted) : formatted;
  }
  if (typeof value === 'object') {
    const formatted = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, formatTableValue(item, true)])
    );
    return nested ? JSON.stringify(formatted) : formatted;
  }
  return value;
}

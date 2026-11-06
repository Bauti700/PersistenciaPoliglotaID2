const locale = 'es-AR';

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(locale, { style: 'currency', currency: 'ARS' })
    : '-';
}

export function formatNumber(value, decimals = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    : '-';
}

export function formatJson(value) {
  if (value === null || value === undefined) return '-';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function formatTableRows(rows) {
  return rows.map(row => formatTableValue(row, false));
}

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

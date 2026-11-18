import { columns } from '../data.mjs';

const COLUMN_BY_KEY = new Map(columns.map((column) => [column.key, column]));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const isMissing = (value) => value === null || value === undefined;

export function filterRows(rows, { region = '', minTemp = null, text = '' } = {}) {
  const needle = String(text ?? '').trim().toLowerCase();
  const minimum = toNumberOrNull(minTemp);
  return rows.filter((row) => {
    if (region && region !== 'all' && row.region !== region) return false;
    if (minimum !== null && !(row.temp >= minimum)) return false;
    if (needle && !row.station.toLowerCase().includes(needle)) return false;
    return true;
  });
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (ISO_DATE.test(a) && ISO_DATE.test(b)) return Date.parse(a) - Date.parse(b);
  return collator.compare(String(a), String(b));
}

// Stable: equal values keep their input order in both directions. Missing values sort last.
export function sortRows(rows, key, direction = 'ascending') {
  const indexed = rows.map((row, index) => ({ row, index }));
  if (!key || (direction !== 'ascending' && direction !== 'descending')) {
    return indexed.map((entry) => entry.row);
  }
  const sign = direction === 'descending' ? -1 : 1;
  indexed.sort((a, b) => {
    const x = a.row[key];
    const y = b.row[key];
    const xMissing = isMissing(x);
    const yMissing = isMissing(y);
    if (xMissing || yMissing) {
      if (xMissing && yMissing) return a.index - b.index;
      return xMissing ? 1 : -1;
    }
    const result = compareValues(x, y);
    return result !== 0 ? result * sign : a.index - b.index;
  });
  return indexed.map((entry) => entry.row);
}

const round = (value, digits) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export function summarise(rows) {
  if (rows.length === 0) {
    return { count: 0, minTemp: null, maxTemp: null, meanTemp: null, totalRain: null, maxWind: null };
  }
  let minTemp = Infinity;
  let maxTemp = -Infinity;
  let tempSum = 0;
  let rainSum = 0;
  let maxWind = -Infinity;
  for (const row of rows) {
    minTemp = Math.min(minTemp, row.temp);
    maxTemp = Math.max(maxTemp, row.temp);
    tempSum += row.temp;
    rainSum += row.rain;
    maxWind = Math.max(maxWind, row.wind);
  }
  return {
    count: rows.length,
    minTemp,
    maxTemp,
    meanTemp: round(tempSum / rows.length, 1),
    totalRain: round(rainSum, 1),
    maxWind,
  };
}

export function columnHeading(key) {
  const column = COLUMN_BY_KEY.get(key);
  if (!column) return String(key);
  return column.unit ? `${column.label} (${column.unit})` : column.label;
}

export function describeSort(key, direction) {
  const column = COLUMN_BY_KEY.get(key);
  if (!column || (direction !== 'ascending' && direction !== 'descending')) return 'not sorted';
  return `sorted by ${column.label} ${direction}`;
}

export function describeResults(shown, total, key, direction) {
  const base = `${shown} of ${total} rows shown, ${describeSort(key, direction)}`;
  return shown === 0 ? `${base}. No rows match the current filters.` : base;
}

const formatters = new Map();

// Uses U+2212 for negatives so screen readers say "minus" rather than skipping a hyphen.
export function formatNumber(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a';
  if (!formatters.has(digits)) {
    formatters.set(
      digits,
      new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }),
    );
  }
  const visible = Math.abs(value) < 0.5 * 10 ** -digits ? 0 : value;
  return formatters.get(digits).format(visible).replace('-', '\u2212');
}

// Returns the new cell position for a navigation key, or null when the key is not one of ours.
export function moveCell(position, key, rowCount, colCount, pageSize = 10) {
  if (rowCount <= 0 || colCount <= 0) return null;
  const lastRow = rowCount - 1;
  const lastCol = colCount - 1;
  const clamp = (value, max) => Math.min(Math.max(value, 0), max);
  switch (key) {
    case 'ArrowUp':
      return { row: clamp(position.row - 1, lastRow), col: position.col };
    case 'ArrowDown':
      return { row: clamp(position.row + 1, lastRow), col: position.col };
    case 'ArrowLeft':
      return { row: position.row, col: clamp(position.col - 1, lastCol) };
    case 'ArrowRight':
      return { row: position.row, col: clamp(position.col + 1, lastCol) };
    case 'Home':
      return { row: position.row, col: 0 };
    case 'End':
      return { row: position.row, col: lastCol };
    case 'PageUp':
      return { row: clamp(position.row - pageSize, lastRow), col: position.col };
    case 'PageDown':
      return { row: clamp(position.row + pageSize, lastRow), col: position.col };
    default:
      return null;
  }
}

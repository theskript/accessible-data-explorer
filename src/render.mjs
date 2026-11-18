import { columns } from '../data.mjs';
import { columnHeading, formatNumber, summarise } from './logic.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SORT_ICONS = { ascending: '\u25B2', descending: '\u25BC', none: '\u2195' };
const CHART_TITLE = 'Rainfall against temperature for the weather-station readings';

export const REGIONS = [
  { code: 'R1', shape: 'circle' },
  { code: 'R2', shape: 'square' },
  { code: 'R3', shape: 'triangle' },
  { code: 'R4', shape: 'diamond' },
];

function create(doc, tag, props = {}, text) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

function createSvg(doc, tag, props = {}, text) {
  const node = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(props)) {
    if (value !== undefined && value !== null) node.setAttribute(name, String(value));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

const r2 = (value) => Math.round(value * 100) / 100;

function cellText(column, row) {
  return column.type === 'number' ? formatNumber(row[column.key], column.digits) : String(row[column.key]);
}

function buildTable(doc, container) {
  const table = create(doc, 'table', { class: 'data-table' });
  if (doc.getElementById('table-hint')) table.setAttribute('aria-describedby', 'table-hint');
  table.append(create(doc, 'caption'));
  const headRow = create(doc, 'tr');
  for (const column of columns) {
    const th = create(doc, 'th', {
      scope: 'col',
      'data-key': column.key,
      class: column.type === 'number' ? 'num' : undefined,
    });
    const button = create(doc, 'button', { type: 'button', class: 'sort-button' });
    button.append(
      doc.createTextNode(columnHeading(column.key)),
      create(doc, 'span', { class: 'sort-icon', 'aria-hidden': 'true' }, SORT_ICONS.none),
    );
    th.append(button);
    headRow.append(th);
  }
  const thead = create(doc, 'thead');
  thead.append(headRow);
  table.append(thead, create(doc, 'tbody'));
  container.replaceChildren(table);
  return table;
}

// state: { rows, total, sortKey, sortDirection, active: { row, col } }
export function renderTable(doc, container, state) {
  const table = container.querySelector('table') ?? buildTable(doc, container);
  table.querySelector('caption').textContent =
    `Weather-station readings (invented data): ${state.rows.length} of ${state.total} rows shown`;

  for (const th of table.querySelectorAll('thead th')) {
    const icon = th.querySelector('.sort-icon');
    const sorted =
      th.dataset.key === state.sortKey &&
      (state.sortDirection === 'ascending' || state.sortDirection === 'descending');
    if (sorted) {
      th.setAttribute('aria-sort', state.sortDirection);
      icon.textContent = SORT_ICONS[state.sortDirection];
    } else {
      th.removeAttribute('aria-sort');
      icon.textContent = SORT_ICONS.none;
    }
  }

  const tbody = table.querySelector('tbody');
  if (state.rows.length === 0) {
    const tr = create(doc, 'tr');
    tr.append(create(doc, 'td', { colspan: columns.length, class: 'empty' }, 'No rows match the current filters.'));
    tbody.replaceChildren(tr);
    return table;
  }

  const active = {
    row: Math.min(Math.max(state.active?.row ?? 0, 0), state.rows.length - 1),
    col: Math.min(Math.max(state.active?.col ?? 0, 0), columns.length - 1),
  };
  const body = state.rows.map((row, r) => {
    const tr = create(doc, 'tr');
    columns.forEach((column, c) => {
      const isRowHeader = c === 0;
      const cell = create(doc, isRowHeader ? 'th' : 'td', {
        scope: isRowHeader ? 'row' : undefined,
        tabindex: r === active.row && c === active.col ? 0 : -1,
        'data-row': r,
        'data-col': c,
        class: column.type === 'number' ? 'num' : undefined,
      });
      cell.textContent = cellText(column, row);
      tr.append(cell);
    });
    return tr;
  });
  tbody.replaceChildren(...body);
  return table;
}

// Keeps exactly one body cell in the tab order; returns that cell.
export function setActiveCell(container, position, focus = false) {
  let target = null;
  for (const cell of container.querySelectorAll('tbody [data-row]')) {
    const on = Number(cell.dataset.row) === position.row && Number(cell.dataset.col) === position.col;
    cell.setAttribute('tabindex', on ? '0' : '-1');
    if (on) target = cell;
  }
  if (target && focus) target.focus();
  return target;
}

function withUnit(value, unit, digits = 1) {
  return value === null ? 'n/a' : `${formatNumber(value, digits)} ${unit}`;
}

export function renderSummary(doc, container, rows) {
  const s = summarise(rows);
  const items = [
    ['Readings', String(s.count)],
    ['Mean temperature', withUnit(s.meanTemp, '°C')],
    ['Lowest temperature', withUnit(s.minTemp, '°C')],
    ['Highest temperature', withUnit(s.maxTemp, '°C')],
    ['Total rainfall', withUnit(s.totalRain, 'mm')],
    ['Highest wind', withUnit(s.maxWind, 'km/h', 0)],
  ];
  container.replaceChildren(
    ...items.map(([term, value]) => {
      const group = create(doc, 'div');
      group.append(create(doc, 'dt', {}, term), create(doc, 'dd', {}, value));
      return group;
    }),
  );
}

export function niceTicks(min, max, target = 5) {
  const span = max - min || 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
  const start = Math.floor(min / step) * step;
  const end = Math.max(Math.ceil(max / step) * step, start + step);
  const count = Math.round((end - start) / step);
  return Array.from({ length: count + 1 }, (_, i) => Number((start + i * step).toFixed(10)));
}

function markShape(doc, shape, cx, cy, index) {
  const props = { class: `mark mark-${index + 1}` };
  switch (shape) {
    case 'square':
      return createSvg(doc, 'rect', { ...props, x: r2(cx - 4.5), y: r2(cy - 4.5), width: 9, height: 9 });
    case 'triangle':
      return createSvg(doc, 'polygon', {
        ...props,
        points: `${r2(cx)},${r2(cy - 6)} ${r2(cx + 6)},${r2(cy + 5)} ${r2(cx - 6)},${r2(cy + 5)}`,
      });
    case 'diamond':
      return createSvg(doc, 'polygon', {
        ...props,
        points: `${r2(cx)},${r2(cy - 6.5)} ${r2(cx + 6.5)},${r2(cy)} ${r2(cx)},${r2(cy + 6.5)} ${r2(cx - 6.5)},${r2(cy)}`,
      });
    default:
      return createSvg(doc, 'circle', { ...props, cx: r2(cx), cy: r2(cy), r: 5 });
  }
}

function describeChart(rows) {
  if (rows.length === 0) return 'No readings match the current filters, so the chart is empty.';
  const s = summarise(rows);
  const maxRain = Math.max(...rows.map((row) => row.rain));
  const shapes = REGIONS.map((region) => `${region.code} ${region.shape}`).join(', ');
  return (
    `Scatter plot with one mark for each of ${rows.length} readings. ` +
    `The horizontal axis is temperature in degrees Celsius, from ${formatNumber(s.minTemp, 1)} to ${formatNumber(s.maxTemp, 1)}. ` +
    `The vertical axis is rainfall in millimetres, from 0 to ${formatNumber(maxRain, 1)}. ` +
    `Region is shown by mark shape: ${shapes}. ` +
    'The same values are listed in the data table after the chart.'
  );
}

function tickLabel(value) {
  return formatNumber(value, Number.isInteger(value) ? 0 : 1);
}

function buildSvg(doc, rows) {
  const width = 640;
  const height = 360;
  const margin = { left: 60, right: 20, top: 20, bottom: 56 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const s = summarise(rows);
  const xTicks = rows.length ? niceTicks(s.minTemp, s.maxTemp) : niceTicks(0, 10);
  const yTicks = niceTicks(0, rows.length ? Math.max(...rows.map((row) => row.rain)) : 10);
  const x0 = xTicks[0];
  const x1 = xTicks[xTicks.length - 1];
  const y0 = yTicks[0];
  const y1 = yTicks[yTicks.length - 1];
  const scaleX = (v) => margin.left + ((v - x0) / (x1 - x0)) * plotWidth;
  const scaleY = (v) => margin.top + plotHeight - ((v - y0) / (y1 - y0)) * plotHeight;

  const root = createSvg(doc, 'svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-labelledby': 'chart-title',
    'aria-describedby': 'chart-desc',
    class: 'chart-svg',
  });
  root.append(
    createSvg(doc, 'title', { id: 'chart-title' }, CHART_TITLE),
    createSvg(doc, 'desc', { id: 'chart-desc' }, describeChart(rows)),
  );

  const axes = createSvg(doc, 'g', { class: 'axes' });
  const baseY = margin.top + plotHeight;
  axes.append(
    createSvg(doc, 'line', { class: 'axis-line', x1: margin.left, y1: baseY, x2: margin.left + plotWidth, y2: baseY }),
    createSvg(doc, 'line', { class: 'axis-line', x1: margin.left, y1: margin.top, x2: margin.left, y2: baseY }),
  );
  for (const v of xTicks) {
    const x = r2(scaleX(v));
    axes.append(
      createSvg(doc, 'line', { class: 'axis-line', x1: x, y1: baseY, x2: x, y2: baseY + 5 }),
      createSvg(doc, 'text', { class: 'axis-text', x, y: baseY + 20, 'text-anchor': 'middle' }, tickLabel(v)),
    );
  }
  for (const v of yTicks) {
    const y = r2(scaleY(v));
    axes.append(
      createSvg(doc, 'line', { class: 'axis-line', x1: margin.left - 5, y1: y, x2: margin.left, y2: y }),
      createSvg(doc, 'text', { class: 'axis-text', x: margin.left - 10, y: r2(y + 4), 'text-anchor': 'end' }, tickLabel(v)),
    );
  }
  axes.append(
    createSvg(
      doc,
      'text',
      { class: 'axis-title', x: margin.left + plotWidth / 2, y: height - 10, 'text-anchor': 'middle' },
      'Temperature (°C)',
    ),
    createSvg(
      doc,
      'text',
      { class: 'axis-title', x: -(margin.top + plotHeight / 2), y: 16, 'text-anchor': 'middle', transform: 'rotate(-90)' },
      'Rainfall (mm)',
    ),
  );
  root.append(axes);

  const marks = createSvg(doc, 'g', { class: 'marks' });
  for (const row of rows) {
    const index = Math.max(0, REGIONS.findIndex((region) => region.code === row.region));
    marks.append(markShape(doc, REGIONS[index].shape, scaleX(row.temp), scaleY(row.rain), index));
  }
  root.append(marks);
  return root;
}

function buildLegend(doc) {
  const list = create(doc, 'ul', { class: 'legend' });
  REGIONS.forEach((region, index) => {
    const icon = createSvg(doc, 'svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
    icon.append(markShape(doc, region.shape, 8, 8, index));
    const item = create(doc, 'li');
    item.append(icon, create(doc, 'span', {}, `${region.code} (${region.shape})`));
    list.append(item);
  });
  return list;
}

function buildFallbackTable(doc, rows) {
  const wrap = create(doc, 'div', { class: 'visually-hidden' });
  const table = create(doc, 'table');
  table.append(create(doc, 'caption', {}, 'Chart data, one row for each plotted reading'));
  const headRow = create(doc, 'tr');
  const fields = columns.filter((column) => column.key !== 'wind');
  for (const column of fields) headRow.append(create(doc, 'th', { scope: 'col' }, columnHeading(column.key)));
  const thead = create(doc, 'thead');
  thead.append(headRow);
  const tbody = create(doc, 'tbody');
  if (rows.length === 0) {
    const tr = create(doc, 'tr');
    tr.append(create(doc, 'td', { colspan: fields.length }, 'No readings to chart.'));
    tbody.append(tr);
  }
  for (const row of rows) {
    const tr = create(doc, 'tr');
    fields.forEach((column, c) => {
      tr.append(
        c === 0
          ? create(doc, 'th', { scope: 'row' }, cellText(column, row))
          : create(doc, 'td', {}, cellText(column, row)),
      );
    });
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

export function renderChart(doc, container, rows) {
  const figure = create(doc, 'figure', { class: 'chart' });
  figure.append(
    buildSvg(doc, rows),
    buildLegend(doc),
    create(doc, 'figcaption', {}, 'Each mark is one reading. Region is shown by the shape and the colour of the mark.'),
    buildFallbackTable(doc, rows),
  );
  container.replaceChildren(figure);
  return figure;
}

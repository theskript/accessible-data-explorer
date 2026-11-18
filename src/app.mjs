import { rows as defaultRows, columns } from '../data.mjs';
import { filterRows, sortRows, describeResults, moveCell } from './logic.mjs';
import { renderTable, renderSummary, renderChart, setActiveCell } from './render.mjs';

const ANNOUNCE_DELAY_MS = 400;
const browserTimer = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) };

// timer: { set(fn, ms), clear(id) }. Tests pass a timer that never fires and call flush() themselves.
export function createApp(doc, { rows = defaultRows, timer = browserTimer } = {}) {
  const els = {
    form: doc.getElementById('filters'),
    region: doc.getElementById('region'),
    minTemp: doc.getElementById('min-temp'),
    text: doc.getElementById('text'),
    clear: doc.getElementById('clear'),
    status: doc.getElementById('status'),
    summary: doc.getElementById('summary'),
    table: doc.getElementById('table-container'),
    chart: doc.getElementById('chart-container'),
  };
  const state = {
    region: '',
    minTemp: '',
    text: '',
    sortKey: 'station',
    sortDirection: 'ascending',
    active: { row: 0, col: 0 },
  };
  let visible = [];
  let timerId = null;
  let pending = false;

  const message = () => describeResults(visible.length, rows.length, state.sortKey, state.sortDirection);

  function render() {
    visible = sortRows(filterRows(rows, state), state.sortKey, state.sortDirection);
    state.active = {
      row: Math.min(state.active.row, Math.max(visible.length - 1, 0)),
      col: state.active.col,
    };
    renderTable(doc, els.table, {
      rows: visible,
      total: rows.length,
      sortKey: state.sortKey,
      sortDirection: state.sortDirection,
      active: state.active,
    });
    renderSummary(doc, els.summary, visible);
    renderChart(doc, els.chart, visible);
  }

  // Writes the pending announcement to the live region now; returns the live region text.
  function flush() {
    if (timerId !== null) {
      timer.clear(timerId);
      timerId = null;
    }
    if (pending) {
      els.status.textContent = message();
      pending = false;
    }
    return els.status.textContent;
  }

  function scheduleAnnouncement() {
    pending = true;
    if (timerId !== null) timer.clear(timerId);
    timerId = timer.set(flush, ANNOUNCE_DELAY_MS);
  }

  function readFilters() {
    const next = { region: els.region.value, minTemp: els.minTemp.value, text: els.text.value };
    if (next.region === state.region && next.minTemp === state.minTemp && next.text === state.text) return;
    Object.assign(state, next);
    state.active = { row: 0, col: 0 };
    render();
    scheduleAnnouncement();
  }

  els.form.addEventListener('input', readFilters);
  els.form.addEventListener('change', readFilters);
  els.form.addEventListener('submit', (event) => event.preventDefault());
  els.clear.addEventListener('click', () => {
    els.region.value = '';
    els.minTemp.value = '';
    els.text.value = '';
    readFilters();
  });

  els.table.addEventListener('click', (event) => {
    const button = event.target.closest('.sort-button');
    if (!button) return;
    const key = button.closest('th').dataset.key;
    if (key === state.sortKey) {
      state.sortDirection = state.sortDirection === 'ascending' ? 'descending' : 'ascending';
    } else {
      state.sortKey = key;
      state.sortDirection = 'ascending';
    }
    render();
    scheduleAnnouncement();
  });

  els.table.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const cell = event.target.closest('[data-row]');
    if (!cell) return;
    const next = moveCell(
      { row: Number(cell.dataset.row), col: Number(cell.dataset.col) },
      event.key,
      visible.length,
      columns.length,
    );
    if (!next) return;
    event.preventDefault();
    state.active = next;
    setActiveCell(els.table, next, true);
  });

  els.table.addEventListener('focusin', (event) => {
    const cell = event.target.closest('[data-row]');
    if (!cell) return;
    state.active = { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
    setActiveCell(els.table, state.active, false);
  });

  render();
  els.status.textContent = message();

  return {
    flush,
    getState: () => ({ ...state, active: { ...state.active } }),
    getVisibleRows: () => visible.slice(),
  };
}

if (typeof document !== 'undefined') createApp(document);

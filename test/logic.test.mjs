import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRows,
  sortRows,
  summarise,
  describeSort,
  describeResults,
  formatNumber,
  columnHeading,
  moveCell,
} from '../src/logic.mjs';
import { niceTicks } from '../src/render.mjs';
import { rows as data, generateRows } from '../data.mjs';

const sample = [
  { id: 1, station: 'Alder', region: 'R1', date: '2026-03-02', temp: 5.5, rain: 0, wind: 10 },
  { id: 2, station: 'birch', region: 'R2', date: '2026-03-09', temp: -1.0, rain: 3.2, wind: 25 },
  { id: 3, station: 'Cedar', region: 'R1', date: '2026-03-02', temp: 5.5, rain: 12.0, wind: 5 },
  { id: 4, station: 'Dune', region: 'R3', date: '2026-02-28', temp: 20.1, rain: 0, wind: 40 },
  { id: 5, station: 'elm', region: 'R2', date: '2026-03-16', temp: 12.0, rain: 7.5, wind: 25 },
];

const ids = (list) => list.map((row) => row.id);

test('filterRows with no criteria returns every row in a new array', () => {
  const result = filterRows(sample, {});
  assert.deepEqual(ids(result), [1, 2, 3, 4, 5]);
  assert.notEqual(result, sample);
  assert.deepEqual(ids(filterRows(sample)), [1, 2, 3, 4, 5]);
});

test('filterRows keeps only the chosen region', () => {
  assert.deepEqual(ids(filterRows(sample, { region: 'R1' })), [1, 3]);
  assert.deepEqual(ids(filterRows(sample, { region: 'R2' })), [2, 5]);
});

test('filterRows treats an empty region or "all" as every region', () => {
  assert.equal(filterRows(sample, { region: '' }).length, 5);
  assert.equal(filterRows(sample, { region: 'all' }).length, 5);
});

test('filterRows minimum temperature is inclusive', () => {
  assert.deepEqual(ids(filterRows(sample, { minTemp: 5.5 })), [1, 3, 4, 5]);
  assert.deepEqual(ids(filterRows(sample, { minTemp: 20.2 })), []);
});

test('filterRows accepts numeric strings and ignores blank or invalid minimums', () => {
  assert.deepEqual(ids(filterRows(sample, { minTemp: '12' })), [4, 5]);
  assert.equal(filterRows(sample, { minTemp: '' }).length, 5);
  assert.equal(filterRows(sample, { minTemp: null }).length, 5);
  assert.equal(filterRows(sample, { minTemp: 'abc' }).length, 5);
});

test('filterRows text match is case-insensitive and trims spaces', () => {
  assert.deepEqual(ids(filterRows(sample, { text: ' BIR ' })), [2]);
  assert.deepEqual(ids(filterRows(sample, { text: 'ED' })), [3]);
});

test('filterRows combines region, minimum temperature and text', () => {
  assert.deepEqual(ids(filterRows(sample, { region: 'R1', minTemp: 5.5, text: 'ced' })), [3]);
  assert.deepEqual(ids(filterRows(sample, { region: 'R2', minTemp: 5 })), [5]);
  assert.deepEqual(ids(filterRows(sample, { region: 'R3', text: 'alder' })), []);
});

test('filterRows returns an empty array when nothing matches', () => {
  assert.deepEqual(filterRows(sample, { text: 'zzz' }), []);
});

test('filterRows does not change its input', () => {
  const copy = structuredClone(sample);
  filterRows(sample, { region: 'R1', minTemp: 0, text: 'a' });
  assert.deepEqual(sample, copy);
});

test('sortRows sorts numbers ascending', () => {
  assert.deepEqual(ids(sortRows(sample, 'temp', 'ascending')), [2, 1, 3, 5, 4]);
});

test('sortRows sorts numbers descending', () => {
  assert.deepEqual(ids(sortRows(sample, 'temp', 'descending')), [4, 5, 1, 3, 2]);
});

test('sortRows is stable: ties keep input order in both directions', () => {
  assert.deepEqual(ids(sortRows(sample, 'wind', 'ascending')), [3, 1, 2, 5, 4]);
  assert.deepEqual(ids(sortRows(sample, 'wind', 'descending')), [4, 2, 5, 1, 3]);
});

test('sortRows compares numbers as numbers and text in natural order', () => {
  const numbers = [{ id: 1, v: 10 }, { id: 2, v: 9 }, { id: 3, v: 100 }];
  assert.deepEqual(ids(sortRows(numbers, 'v', 'ascending')), [2, 1, 3]);
  const names = [{ id: 1, v: 'a10' }, { id: 2, v: 'a2' }, { id: 3, v: 'a1' }];
  assert.deepEqual(ids(sortRows(names, 'v', 'ascending')), [3, 2, 1]);
});

test('sortRows text comparison ignores case and treats case-only differences as ties', () => {
  const shuffled = [sample[4], sample[2], sample[1], sample[3], sample[0]];
  assert.deepEqual(ids(sortRows(shuffled, 'station', 'ascending')), [1, 2, 3, 4, 5]);
  const tied = [{ id: 1, v: 'b' }, { id: 2, v: 'B' }];
  assert.deepEqual(ids(sortRows(tied, 'v', 'ascending')), [1, 2]);
  assert.deepEqual(ids(sortRows(tied, 'v', 'descending')), [1, 2]);
});

test('sortRows orders ISO dates chronologically', () => {
  assert.deepEqual(ids(sortRows(sample, 'date', 'ascending')), [4, 1, 3, 2, 5]);
  assert.deepEqual(ids(sortRows(sample, 'date', 'descending')), [5, 2, 1, 3, 4]);
});

test('sortRows returns a new array and keeps input order without a usable direction', () => {
  const copy = structuredClone(sample);
  const sorted = sortRows(sample, 'temp', 'descending');
  assert.notEqual(sorted, sample);
  assert.deepEqual(sample, copy);
  assert.deepEqual(ids(sortRows(sample, 'temp', 'none')), [1, 2, 3, 4, 5]);
  assert.deepEqual(ids(sortRows(sample, null, 'ascending')), [1, 2, 3, 4, 5]);
});

test('sortRows puts missing values last in both directions', () => {
  const gaps = [{ id: 1, v: 3 }, { id: 2, v: null }, { id: 3, v: 1 }, { id: 4 }];
  assert.deepEqual(ids(sortRows(gaps, 'v', 'ascending')), [3, 1, 2, 4]);
  assert.deepEqual(ids(sortRows(gaps, 'v', 'descending')), [1, 3, 2, 4]);
});

test('sortRows and filterRows handle empty input', () => {
  assert.deepEqual(sortRows([], 'temp', 'ascending'), []);
  assert.deepEqual(filterRows([], { region: 'R1', text: 'a', minTemp: 1 }), []);
});

test('summarise reports count, temperature range and mean, total rain and top wind', () => {
  assert.deepEqual(summarise(sample), {
    count: 5,
    minTemp: -1,
    maxTemp: 20.1,
    meanTemp: 8.4,
    totalRain: 22.7,
    maxWind: 40,
  });
});

test('summarise of no rows has a zero count and null values', () => {
  assert.deepEqual(summarise([]), {
    count: 0,
    minTemp: null,
    maxTemp: null,
    meanTemp: null,
    totalRain: null,
    maxWind: null,
  });
});

test('describeSort wording', () => {
  assert.equal(describeSort('temp', 'ascending'), 'sorted by Temperature ascending');
  assert.equal(describeSort('rain', 'descending'), 'sorted by Rainfall descending');
  assert.equal(describeSort(null, 'ascending'), 'not sorted');
  assert.equal(describeSort('temp', 'none'), 'not sorted');
  assert.equal(describeSort('nope', 'ascending'), 'not sorted');
});

test('describeResults wording, including the empty case', () => {
  assert.equal(describeResults(12, 60, 'temp', 'descending'), '12 of 60 rows shown, sorted by Temperature descending');
  assert.equal(describeResults(60, 60, null, null), '60 of 60 rows shown, not sorted');
  assert.equal(
    describeResults(0, 60, 'station', 'ascending'),
    '0 of 60 rows shown, sorted by Station ascending. No rows match the current filters.',
  );
});

test('formatNumber fixes decimals, groups thousands and writes a real minus sign', () => {
  assert.equal(formatNumber(1234.56, 1), '1,234.6');
  assert.equal(formatNumber(5, 1), '5.0');
  assert.equal(formatNumber(7.4, 0), '7');
  assert.equal(formatNumber(-3.2, 1), '\u22123.2');
  assert.equal(formatNumber(-0.04, 1), '0.0');
});

test('formatNumber returns n/a for missing or non-finite values', () => {
  assert.equal(formatNumber(null), 'n/a');
  assert.equal(formatNumber(undefined), 'n/a');
  assert.equal(formatNumber(NaN), 'n/a');
  assert.equal(formatNumber('7'), 'n/a');
});

test('columnHeading adds the unit when a column has one', () => {
  assert.equal(columnHeading('temp'), 'Temperature (°C)');
  assert.equal(columnHeading('wind'), 'Wind (km/h)');
  assert.equal(columnHeading('station'), 'Station');
  assert.equal(columnHeading('unknown'), 'unknown');
});

test('moveCell handles arrows, Home and End and stops at the edges', () => {
  assert.deepEqual(moveCell({ row: 0, col: 0 }, 'ArrowDown', 25, 6), { row: 1, col: 0 });
  assert.deepEqual(moveCell({ row: 0, col: 0 }, 'ArrowUp', 25, 6), { row: 0, col: 0 });
  assert.deepEqual(moveCell({ row: 3, col: 5 }, 'ArrowRight', 25, 6), { row: 3, col: 5 });
  assert.deepEqual(moveCell({ row: 3, col: 0 }, 'ArrowLeft', 25, 6), { row: 3, col: 0 });
  assert.deepEqual(moveCell({ row: 3, col: 2 }, 'End', 25, 6), { row: 3, col: 5 });
  assert.deepEqual(moveCell({ row: 3, col: 2 }, 'Home', 25, 6), { row: 3, col: 0 });
});

test('moveCell pages by 10 rows, clamps, and ignores other keys and empty tables', () => {
  assert.deepEqual(moveCell({ row: 0, col: 1 }, 'PageDown', 25, 6), { row: 10, col: 1 });
  assert.deepEqual(moveCell({ row: 20, col: 1 }, 'PageDown', 25, 6), { row: 24, col: 1 });
  assert.deepEqual(moveCell({ row: 5, col: 1 }, 'PageUp', 25, 6), { row: 0, col: 1 });
  assert.equal(moveCell({ row: 0, col: 0 }, 'a', 25, 6), null);
  assert.equal(moveCell({ row: 0, col: 0 }, 'ArrowDown', 0, 6), null);
});

test('niceTicks covers the data range with evenly spaced round values', () => {
  const ticks = niceTicks(-2.1, 7.3);
  assert.deepEqual(ticks, [-4, -2, 0, 2, 4, 6, 8]);
  assert.ok(ticks[0] <= -2.1 && ticks[ticks.length - 1] >= 7.3);
  const flat = niceTicks(5, 5);
  assert.ok(flat.length >= 2 && flat[0] <= 5 && flat[flat.length - 1] > flat[0]);
});

test('the invented data has 60 valid, unique rows and is reproducible', () => {
  assert.equal(data.length, 60);
  assert.equal(new Set(ids(data)).size, 60);
  assert.deepEqual([...new Set(data.map((row) => row.region))].sort(), ['R1', 'R2', 'R3', 'R4']);
  for (const row of data) {
    assert.match(row.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Number.isFinite(row.temp) && row.rain >= 0 && row.wind >= 0);
  }
  assert.deepEqual(generateRows(), data);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM, VirtualConsole } from 'jsdom';
import axe from 'axe-core';
import { createApp } from '../src/app.mjs';
import { rows as data } from '../data.mjs';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

// A timer that never fires: announcements are written only when a test calls flush().
const idleTimer = { set: () => 1, clear: () => {} };

function loadPage() {
  // jsdom prints "not implemented" for getComputedStyle(el, pseudo), which axe calls; keep the output clean.
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  dom.window.eval(axe.source);
  const app = createApp(dom.window.document, { timer: idleTimer });
  return { win: dom.window, doc: dom.window.document, app };
}

// color-contrast is disabled because jsdom does not compute layout or rendered colours; contrast is
// checked from the CSS custom properties in test/contrast.test.mjs. target-size is disabled for the same
// reason: it needs real element boxes, which jsdom reports as zero.
async function axeViolations(page) {
  const results = await page.win.axe.run(page.doc, {
    rules: { 'color-contrast': { enabled: false }, 'target-size': { enabled: false } },
    resultTypes: ['violations'],
  });
  return Array.from(results.violations, (v) => `${v.id}: ${Array.from(v.nodes, (n) => n.target.join(' ')).join(' | ')}`);
}

function setFilter(page, id, value, type = 'input') {
  const el = page.doc.getElementById(id);
  el.value = value;
  el.dispatchEvent(new page.win.Event(type, { bubbles: true }));
}

const clickSort = (page, key) => page.doc.querySelector(`th[data-key="${key}"] button`).click();
const cellAt = (page, row, col) => page.doc.querySelector(`tbody [data-row="${row}"][data-col="${col}"]`);
const status = (page) => page.doc.getElementById('status').textContent;
const sortedHeaders = (page) => Array.from(page.doc.querySelectorAll('thead th[aria-sort]'), (th) => `${th.dataset.key}:${th.getAttribute('aria-sort')}`);
const parseNumber = (text) => Number(text.replace('\u2212', '-').replace(/,/g, ''));

// Dispatches a keydown and returns true when the page called preventDefault.
function press(page, target, key) {
  const event = new page.win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

test('axe finds no violations in the initial state', async () => {
  const page = loadPage();
  const violations = await axeViolations(page);
  assert.equal(violations.length, 0, violations.join('\n'));
});

test('axe finds no violations after filtering', async () => {
  const page = loadPage();
  setFilter(page, 'region', 'R2', 'change');
  setFilter(page, 'min-temp', '10');
  setFilter(page, 'text', 'ridge');
  const violations = await axeViolations(page);
  assert.equal(violations.length, 0, violations.join('\n'));
});

test('axe finds no violations after sorting', async () => {
  const page = loadPage();
  clickSort(page, 'temp');
  clickSort(page, 'temp');
  clickSort(page, 'date');
  const violations = await axeViolations(page);
  assert.equal(violations.length, 0, violations.join('\n'));
});

test('axe finds no violations in the empty-result state', async () => {
  const page = loadPage();
  setFilter(page, 'text', 'no such station');
  assert.equal(page.doc.querySelectorAll('tbody [data-row]').length, 0);
  const violations = await axeViolations(page);
  assert.equal(violations.length, 0, violations.join('\n'));
});

test('the page has exactly one h1', () => {
  const page = loadPage();
  const h1 = page.doc.querySelectorAll('h1');
  assert.equal(h1.length, 1);
  assert.ok(h1[0].textContent.trim().length > 0);
});

test('the data table has a non-empty caption that follows the filters', () => {
  const page = loadPage();
  const caption = () => page.doc.querySelector('#table-container table > caption').textContent;
  assert.ok(caption().includes('60 of 60 rows shown'));
  setFilter(page, 'region', 'R1', 'change');
  assert.ok(caption().includes('15 of 60 rows shown'));
});

test('every th has a scope: col in the header and row in the body', () => {
  const page = loadPage();
  const headers = Array.from(page.doc.querySelectorAll('th'));
  assert.ok(headers.length > 0);
  for (const th of headers) assert.ok(['col', 'row'].includes(th.getAttribute('scope')), th.outerHTML);
  for (const th of page.doc.querySelectorAll('thead th')) assert.equal(th.getAttribute('scope'), 'col');
  for (const th of page.doc.querySelectorAll('#table-container tbody th')) assert.equal(th.getAttribute('scope'), 'row');
});

test('aria-sort is on exactly one header and moves with the sort', () => {
  const page = loadPage();
  assert.deepEqual(sortedHeaders(page), ['station:ascending']);
  clickSort(page, 'temp');
  assert.deepEqual(sortedHeaders(page), ['temp:ascending']);
  clickSort(page, 'temp');
  assert.deepEqual(sortedHeaders(page), ['temp:descending']);
  clickSort(page, 'station');
  assert.deepEqual(sortedHeaders(page), ['station:ascending']);
  assert.equal(page.doc.querySelectorAll('button[aria-sort]').length, 0);
});

test('sorting by a number column orders the visible rows numerically', () => {
  const page = loadPage();
  const column = () => Array.from(page.doc.querySelectorAll('tbody [data-col="3"]'), (td) => parseNumber(td.textContent));
  clickSort(page, 'temp');
  const ascending = column();
  assert.deepEqual(ascending, [...ascending].sort((a, b) => a - b));
  clickSort(page, 'temp');
  const descending = column();
  assert.deepEqual(descending, [...descending].sort((a, b) => b - a));
});

test('the live region starts with the full count and the default sort', () => {
  const page = loadPage();
  const region = page.doc.getElementById('status');
  assert.equal(region.getAttribute('aria-live'), 'polite');
  assert.equal(region.getAttribute('role'), 'status');
  assert.equal(status(page), '60 of 60 rows shown, sorted by Station ascending');
});

test('the live region announces a sort only after flush', () => {
  const page = loadPage();
  clickSort(page, 'temp');
  assert.equal(status(page), '60 of 60 rows shown, sorted by Station ascending');
  assert.equal(page.app.flush(), '60 of 60 rows shown, sorted by Temperature ascending');
  assert.equal(status(page), '60 of 60 rows shown, sorted by Temperature ascending');
  clickSort(page, 'temp');
  page.app.flush();
  assert.equal(status(page), '60 of 60 rows shown, sorted by Temperature descending');
});

test('the live region announces filter results, one message for several changes', () => {
  const page = loadPage();
  const r2 = data.filter((row) => row.region === 'R2').length;
  setFilter(page, 'region', 'R2', 'change');
  setFilter(page, 'text', 'e');
  const expected = data.filter((row) => row.region === 'R2' && row.station.toLowerCase().includes('e')).length;
  assert.ok(expected > 0 && expected <= r2);
  assert.equal(status(page), '60 of 60 rows shown, sorted by Station ascending');
  assert.equal(page.app.flush(), `${expected} of 60 rows shown, sorted by Station ascending`);
});

test('the live region reports an empty result and recovers when filters are cleared', () => {
  const page = loadPage();
  setFilter(page, 'text', 'zzz');
  assert.equal(page.app.flush(), '0 of 60 rows shown, sorted by Station ascending. No rows match the current filters.');
  page.doc.getElementById('clear').click();
  assert.equal(page.app.flush(), '60 of 60 rows shown, sorted by Station ascending');
  assert.equal(page.doc.getElementById('text').value, '');
  assert.equal(page.doc.getElementById('region').value, '');
  assert.equal(page.doc.querySelectorAll('tbody [data-row]').length, 60 * 6);
});

test('keyboard navigation moves focus between cells as specified', () => {
  const page = loadPage();
  cellAt(page, 0, 0).focus();
  assert.equal(page.doc.activeElement, cellAt(page, 0, 0));

  assert.equal(press(page, page.doc.activeElement, 'ArrowDown'), true);
  assert.equal(page.doc.activeElement, cellAt(page, 1, 0));
  press(page, page.doc.activeElement, 'ArrowRight');
  assert.equal(page.doc.activeElement, cellAt(page, 1, 1));
  press(page, page.doc.activeElement, 'End');
  assert.equal(page.doc.activeElement, cellAt(page, 1, 5));
  press(page, page.doc.activeElement, 'ArrowRight');
  assert.equal(page.doc.activeElement, cellAt(page, 1, 5));
  press(page, page.doc.activeElement, 'Home');
  assert.equal(page.doc.activeElement, cellAt(page, 1, 0));
  press(page, page.doc.activeElement, 'PageDown');
  assert.equal(page.doc.activeElement, cellAt(page, 11, 0));
  press(page, page.doc.activeElement, 'PageUp');
  assert.equal(page.doc.activeElement, cellAt(page, 1, 0));
  press(page, page.doc.activeElement, 'ArrowUp');
  press(page, page.doc.activeElement, 'ArrowUp');
  assert.equal(page.doc.activeElement, cellAt(page, 0, 0));
  for (let i = 0; i < 7; i += 1) press(page, page.doc.activeElement, 'PageDown');
  assert.equal(page.doc.activeElement, cellAt(page, 59, 0));
  assert.equal(press(page, page.doc.activeElement, 'a'), false);
});

test('the table body keeps a single tab stop through navigation, sorting and filtering', () => {
  const page = loadPage();
  const tabStops = () => Array.from(page.doc.querySelectorAll('#table-container tbody [tabindex="0"]'));
  const total = () => page.doc.querySelectorAll('#table-container tbody [data-row]').length;
  assert.equal(tabStops().length, 1);
  assert.equal(tabStops()[0], cellAt(page, 0, 0));

  cellAt(page, 0, 0).focus();
  press(page, page.doc.activeElement, 'ArrowDown');
  press(page, page.doc.activeElement, 'ArrowRight');
  assert.equal(tabStops().length, 1);
  assert.equal(tabStops()[0], cellAt(page, 1, 1));
  assert.equal(page.doc.querySelectorAll('#table-container tbody [tabindex="-1"]').length, total() - 1);

  clickSort(page, 'wind');
  assert.equal(tabStops().length, 1);
  assert.equal(tabStops()[0], cellAt(page, 1, 1));

  setFilter(page, 'region', 'R3', 'change');
  assert.equal(tabStops().length, 1);
  assert.equal(tabStops()[0], cellAt(page, 0, 0));
  assert.equal(total(), 15 * 6);
});

test('the chart has a title, a description and a data table with one row per reading', () => {
  const page = loadPage();
  const svg = page.doc.querySelector('figure.chart svg.chart-svg');
  assert.equal(svg.getAttribute('role'), 'img');
  const title = svg.querySelector(':scope > title');
  assert.ok(title.textContent.trim().length > 0);
  assert.equal(svg.getAttribute('aria-labelledby'), title.id);
  const desc = page.doc.getElementById(svg.getAttribute('aria-describedby'));
  assert.ok(desc.textContent.includes(`${data.length} readings`));
  const fallbackRows = page.doc.querySelectorAll('figure.chart .visually-hidden table tbody tr');
  assert.equal(fallbackRows.length, data.length);
  assert.ok(page.doc.querySelector('figure.chart .visually-hidden table > caption').textContent.length > 0);
  assert.equal(svg.querySelectorAll('.mark').length, data.length);
});

test('the chart and its data table follow the filters, and mark shapes differ by region', () => {
  const page = loadPage();
  setFilter(page, 'region', 'R1', 'change');
  const expected = data.filter((row) => row.region === 'R1').length;
  assert.equal(page.doc.querySelectorAll('figure.chart .visually-hidden tbody tr').length, expected);
  assert.equal(page.doc.querySelectorAll('figure.chart svg.chart-svg .mark').length, expected);
  setFilter(page, 'region', '', 'change');
  const tags = new Set(Array.from(page.doc.querySelectorAll('figure.chart svg.chart-svg .mark'), (m) => m.tagName));
  assert.ok(tags.size >= 3, 'circle, rect and polygon marks are all present');
  assert.equal(page.doc.querySelectorAll('.legend li').length, 4);
});

test('the page has a language, a skip link that reaches main, and one set of landmarks', () => {
  const page = loadPage();
  assert.equal(page.doc.documentElement.getAttribute('lang'), 'en');
  const skip = page.doc.querySelector('a.skip-link');
  assert.equal(skip.getAttribute('href'), '#main');
  assert.ok(page.doc.getElementById('main').matches('main'));
  assert.equal(page.doc.querySelectorAll('main').length, 1);
  assert.equal(page.doc.querySelectorAll('body > header').length, 1);
  assert.equal(page.doc.querySelectorAll('body > footer').length, 1);
  assert.equal(page.doc.querySelectorAll('[aria-live]').length, 1);
  for (const field of page.doc.querySelectorAll('input, select')) {
    assert.ok(page.doc.querySelector(`label[for="${field.id}"]`), `label for ${field.id}`);
  }
});

test('the page uses no inline handlers, no external requests and no pixel sizes in CSS', () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(css, /https?:\/\/|@import|url\(/i);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\d\s*px\b/);
});

test('the CSS declares focus-visible, reduced-motion, forced-colors and dark-scheme rules', () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*0\.1875rem solid var\(--focus\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s*\(forced-colors:\s*active\)/);
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)/);
});

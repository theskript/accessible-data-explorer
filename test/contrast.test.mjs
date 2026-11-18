import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { contrastRatio, parseHex, readPalette } from '../src/contrast.mjs';

const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
const palette = readPalette(css);

const TEXT_PAIRS = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text-muted', 'bg'],
  ['text-muted', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['on-accent', 'accent'],
];
const FOCUS_PAIRS = [
  ['focus', 'bg'],
  ['focus', 'surface'],
];
const MARK_PAIRS = ['chart-1', 'chart-2', 'chart-3', 'chart-4'].flatMap((mark) => [
  [mark, 'bg'],
  [mark, 'surface'],
]);
const BORDER_PAIRS = [
  ['border', 'bg'],
  ['border', 'surface'],
];

function assertAtLeast(colours, pairs, minimum) {
  for (const [foreground, background] of pairs) {
    assert.ok(colours[foreground], `--${foreground} is defined`);
    assert.ok(colours[background], `--${background} is defined`);
    const ratio = contrastRatio(colours[foreground], colours[background]);
    assert.ok(
      ratio >= minimum,
      `--${foreground} ${colours[foreground]} on --${background} ${colours[background]} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
    );
  }
}

test('contrastRatio matches known WCAG values', () => {
  assert.ok(Math.abs(contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  assert.equal(contrastRatio('#336699', '#336699'), 1);
  assert.equal(contrastRatio('#ffffff', '#000000'), contrastRatio('#000000', '#ffffff'));
  assert.ok(contrastRatio('#767676', '#ffffff') >= 4.5);
  assert.ok(contrastRatio('#777777', '#ffffff') < 4.5);
});

test('parseHex reads short and long forms and rejects anything else', () => {
  assert.deepEqual(parseHex('#fff'), [255, 255, 255]);
  assert.deepEqual(parseHex('#0b4f9c'), [11, 79, 156]);
  assert.throws(() => parseHex('rgb(0, 0, 0)'), /Not a hex colour/);
  assert.throws(() => parseHex('#12345'), /Not a hex colour/);
});

test('readPalette reads hex properties, applies dark overrides and ignores comments and non-hex values', () => {
  const sample = `
    /* --ignored: #123456; */
    :root { color-scheme: light dark; --bg: #fff; --text: #111111; --gap: 1rem; }
    @media (prefers-color-scheme: dark) { :root { --bg: #000000; } }
    body { color: var(--text); }
  `;
  const result = readPalette(sample);
  assert.deepEqual(result.light, { bg: '#fff', text: '#111111' });
  assert.deepEqual(result.dark, { bg: '#000000', text: '#111111' });
  assert.equal(readPalette(':root { --bg: #fff; }').dark, null);
});

test('styles.css defines the full palette for the default and the dark scheme', () => {
  const keys = ['bg', 'surface', 'text', 'text-muted', 'accent', 'on-accent', 'focus', 'border', 'chart-1', 'chart-2', 'chart-3', 'chart-4'];
  assert.ok(palette.dark, 'a prefers-color-scheme: dark block exists');
  for (const key of keys) {
    assert.match(palette.light[key], /^#[0-9a-f]{6}$/i, `light --${key}`);
    assert.match(palette.dark[key], /^#[0-9a-f]{6}$/i, `dark --${key}`);
  }
  assert.notEqual(palette.light.bg, palette.dark.bg);
});

test('light palette: every text and background pair is at least 4.5:1', () => {
  assertAtLeast(palette.light, TEXT_PAIRS, 4.5);
});

test('dark palette: every text and background pair is at least 4.5:1', () => {
  assertAtLeast(palette.dark, TEXT_PAIRS, 4.5);
});

test('light palette: the focus outline is at least 3:1 against the page and surface colours', () => {
  assertAtLeast(palette.light, FOCUS_PAIRS, 3);
});

test('dark palette: the focus outline is at least 3:1 against the page and surface colours', () => {
  assertAtLeast(palette.dark, FOCUS_PAIRS, 3);
});

test('light palette: chart marks are at least 3:1 against the chart and page backgrounds', () => {
  assertAtLeast(palette.light, MARK_PAIRS, 3);
});

test('dark palette: chart marks are at least 3:1 against the chart and page backgrounds', () => {
  assertAtLeast(palette.dark, MARK_PAIRS, 3);
});

test('control and table borders are at least 3:1 in both palettes', () => {
  assertAtLeast(palette.light, BORDER_PAIRS, 3);
  assertAtLeast(palette.dark, BORDER_PAIRS, 3);
});

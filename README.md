# accessible-data-explorer

A small data explorer that works with a keyboard and a screen reader: a sortable and filterable table, a chart with a text alternative, and a results count that is announced politely. The data is invented: about 60 readings from 12 made-up weather stations in four regions (R1 to R4), generated from a fixed seed. It is a demonstration written from scratch; it contains no real, client or employer data.

The app has no runtime dependencies and no build step: one HTML file, one CSS file and plain ES modules. The only dev dependencies are `jsdom` and `axe-core`, used by the tests.

## What it demonstrates

- **Semantic table.** A real `<table>` with a `<caption>`, `<th scope="col">` column headers, a `<th scope="row">` station cell on each row, and `aria-sort` on the one sorted column header. Each header holds a real `<button>`, so sorting works with Enter and Space.
- **Keyboard model.** The table body has one tab stop (a roving tabindex) and arrow-key movement between cells; see the keyboard map below. The tab stop stays on the same cell when the table is sorted and returns to the first cell when a filter changes.
- **Live region.** A polite `role="status"` region announces, for example, `12 of 60 rows shown, sorted by Temperature ascending`. The announcement is debounced by 400 ms so typing in the filter does not announce every letter. `createApp` takes a `timer` option and returns `flush()`, so tests run without timers.
- **Text alternative for the chart.** The chart is an inline SVG with `role="img"`, a `<title>`, a `<desc>`, and a visually hidden data table with one row for each plotted reading. Regions are told apart by mark shape (circle, square, triangle, diamond) as well as colour, and the legend names the shapes.
- **Contrast checked by a script.** jsdom does not compute layout or colour, so axe's colour rules cannot run there. `src/contrast.mjs` reads the palette from the custom properties in `styles.css` (the default palette and the `prefers-color-scheme: dark` palette) and the tests compute WCAG contrast ratios.
- **Reduced motion, forced colours and no colour-only information.** Transitions and smooth scrolling are off under `prefers-reduced-motion: reduce`; `forced-colors: active` switches focus rings, marks and axes to system colours; sort direction is shown by a glyph and by `aria-sort`, and the chart uses shapes.
- **Sizes in rem, no external requests, no inline event handlers.** A test checks each of these.

## Run it

Requires Node.js 20 or later for the tests.

```sh
npm install
npm test
```

To open the page, serve the folder with any static server and open `index.html` (ES modules do not load from `file://`). For example:

```sh
npx http-server . -p 8080
```

## Keyboard map

| Where | Key | Result |
| --- | --- | --- |
| Anywhere | Tab | Skip link, filters, clear button, the sort buttons, the one table cell in the tab order, then the rest of the page |
| Skip link | Enter | Moves to the main content |
| Column header button | Enter or Space | Sorts by that column; a second press reverses the order |
| Table cell | Arrow Up / Arrow Down | Previous or next row, same column |
| Table cell | Arrow Left / Arrow Right | Previous or next column, same row |
| Table cell | Home / End | First or last column in the row |
| Table cell | Page Up / Page Down | 10 rows up or down, stopping at the first or last row |

Arrow keys stop at the edges; they do not wrap. Keys pressed with Ctrl, Alt or Meta are left to the browser.

## What the tests measure

`npm test` runs 60 tests with the Node test runner:

- `test/logic.test.mjs` (29 tests): the pure functions in `src/logic.mjs` on small fixed fixtures: filter combinations and blank or invalid values, ascending and descending sorts, stability on ties, numbers against text, case-insensitive text, ISO dates, missing values, empty input, the summary, the wording of the sort and result descriptions, number formatting, cell movement, chart tick values, and that the invented data has 60 valid rows and is reproducible.
- `test/a11y.test.mjs` (20 tests): the page loaded into jsdom with the app wired up. axe-core finds zero violations in the initial, filtered, sorted and empty-result states, with the `color-contrast` rule and `target-size` disabled because jsdom has no layout. Other tests assert one `h1`, a table caption, a scope on every `th`, `aria-sort` on exactly one header and its updates, the exact live-region text before and after `flush()`, the keyboard moves above, a single tab stop in the table body, the chart title, description and data-table fallback row count, labels, landmarks, and the absence of inline handlers, external URLs and pixel units.
- `test/contrast.test.mjs` (11 tests): the contrast function against known values, the palette reader, and every pair used in `styles.css` in both palettes: text pairs at 4.5:1 or more, focus outline, chart marks and control borders at 3:1 or more.

## What they do not show

- No real assistive-technology testing. Nothing here was run with a screen reader, screen magnifier, voice control or switch device, so how the announcements and the table are spoken in NVDA, JAWS, VoiceOver or TalkBack is not measured.
- axe cannot judge everything. It checks rules that can be tested by machine; it does not judge whether the labels, the wording or the reading order make sense, and its colour and target-size checks are off in jsdom.
- Contrast is computed from the CSS custom properties, not from rendered pixels. A colour set outside those properties, or an anti-aliased edge, is not covered, and the dark palette is checked only as values, not in a browser set to dark mode.
- No browser testing. Focus order, the forced-colors rendering and the reduced-motion behaviour are asserted in the CSS text or in jsdom, not observed in a browser.
- The chart text scales with the SVG, so on very narrow screens the axis labels get small; the table and the hidden data table carry the same information.

## Files

- `index.html`, `styles.css`: the page and its styles.
- `data.mjs`: the column definitions and the seeded generator for the invented readings.
- `src/logic.mjs`: filtering, stable sorting, summary, wording, number format and cell movement.
- `src/render.mjs`: the table, summary and chart, built with DOM calls from a document and a state.
- `src/app.mjs`: event wiring, roving tabindex, debounced live region.
- `src/contrast.mjs`: WCAG contrast ratio and the palette reader.
- `test/`: the three test files.

## Licence

MIT, see `LICENSE`.

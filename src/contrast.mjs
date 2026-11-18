export function parseHex(value) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!match) throw new Error(`Not a hex colour: ${value}`);
  let digits = match[1];
  if (digits.length === 3) digits = [...digits].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

function extractBlock(css, opener) {
  const match = opener.exec(css);
  if (!match) return null;
  const open = match.index + match[0].length;
  let depth = 1;
  let i = open;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return { body: css.slice(open, i - 1), start: match.index, end: i };
}

function readCustomProperties(body) {
  const properties = {};
  const pattern = /--([a-z0-9-]+)\s*:\s*(#(?:[0-9a-f]{6}|[0-9a-f]{3}))\s*;/gi;
  let match;
  while ((match = pattern.exec(body)) !== null) properties[match[1]] = match[2];
  return properties;
}

// Reads hex custom properties from the first :root block and from the dark-scheme media block.
// Returns { light, dark }; dark is the light palette with the dark overrides, or null if there is none.
export function readPalette(cssText) {
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const darkBlock = extractBlock(css, /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)\s*\{/);
  const base = darkBlock ? css.slice(0, darkBlock.start) + css.slice(darkBlock.end) : css;
  const root = extractBlock(base, /:root\s*\{/);
  const light = root ? readCustomProperties(root.body) : {};
  let dark = null;
  if (darkBlock) {
    const darkRoot = extractBlock(darkBlock.body, /:root\s*\{/);
    dark = { ...light, ...(darkRoot ? readCustomProperties(darkRoot.body) : {}) };
  }
  return { light, dark };
}

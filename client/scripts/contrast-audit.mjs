// Real WCAG 2.1 contrast-ratio audit over this app's actual token/color pairs --
// not a claim of "AAA-checked" without having run the math. Run with:
//   node scripts/contrast-audit.mjs
// Exits non-zero if any pair meant to carry body text fails its stated target.

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function relLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const l1 = relLuminance(hexToRgb(hex1));
  const l2 = relLuminance(hexToRgb(hex2));
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// Flattens an rgba() tint over a solid backing color -- StatusBadge.css's backgrounds
// are e.g. rgba(22, 163, 74, 0.09) over the page's white, not a solid hex, so computing
// against a guessed hex would be checking a color that isn't actually what renders.
function flattenOverWhite(r, g, b, alpha, backingHex = '#ffffff') {
  const backing = hexToRgb(backingHex);
  const blend = (fg, bgc) => Math.round(fg * alpha + bgc * (1 - alpha));
  const rr = blend(r, backing.r);
  const gg = blend(g, backing.g);
  const bb = blend(b, backing.b);
  return `#${[rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// Pairs actually used in the app for real text -- theme.css tokens, the high-contrast
// override palette (AccessibilityBar.css), and StatusBadge.css's five status-color
// variants (solid text color against the app's white page background, the context
// they're always rendered in).
const pairs = [
  // [label, foreground, background, target ('AA' 4.5:1 normal text, 'AA-large' 3:1, 'AAA' 7:1)]
  ['theme.css: --text-primary on --bg-primary', '#0f172a', '#ffffff', 'AAA'],
  ['theme.css: --text-secondary on --bg-primary', '#475569', '#ffffff', 'AA'],
  ['theme.css: --text-primary on --bg-secondary', '#0f172a', '#f8fafc', 'AAA'],
  // --accent and --accent-text share one value (theme.css) -- white-on-accent buttons
  // throughout the app and small accent-colored text both need real AA (4.5:1), not
  // the 3:1 large-text exemption; checking one value covers every call site.
  ['theme.css: --accent / --accent-text on --bg-primary', '#0278b5', '#ffffff', 'AA'],
  ['high-contrast: --text-primary on --bg-primary', '#000000', '#ffffff', 'AAA'],
  ['high-contrast: --text-secondary on --bg-primary', '#1a1a1a', '#ffffff', 'AAA'],
  ['high-contrast: --accent / --accent-text on --bg-primary', '#0050a0', '#ffffff', 'AA'],
  ['high-contrast: --status-success on white', '#0f5c2c', '#ffffff', 'AAA'],
  ['high-contrast: --status-warning on white', '#8a4004', '#ffffff', 'AAA'],
  ['high-contrast: --status-danger on white', '#8f1414', '#ffffff', 'AAA'],
  ['high-contrast: --status-info on white', '#024a70', '#ffffff', 'AAA'],
  ['StatusBadge green text on its own tinted bg', '#15803d', flattenOverWhite(22, 163, 74, 0.09), 'AA'],
  ['StatusBadge gray text on its own tinted bg', '#475569', flattenOverWhite(100, 116, 139, 0.1), 'AA'],
  ['StatusBadge amber text on its own tinted bg', '#b45309', flattenOverWhite(217, 119, 6, 0.1), 'AA'],
  ['StatusBadge red text on its own tinted bg', '#b91c1c', flattenOverWhite(220, 38, 38, 0.09), 'AA'],
  ['StatusBadge blue text on its own tinted bg', '#0369a1', flattenOverWhite(2, 132, 199, 0.09), 'AA'],
  ['AccessibilityBar: white text on #0f172a bar', '#f1f5f9', '#0f172a', 'AAA'],
];

const targets = { AA: 4.5, 'AA-large': 3, AAA: 7 };

let failures = 0;
console.log('WCAG 2.1 contrast audit\n');
for (const [label, fg, bg, target] of pairs) {
  const ratio = contrastRatio(fg, bg);
  const need = targets[target];
  const pass = ratio >= need;
  if (!pass) failures++;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${ratio.toFixed(2)}:1  (needs ${need}:1 for ${target})  -- ${label}`
  );
}

console.log(`\n${pairs.length - failures}/${pairs.length} pairs pass their stated target.`);
if (failures > 0) {
  console.log(`${failures} pair(s) FAILED -- fix the token before shipping.`);
  process.exit(1);
}

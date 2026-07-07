#!/usr/bin/env node
//
// Copyright 2026 DXOS.org
//

// Deterministic computed-style differ for the visual-verification skill.
//
// Compares expected values (harvested from / derived from a design mockup) against actual values
// (harvested from the running app via harvest-styles.js) and prints every property that diverges
// beyond tolerance. Pure Node, no dependencies. Exit code is the loop's pass/fail signal:
//   0 = all regions within tolerance, 1 = at least one delta, 2 = a mapped region was not found.
//
// Usage:
//   node diff-styles.mjs <mapping.json> <actual.json> [--json]
//
//   <mapping.json>  the per-view spec: { tolerances, regions:[{ name, app, expect:{prop:value} }] }
//   <actual.json>   harvest-styles.js output: { <regionName>: { <prop>: <value>, __box__, __missing__ } }

import { readFileSync } from 'node:fs';

const [, , mappingPath, actualPath, ...flags] = process.argv;
if (!mappingPath || !actualPath) {
  console.error('usage: node diff-styles.mjs <mapping.json> <actual.json> [--json]');
  process.exit(2);
}
const asJson = flags.includes('--json');

const mapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
const actual = JSON.parse(readFileSync(actualPath, 'utf8'));
const tol = { lengthPx: 1, colorChannel: 5, weight: 0, ...(mapping.tolerances ?? {}) };

// --- value parsers -------------------------------------------------------------------------------

const parseLength = (value) => {
  const match = /^(-?\d*\.?\d+)px$/.exec(String(value).trim());
  return match ? Number.parseFloat(match[1]) : Number.isFinite(+value) ? +value : undefined;
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const gamma = (channel) => (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);

// Björn Ottosson's OKLab → linear sRGB, then gamma-encode to 0–255. Used because Tailwind v4 emits
// oklch() palette values, which Chromium may serialize back as oklch()/oklab() in computed styles.
const oklabToRgb = (bigL, aa, bb) => {
  const l = (bigL + 0.3963377774 * aa + 0.2158037573 * bb) ** 3;
  const m = (bigL - 0.1055613458 * aa - 0.0638541728 * bb) ** 3;
  const s = (bigL - 0.0894841775 * aa - 1.291485548 * bb) ** 3;
  const r = gamma(clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s));
  const g = gamma(clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s));
  const b = gamma(clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const num = (token, scale = 1) => {
  const raw = String(token).trim();
  return raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * scale : Number.parseFloat(raw);
};

// Parse any CSS color the mockup or the browser can produce into an sRGB [r,g,b] triple, or
// undefined when the format is unrecognized (the caller then falls back to a string compare).
const parseColor = (value) => {
  const text = String(value).trim().toLowerCase();
  if (text === 'transparent') {
    return [0, 0, 0];
  }
  let match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(text);
  if (match) {
    const hex = match[1];
    const full = hex.length === 3 ? [...hex].map((ch) => ch + ch).join('') : hex;
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  }
  match = /^rgba?\(([^)]+)\)$/.exec(text);
  if (match) {
    const parts = match[1].split(/[,\s/]+/).filter(Boolean);
    return [num(parts[0]), num(parts[1]), num(parts[2])].map(Math.round);
  }
  match = /^oklch\(([^)]+)\)$/.exec(text);
  if (match) {
    const [bigL, chroma, hue] = match[1].split(/[,\s/]+/).filter(Boolean);
    const bigLv = num(bigL, 1);
    const cv = num(chroma, 0.4);
    const hv = (Number.parseFloat(hue) * Math.PI) / 180;
    return oklabToRgb(bigLv, cv * Math.cos(hv), cv * Math.sin(hv));
  }
  match = /^oklab\(([^)]+)\)$/.exec(text);
  if (match) {
    const [bigL, aa, bb] = match[1].split(/[,\s/]+/).filter(Boolean);
    return oklabToRgb(num(bigL, 1), Number.parseFloat(aa), Number.parseFloat(bb));
  }
  return undefined;
};

// --- comparison ----------------------------------------------------------------------------------

const isColorProp = (prop) => /(^|-)color$/.test(prop) || prop === 'fill' || prop === 'stroke';
const isLengthProp = (prop) =>
  /(width|height|size|radius|padding|margin|gap|top|left|right|bottom|spacing|indent|inset)/.test(prop) &&
  !/color/.test(prop);

const norm = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ').replace(/"/g, '');

// Returns { ok } when within tolerance, or { ok:false, reason } describing the divergence.
const compare = (prop, expected, got) => {
  if (got === undefined) {
    return { ok: false, reason: 'not harvested' };
  }
  if (isColorProp(prop)) {
    const a = parseColor(expected);
    const b = parseColor(got);
    if (a && b) {
      const dist = Math.max(...a.map((channel, i) => Math.abs(channel - b[i])));
      return dist <= tol.colorChannel ? { ok: true } : { ok: false, reason: `Δ${dist} per-channel` };
    }
    return norm(expected) === norm(got) ? { ok: true } : { ok: false, reason: 'color mismatch' };
  }
  if (prop === 'font-weight') {
    const delta = Math.abs(parseLength(expected) - parseLength(got));
    return delta <= tol.weight ? { ok: true } : { ok: false, reason: `Δ${delta}` };
  }
  if (isLengthProp(prop)) {
    const a = parseLength(expected);
    const b = parseLength(got);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const delta = Math.abs(a - b);
      return delta <= tol.lengthPx ? { ok: true } : { ok: false, reason: `Δ${delta.toFixed(1)}px` };
    }
  }
  if (prop === 'font-family') {
    const first = norm(expected).split(',')[0];
    return norm(got).includes(first) ? { ok: true } : { ok: false, reason: `no "${first}"` };
  }
  return norm(expected) === norm(got) ? { ok: true } : { ok: false, reason: 'differs' };
};

// --- run -----------------------------------------------------------------------------------------

const deltas = [];
const missing = [];
for (const region of mapping.regions ?? []) {
  const got = actual[region.name];
  if (!got || got.__missing__) {
    missing.push({ region: region.name, selector: got?.__missing__ ?? region.app });
    continue;
  }
  for (const [prop, expected] of Object.entries(region.expect ?? {})) {
    const result = compare(prop, expected, got[prop]);
    if (!result.ok) {
      deltas.push({ region: region.name, prop, expected, actual: got[prop] ?? '—', reason: result.reason });
    }
  }
}

if (asJson) {
  console.log(JSON.stringify({ deltas, missing }, null, 2));
} else {
  if (missing.length > 0) {
    console.log(`\n⚠ ${missing.length} region(s) NOT FOUND in the app (selector drift or unrendered):`);
    for (const m of missing) {
      console.log(`   ${m.region}  →  ${m.selector}`);
    }
  }
  if (deltas.length === 0) {
    console.log(`\n✓ ${mapping.view ?? 'view'}: all mapped properties within tolerance.`);
  } else {
    console.log(`\n✗ ${mapping.view ?? 'view'}: ${deltas.length} propert(y/ies) diverge from the mockup:\n`);
    const pad = (text, width) => String(text).padEnd(width);
    console.log(`   ${pad('REGION', 20)}${pad('PROPERTY', 22)}${pad('EXPECT', 18)}${pad('ACTUAL', 18)}WHY`);
    for (const d of deltas) {
      console.log(`   ${pad(d.region, 20)}${pad(d.prop, 22)}${pad(d.expected, 18)}${pad(d.actual, 18)}${d.reason}`);
    }
    console.log('');
  }
}

process.exit(missing.length > 0 ? 2 : deltas.length > 0 ? 1 : 0);

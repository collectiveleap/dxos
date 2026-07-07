//
// Copyright 2026 DXOS.org
//

// Computed-style harvester for the visual-verification skill. Paste the whole expression below into
// `preview_eval`, with REGIONS replaced by the array built from a mapping file's regions:
//
//   [{ name, selector, props }]
//     name     — region key (must match the mapping's region `name`)
//     selector — a CSS selector for the region in the RUNNING APP (prefer a data-testid)
//     props    — the property names to read (the keys of the mapping region's `expect` object)
//
// It resolves each property via getComputedStyle (custom properties via getPropertyValue), records a
// rounded bounding box, and returns a JSON string keyed by region name. A region whose selector
// matches nothing yields { __missing__: <selector> } so the differ can report selector drift.
//
// The mockup side (expected values) is derived the same way when rendered — see SKILL.md. This file
// is the AS-BUILT half of the loop.

((regions) => {
  const out = {};
  for (const region of regions) {
    const element = document.querySelector(region.selector);
    if (!element) {
      out[region.name] = { __missing__: region.selector };
      continue;
    }
    const style = getComputedStyle(element);
    const record = {};
    for (const prop of region.props) {
      record[prop] = prop.startsWith('--') ? style.getPropertyValue(prop).trim() : style.getPropertyValue(prop);
    }
    const box = element.getBoundingClientRect();
    record.__box__ = { w: Math.round(box.width), h: Math.round(box.height), x: Math.round(box.left), y: Math.round(box.top) };
    out[region.name] = record;
  }
  return JSON.stringify(out, null, 2);
})(REGIONS);

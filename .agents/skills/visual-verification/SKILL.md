---
name: visual-verification
description: >
  Verify a Composer plugin UI against its committed design mockup by measuring computed styles, not
  by eyeballing screenshots. MANDATORY before reporting any visual/layout work on plugin-readwise or
  plugin-sensemaking (the Workbench Inbox) as done. Use when a change alters how a rendered surface
  looks — spacing, color, typography, borders, layout — and a mockup exists to check against.
---

# Visual verification against a mockup

The failure this prevents: reporting visual work as "done" and letting the human be the diff engine —
catching, by eye, that a label is violet instead of grey or a rule is missing. A vision model
eyeballing two screenshots is unreliable for exactly those deltas (4px vs 8px spacing, a shade of
grey, a 1px border). **So don't eyeball — measure.** Extract numbers from the mockup and from the
running DOM and diff them deterministically. The mockup is committed HTML, so both sides expose the
same `getComputedStyle` interface; the comparison is exact, threshold-free, and self-localizing.

Run this loop and get it to a clean (or consciously-triaged) result **before** telling the human the
work is done. Show the differ output as evidence; never hand them the raw visual diff to perform.

## The loop

### Phase 0 — Determinism (before trusting any signal)
- One fixed viewport: `preview_resize` to the mapping's `viewport` (Workbench Inbox: 1400×900).
- Freeze the surface: the app must be showing real content (e.g. the Inbox with ≥1 synced Capture).
  Dynamic data (counts, timestamps) is fine — the differ reads *styles*, not text — but the target
  elements must be present. Disable in-flight animations/carousels if any overlap the surface.
- Verify in the preview's **Chromium**. The user's real browser is **Safari/WebKit**, which has
  documented `getComputedStyle` quirks; treat WebKit-only rendering (e.g. the caret bug) as a
  flag-for-human item, not something this loop can settle.

### Phase 1 — Harvest actual from the app
- Open the target surface in the app (`preview_start`/navigate to the Inbox).
- Build the harvester call: take `mappings/<view>.json`, turn each region into
  `{ name, selector: <region.app>, props: <keys of region.expect> }`, and paste
  `harvest-styles.js` into `preview_eval` with `REGIONS` replaced by that array.
- Save the returned JSON to a scratch file, e.g. `<scratchpad>/actual.json`.
- If a region comes back `__missing__`, the selector drifted (or the surface isn't rendered) — fix
  the selector / the `data-testid` in source before trusting the run.

### Phase 2 — Diff (deterministic primary signal)
```
node .claude/skills/visual-verification/diff-styles.mjs \
  .claude/skills/visual-verification/mappings/<view>.json \
  <scratchpad>/actual.json
```
Exit `0` = within tolerance · `1` = deltas · `2` = a region wasn't found. The table names region,
property, expected, actual, and why. This is the loop's pass/fail.

### Phase 3 — Triage (does it matter?)
Not every delta must be fixed — "prioritize by impact, not every 1px" is the design-QA rule the
tolerances already encode (±1px, ±6 per colour channel). For each remaining delta decide:
- **Fix** — a real, visible divergence (wrong colour family, a missing rule, ≥2px spacing, wrong
  type scale). Most deltas are this.
- **Accept, with reason** — an intentional deviation (e.g. reusing a semantic token that resolves a
  shade off the mockup's hand-picked hex, where the token is the right call). Record why.
- **Flag for the human** — the irreducibly subjective: visual hierarchy, "feel", motion, whether a
  borderline deviation reads as wrong. Surface it; do not self-grade it.

### Phase 4 — Fix and re-measure
Apply the source edits, then **re-run Phases 1–2** (re-harvest, re-diff) — never assume a fix
landed; confirm the delta closed against a fresh measurement. This is what breaks the
"I rationalise my own earlier mistake" loop. Repeat until the differ is clean or every residual delta
is a recorded Accept/Flag.

### Phase 5 — Coarse visual safety net (secondary)
Computed-style reads are blind to overlap, z-index occlusion, clipping, and broken images.
`preview_screenshot` the converged surface and eyeball once for that class only — not for the metric
deltas Phase 2 already owns.

## Reporting

Report the differ's final state (clean, or the triaged residual list with reasons) plus the Phase-5
screenshot. State plainly what was fixed, what was accepted-with-reason, and what needs the human's
eye. Never present the raw before/after and ask the human to spot the differences.

## Extending to a new view

1. Author `mappings/<view>.json`: for each region, a `name`, an `app` selector (prefer a
   `data-testid` in source — add it if absent), a `mockup` pointer (selector + source line), and an
   `expect` map of the properties that matter (typography, colour, spacing, border, radius),
   extracted from the mockup's CSS.
2. Add the `data-testid`s to the plugin source so selectors are stable across refactors.
3. Run the loop; tune per-view `tolerances` if a class of imperceptible diffs is noisy.

## Upgrade path (higher fidelity, later)

The expected values here are extracted from the mockup's source CSS (cited per region). The canonical
version renders the mockup in the same Chromium and harvests the *same* props with `harvest-styles.js`
so expected and actual are both browser-resolved (identical serialization, cascade, and custom-prop
resolution) — no source-CSS transcription at all. Add a static-serve step for
`docs/superpowers/specs/*.html` and point `harvest-styles.js` at it to produce `expected.json`, then
diff `expected.json` vs `actual.json`. Option B (an aligned screenshot diff via `auto-image-diff`)
is a further add-on for emergent-visual coverage.

## Files
- `diff-styles.mjs` — pure-Node computed-style differ (colour/length/keyword aware; parses hex,
  rgb(), oklch(), oklab()). Exit code is the pass/fail.
- `harvest-styles.js` — `preview_eval` snippet that reads computed styles + bounding box per region.
- `mappings/workbench-inbox.json` — the Workbench Inbox spec (15 regions).

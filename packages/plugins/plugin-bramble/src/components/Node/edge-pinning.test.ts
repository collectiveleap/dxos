//
// Copyright 2026 DXOS.org
//

// F-Versioning: unit coverage of the pure-shape helpers. The full
// pin-create + snapshot-resolve flow is exercised end-to-end via
// the `T-Versioning-*` smoke tests in PLUGIN.mdl — those need a
// live ECHO client + Automerge doc to exercise `Obj.version`,
// `Obj.encodeVersion`, and `checkoutVersion` for real.

import { describe, test } from 'vitest';

import { captureTargetVersion, isPinningEdgeKind, isRemoved, PINNING_EDGE_KINDS } from './edge-pinning';

describe('PINNING_EDGE_KINDS', () => {
  test('contains exactly the v1 pinning kinds', ({ expect }) => {
    // F-Versioning.pinning-edge-kinds-set: v1 set is exactly `{'is-run-of'}`.
    expect(PINNING_EDGE_KINDS.size).toBe(1);
    expect(PINNING_EDGE_KINDS.has('is-run-of')).toBe(true);
  });

  test('does NOT contain `child` or `parent-run` (non-pinning kinds today)', ({ expect }) => {
    expect(PINNING_EDGE_KINDS.has('child' as any)).toBe(false);
    expect(PINNING_EDGE_KINDS.has('parent-run' as any)).toBe(false);
  });
});

describe('isPinningEdgeKind', () => {
  test('true for `is-run-of`', ({ expect }) => {
    expect(isPinningEdgeKind('is-run-of')).toBe(true);
  });

  test('false for non-pinning kinds', ({ expect }) => {
    expect(isPinningEdgeKind('child')).toBe(false);
    expect(isPinningEdgeKind('parent-run')).toBe(false);
  });

  test('false for undefined kind (legacy edges with no kind set)', ({ expect }) => {
    expect(isPinningEdgeKind(undefined)).toBe(false);
  });
});

describe('captureTargetVersion', () => {
  test('returns undefined when target is undefined', ({ expect }) => {
    expect(captureTargetVersion(undefined)).toBeUndefined();
  });

  test('returns undefined when target has no resolvable version', ({ expect }) => {
    // A plain object that isn't an ECHO entity — Obj.version throws
    // or returns the unversioned sentinel; either way the helper
    // catches and returns undefined so callers can skip the pin.
    expect(captureTargetVersion({} as any)).toBeUndefined();
  });
});

describe('isRemoved', () => {
  test('true for the REMOVED sentinel shape', ({ expect }) => {
    expect(isRemoved({ __bramble_removed: true })).toBe(true);
  });

  test('false for live Bramble.Node shapes', ({ expect }) => {
    expect(isRemoved({ id: 'abc', content: [] })).toBe(false);
  });

  test('false for undefined / null', ({ expect }) => {
    expect(isRemoved(undefined)).toBe(false);
    expect(isRemoved(null)).toBe(false);
  });

  test('false for the boolean true', ({ expect }) => {
    expect(isRemoved(true)).toBe(false);
  });
});

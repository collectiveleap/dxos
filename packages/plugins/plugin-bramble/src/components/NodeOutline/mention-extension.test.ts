//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { makeMarker, markerEdgeIds, staleEdgeIds } from './mention-extension';

describe('mention marker helpers', () => {
  test('makeMarker + markerEdgeIds round-trip', ({ expect }) => {
    const m = makeMarker('01H2XYZ');
    expect(m).toBe('{{ref:01H2XYZ}}');
    expect(markerEdgeIds(`begin ${m} and ${makeMarker('01H2ABC')} end`)).toEqual(['01H2XYZ', '01H2ABC']);
  });

  test('markerEdgeIds returns [] when none', ({ expect }) => {
    expect(markerEdgeIds('plain text')).toEqual([]);
  });

  test('staleEdgeIds finds edges whose marker was deleted', ({ expect }) => {
    expect(staleEdgeIds(`begin ${makeMarker('e1')} end`, ['e1', 'e2'])).toEqual(['e2']);
    expect(staleEdgeIds(`${makeMarker('e1')} ${makeMarker('e2')}`, ['e1', 'e2'])).toEqual([]);
    expect(staleEdgeIds('all markers gone', ['e1', 'e2'])).toEqual(['e1', 'e2']);
  });
});

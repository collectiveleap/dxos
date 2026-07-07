//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { latestFlaggedAt, orderClusters } from './cluster';

describe('cluster ordering', () => {
  test('latestFlaggedAt returns the max ISO string', ({ expect }) => {
    expect(latestFlaggedAt(['2026-07-01T00:00:00Z', '2026-07-03T00:00:00Z', '2026-06-01T00:00:00Z'])).toBe(
      '2026-07-03T00:00:00Z',
    );
    expect(latestFlaggedAt([])).toBe('');
  });

  test('orderClusters sorts most-recent-first', ({ expect }) => {
    const clusters = [
      { id: 'a', latestFlaggedAt: '2026-07-01T00:00:00Z' },
      { id: 'b', latestFlaggedAt: '2026-07-05T00:00:00Z' },
      { id: 'c', latestFlaggedAt: '2026-07-03T00:00:00Z' },
    ];
    expect(orderClusters(clusters).map((cluster) => cluster.id)).toEqual(['b', 'c', 'a']);
  });
});

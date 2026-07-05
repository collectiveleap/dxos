//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { latestUpdated, orderGroups } from './browse-query';

describe('browse-query ordering', () => {
  test('latestUpdated returns the max ISO string', ({ expect }) => {
    expect(latestUpdated(['2026-07-01T00:00:00Z', '2026-07-03T00:00:00Z', '2026-06-01T00:00:00Z'])).toBe('2026-07-03T00:00:00Z');
    expect(latestUpdated([])).toBe('');
  });

  test('orderGroups sorts most-recent-first', ({ expect }) => {
    const groups = [
      { id: 'a', latestUpdated: '2026-07-01T00:00:00Z' },
      { id: 'b', latestUpdated: '2026-07-05T00:00:00Z' },
      { id: 'c', latestUpdated: '2026-07-03T00:00:00Z' },
    ];
    expect(orderGroups(groups).map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });
});

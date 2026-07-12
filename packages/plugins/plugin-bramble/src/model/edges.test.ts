//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { orderBetween } from './edges';

describe('orderBetween', () => {
  test('midpoints and open ends', ({ expect }) => {
    expect(orderBetween(undefined, undefined)).toBe(0);
    expect(orderBetween({ order: 5 } as any, undefined)).toBe(6);
    expect(orderBetween(undefined, { order: 5 } as any)).toBe(4);
    expect(orderBetween({ order: 2 } as any, { order: 4 } as any)).toBe(3);
  });
});

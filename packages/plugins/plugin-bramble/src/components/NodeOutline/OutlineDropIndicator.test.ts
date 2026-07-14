//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { instructionOrientation } from './OutlineDropIndicator';

describe('instructionOrientation', () => {
  test('reorder-above / reorder-below are sibling lines', ({ expect }) => {
    expect(instructionOrientation({ type: 'reorder-above', currentLevel: 0, indentPerLevel: 32 } as any)).toBe('sibling');
    expect(instructionOrientation({ type: 'reorder-below', currentLevel: 0, indentPerLevel: 32 } as any)).toBe('sibling');
  });

  test('make-child is a child box', ({ expect }) => {
    expect(instructionOrientation({ type: 'make-child', currentLevel: 0, indentPerLevel: 32 } as any)).toBe('child');
  });

  test('instruction-blocked renders nothing', ({ expect }) => {
    expect(
      instructionOrientation({
        type: 'instruction-blocked',
        desired: { type: 'reorder-above', currentLevel: 0, indentPerLevel: 32 },
      } as any),
    ).toBeNull();
  });
});

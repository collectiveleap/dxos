//
// Copyright 2026 DXOS.org
//

import { type Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import React, { type CSSProperties } from 'react';

export type Orientation = 'sibling' | 'child';

/** Sibling reorder → a horizontal line; make-child → a box around the target. Blocked → nothing. */
export const instructionOrientation = (instruction: Instruction): Orientation | null => {
  const desired = instruction.type === 'instruction-blocked' ? null : instruction;
  if (!desired) {
    return null;
  }
  switch (desired.type) {
    case 'reorder-above':
    case 'reorder-below':
      return 'sibling';
    case 'make-child':
      return 'child';
    default:
      // `reparent` is blocked at the hitbox in this plan; treat any other type as no indicator.
      return null;
  }
};

/** Themed drop indicator for a tree-item drag `Instruction`. Absolutely positioned inside a
 *  `position: relative` row. Accent color comes from the DXOS surface token. */
export const OutlineDropIndicator = ({ instruction }: { instruction: Instruction }) => {
  const orientation = instructionOrientation(instruction);
  if (!orientation) {
    return null;
  }
  const edge =
    instruction.type === 'reorder-above' ? 'above' : instruction.type === 'reorder-below' ? 'below' : null;
  const base: CSSProperties = { position: 'absolute', pointerEvents: 'none', zIndex: 10 };
  const style: CSSProperties =
    orientation === 'child'
      ? { ...base, inset: 0, border: '2px solid var(--dx-accentSurface, #2563eb)', borderRadius: 4 }
      : {
          ...base,
          left: 0,
          right: 0,
          height: 2,
          background: 'var(--dx-accentSurface, #2563eb)',
          ...(edge === 'above' ? { top: -1 } : { bottom: -1 }),
        };
  return <div data-testid='bramble-drop-indicator' data-orientation={orientation} style={style} />;
};

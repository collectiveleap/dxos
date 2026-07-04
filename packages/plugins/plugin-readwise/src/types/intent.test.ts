//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';
import { INTENT_KINDS, representationFor, resultKindRegistry } from './intent';

describe('intent registry', () => {
  test('comment maps to a message, question and todo map to tasks', ({ expect }) => {
    expect(representationFor('comment')).toBe('message');
    expect(representationFor('question')).toBe('task');
    expect(representationFor('todo')).toBe('task');
  });
  test('every intent kind has a registry entry with a tag', ({ expect }) => {
    for (const kind of INTENT_KINDS) {
      expect(resultKindRegistry[kind].tag).toMatch(/^org\.dxos\.plugin\.readwise\//);
    }
  });
});

//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import { describe, test } from 'vitest';

import { EffectEx } from '@dxos/effect';

import { ReadwiseApi } from '../services';

import { TestLayer } from './test-layer';

describe('TestLayer', () => {
  test('composes a mock ReadwiseApi with an in-memory ECHO space', async ({ expect }) => {
    const { db, layer, close } = await TestLayer();
    try {
      const { highlights } = await EffectEx.runAndForwardErrors(
        ReadwiseApi.pipe(Effect.flatMap((api) => api.listHighlightsSince())).pipe(Effect.provide(layer)),
      );

      expect(highlights.length).toBeGreaterThan(0);
      expect(db.spaceId).toBeTypeOf('string');
    } finally {
      await close();
    }
  });
});

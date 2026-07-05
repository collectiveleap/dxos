//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import { describe, test } from 'vitest';

import { Connection } from '@dxos/plugin-connector';

import { readwiseCredentialForm } from './readwise-credential-form';
import { READWISE_CONNECTOR_ID, READWISE_SOURCE } from '../constants';
import { TestLayer } from '../test/test-layer';

const connector = { id: READWISE_CONNECTOR_ID, source: READWISE_SOURCE, label: 'Readwise' } as const;

describe('readwiseCredentialForm', () => {
  test('rejects an empty token', ({ expect }) =>
    Effect.gen(function* () {
      const result = yield* Effect.either(readwiseCredentialForm.onValidate!({ values: { token: '   ' }, connector }));
      expect(result._tag).toBe('Left');
    }).pipe(Effect.runPromise));

  test('onSubmit builds an AccessToken + Connection for a Readwise connection', async ({ expect }) => {
    // `onSubmit` never reads `db` (the token/connection are built in memory) — a real db from the
    // package `TestLayer` is threaded through anyway so the call stays cast-free.
    const { db, close } = await TestLayer();
    try {
      await Effect.gen(function* () {
        const result = yield* readwiseCredentialForm.onSubmit({ values: { token: 'tok' }, connector, db });
        expect(result.kind).toBe('complete');
        if (result.kind !== 'complete') {
          return;
        }
        expect(result.accessToken.source).toBe(READWISE_SOURCE);
        expect(result.accessToken.token).toBe('tok');
        expect(Connection.instanceOf?.(result.connection) ?? true).toBe(true);
        expect(result.connection.connectorId).toBe(READWISE_CONNECTOR_ID);
      }).pipe(Effect.runPromise);
    } finally {
      await close();
    }
  });
});

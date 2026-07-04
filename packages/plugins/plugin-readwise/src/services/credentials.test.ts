//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import { describe, test } from 'vitest';

import { Database, Obj, Ref } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { EffectEx } from '@dxos/effect';
import { Connection } from '@dxos/plugin-connector';
import { AccessToken } from '@dxos/types';

import { READWISE_SOURCE } from '../constants';

import { ReadwiseCredentials } from './credentials';

describe('ReadwiseCredentials.fromConnection', () => {
  test('yields the token from the AccessToken referenced by the Connection', async ({ expect }) => {
    const builder = await new EchoTestBuilder().open();
    try {
      const { db, graph } = await builder.createDatabase();
      graph.registry.add([AccessToken.AccessToken, Connection.Connection]);

      const token = db.add(Obj.make(AccessToken.AccessToken, { source: READWISE_SOURCE, token: 'test-tok' }));
      const connection = db.add(
        Obj.make(Connection.Connection, { name: 'Readwise', connectorId: 'readwise', accessToken: Ref.make(token) }),
      );

      const credentials = await EffectEx.runAndForwardErrors(
        ReadwiseCredentials.pipe(
          Effect.provide(ReadwiseCredentials.fromConnection(connection)),
          Effect.provide(Database.layer(db)),
        ),
      );

      expect(credentials).toEqual({ token: 'test-tok' });
    } finally {
      await builder.close();
    }
  });
});

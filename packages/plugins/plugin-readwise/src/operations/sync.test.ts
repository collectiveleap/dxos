//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import { afterEach, beforeEach, describe, test } from 'vitest';

import { Database, Obj, Ref, Relation } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { EffectEx } from '@dxos/effect';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { Connection, SyncBinding } from '@dxos/plugin-connector';
import { AccessToken, AnchoredTo, Cursor, Message, Task } from '@dxos/types';

import { READWISE_SOURCE } from '../constants';
import { MockTransport } from '../test/test-layer';
import { makeHandler } from './sync';

/** Seeds a real in-memory space with an AccessToken + Connection + SyncBinding, mirroring `plugin-linear`'s sync.test.ts setup. */
const seedConnection = async (builder: EchoTestBuilder) => {
  const { db, graph } = await builder.createDatabase();
  graph.registry.add([
    AccessToken.AccessToken,
    Connection.Connection,
    Cursor.Cursor,
    SyncBinding.SyncBinding,
    Bookmark.Bookmark,
    Message.Message,
    Task.Task,
    AnchoredTo.AnchoredTo,
  ]);
  const token = db.add(Obj.make(AccessToken.AccessToken, { source: READWISE_SOURCE, token: 'test-token' }));
  const connection = db.add(
    Obj.make(Connection.Connection, { name: 'Readwise', connectorId: 'readwise', accessToken: Ref.make(token) }),
  );
  const binding = db.add(
    SyncBinding.make({
      [Relation.Source]: connection,
      [Relation.Target]: connection,
    }),
  );
  return { db, binding };
};

describe('Readwise sync operation', () => {
  let builder: EchoTestBuilder;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
  });

  afterEach(async () => {
    await builder.close();
  });

  test('captures highlights idempotently and advances the cursor', async ({ expect }) => {
    const { binding } = await seedConnection(builder);
    const db = Obj.getDatabase(binding)!;
    const dbLayer = Database.layer(db);

    // `makeHandler` takes the mock `Transport` directly — the injection seam for tests, since
    // `Effect.provide` inside the handler body always wins over one supplied from the outside.
    const syncHandler = makeHandler(MockTransport);

    const cursorBefore = await EffectEx.runAndForwardErrors(
      Database.load(binding.cursor).pipe(Effect.provide(dbLayer)),
    );
    expect(cursorBefore.value).toBeUndefined();

    const first = await EffectEx.runAndForwardErrors(syncHandler.handler({ binding: Ref.make(binding) }));
    expect(first.created).toBeGreaterThan(0);

    const second = await EffectEx.runAndForwardErrors(syncHandler.handler({ binding: Ref.make(binding) }));
    expect(second.created).toBe(0);

    const cursorAfter = await EffectEx.runAndForwardErrors(Database.load(binding.cursor).pipe(Effect.provide(dbLayer)));
    expect(cursorAfter.value).toBeDefined();
  });
});

//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import { afterEach, beforeEach, describe, test } from 'vitest';

import { Database, Filter, Obj, Query, Ref, Relation } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { EffectEx } from '@dxos/effect';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { Connection, SyncBinding } from '@dxos/plugin-connector';
import { AccessToken, AnchoredTo, Cursor, Message, Task } from '@dxos/types';

import { DEFAULT_SYNC_WINDOW_DAYS, READWISE_SOURCE } from '../constants';
import { MockTransport } from '../test/test-layer';
import { Highlight, Readwise } from '../types';

import { firstSyncSince, makeHandler } from './sync';

/**
 * Seeds a real in-memory space with an AccessToken + Connection + a `Readwise` container, bound by a
 * SyncBinding whose target is that container (the capture destination the sync handler resolves via
 * `Relation.getTarget`). Mirrors `plugin-linear`'s sync.test.ts setup.
 */
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
    Readwise.Readwise,
    Highlight.Highlight,
  ]);
  const token = db.add(Obj.make(AccessToken.AccessToken, { source: READWISE_SOURCE, token: 'test-token' }));
  const connection = db.add(
    Obj.make(Connection.Connection, { name: 'Readwise', connectorId: 'readwise', accessToken: Ref.make(token) }),
  );
  const container = db.add(Readwise.make({ name: 'Readwise' }));
  const binding = db.add(
    SyncBinding.make({
      [Relation.Source]: connection,
      [Relation.Target]: container,
    }),
  );
  return { db, binding, container };
};

describe('firstSyncSince', () => {
  test('returns an ISO timestamp DEFAULT_SYNC_WINDOW_DAYS before the given instant', ({ expect }) => {
    const now = Date.parse('2026-07-31T00:00:00.000Z');
    expect(firstSyncSince(now)).toBe(new Date(now - DEFAULT_SYNC_WINDOW_DAYS * 86_400_000).toISOString());
    expect(firstSyncSince(now)).toBe('2026-07-01T00:00:00.000Z');
  });
});

describe('Readwise sync operation', () => {
  let builder: EchoTestBuilder;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
  });

  afterEach(async () => {
    await builder.close();
  });

  test('captures highlights into the bound Readwise container idempotently and advances the cursor', async ({
    expect,
  }) => {
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

    // The mock fixture carries 3 distinct documents with 8 annotations (7 highlights + 1 document note).
    const bookmarks = await db.query(Query.select(Filter.type(Bookmark.Bookmark))).run();
    expect(bookmarks.length).toBe(3);
    const highlights = await db.query(Query.select(Filter.type(Highlight.Highlight))).run();
    expect(highlights.length).toBe(8);

    const second = await EffectEx.runAndForwardErrors(syncHandler.handler({ binding: Ref.make(binding) }));
    expect(second.created).toBe(0);

    const cursorAfter = await EffectEx.runAndForwardErrors(Database.load(binding.cursor).pipe(Effect.provide(dbLayer)));
    expect(cursorAfter.value).toBeDefined();
  });
});

//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { Database } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';

import fixture from '../../test/fixtures/highlights.sample.json';
import { ReadwiseApiLayer, ReadwiseCredentials, Transport } from '../services';

/**
 * Mock {@link Transport} that always serves the Task-1 fixture as a single
 * (non-paginated) `export` page, regardless of the requested URL. Bypasses
 * the network entirely so tests never depend on the EDGE CORS proxy.
 */
export const MockTransport: Layer.Layer<Transport> = Layer.succeed(Transport, {
  fetch: () =>
    Effect.sync(() => new Response(JSON.stringify({ results: fixture, nextPageCursor: null }), { status: 200 })),
});

export type TestLayerOptions = {
  /** Readwise API token to provide via `ReadwiseCredentials`. Not read anywhere by the mock transport. */
  token?: string;
};

/**
 * Composes a mock `Transport` + `ReadwiseApi` with a fresh in-memory ECHO
 * space, for tests exercising code that both calls the Readwise API and reads
 * or writes ECHO objects (capture/sync layers built on top of this client).
 */
export const TestLayer = async (options: TestLayerOptions = {}) => {
  const builder = await new EchoTestBuilder().open();
  const { db } = await builder.createDatabase();

  const layer = Layer.mergeAll(
    ReadwiseApiLayer,
    Layer.succeed(ReadwiseCredentials, { token: options.token ?? 'test-token' }),
    MockTransport,
    Database.layer(db),
  );

  return {
    db,
    layer,
    close: () => builder.close(),
  };
};

//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { describe, test } from 'vitest';

import { EffectEx } from '@dxos/effect';

import fixture from '../../test/fixtures/highlights.sample.json';

import { ReadwiseCredentials } from './credentials';
import { ReadwiseApi, ReadwiseApiLayer, Transport } from './readwise-api';

type Document = (typeof fixture)[number];

/** Builds a mock `Transport` that serves a fixed sequence of pages, one per call (the last page repeats if over-called). */
const mockTransportOf = (pages: ReadonlyArray<{ results: readonly Document[]; nextPageCursor: string | null }>) => {
  const requestedUrls: string[] = [];
  let call = 0;
  const layer = Layer.succeed(Transport, {
    fetch: (url: string) =>
      Effect.sync(() => {
        requestedUrls.push(url);
        const page = pages[Math.min(call, pages.length - 1)];
        call += 1;
        return new Response(JSON.stringify(page), { status: 200 });
      }),
  });
  return { layer, requestedUrls };
};

const runListHighlightsSince = (transport: Layer.Layer<Transport>, cursor?: string) =>
  EffectEx.runAndForwardErrors(
    ReadwiseApi.pipe(Effect.flatMap((api) => api.listHighlightsSince(cursor))).pipe(
      Effect.provide(ReadwiseApiLayer),
      Effect.provide(Layer.succeed(ReadwiseCredentials, { token: 'test-token' })),
      Effect.provide(transport),
    ),
  );

describe('ReadwiseApi.listHighlightsSince', () => {
  test('parses highlights and maps source metadata from the fixture', async ({ expect }) => {
    const { layer } = mockTransportOf([{ results: fixture, nextPageCursor: null }]);

    const { highlights, nextCursor } = await runListHighlightsSince(layer, '2026-01-01T00:00:00Z');

    // 7 highlights + 1 synthetic document-note annotation (Notes on Local-First Software).
    expect(highlights.length).toBe(8);
    expect(nextCursor).toBeUndefined();

    const first = highlights[0];
    expect(first.readwiseId).toBe('8000001001');
    expect(first.sourceTitle).toBe('The Constraints That Shape Software Teams');
    expect(first.sourceAuthor).toBe('Rina Okafor');
    expect(first.sourceUrl).toBe('https://example.com/articles/constraints-shape-teams');
    expect(first.sourceCategory).toBe('articles');
    expect(first.sourceImage).toBe('https://example.com/covers/constraints.jpg');
    expect(first.note).toContain('Theory of Constraints');
    expect(first.tags).toEqual([]);
    expect(first.updated).toBe('2026-06-30T14:12:00.000Z');
    expect(first.sourceId).toBe('70000001');
    expect(first.sourceUniqueUrl).toBe('https://read.readwise.io/read/01example0000000000000001');

    // Un-noted highlight keeps an empty string, not undefined.
    const unNoted = highlights.find((highlight) => highlight.readwiseId === '8000001002');
    expect(unNoted?.note).toBe('');

    // Tagged highlight maps tag names.
    const tagged = highlights.find((highlight) => highlight.readwiseId === '8000001003');
    expect(tagged?.tags).toEqual(['metrics']);

    // Document with a null source_url — sourceId remains the stable dedup key.
    const noSourceUrl = highlights.find((highlight) => highlight.sourceTitle === 'Thinking in Systems');
    expect(noSourceUrl?.sourceUrl).toBeUndefined();
    expect(noSourceUrl?.sourceId).toBe('70000003');

    // Document-level note surfaces as its own synthetic annotation.
    const docNote = highlights.find((highlight) => highlight.readwiseId === 'docnote-70000002');
    expect(docNote).toBeDefined();
    expect(docNote?.note).toContain('CRDT convergence');
    expect(docNote?.text).toBe('');
    expect(docNote?.tags).toEqual([]);
    expect(docNote?.sourceTitle).toBe('Notes on Local-First Software');
    expect(docNote?.sourceId).toBe('70000002');
    expect(docNote?.url).toBe('https://readwise.io/bookreview/70000002');
  });

  test('threads the cursor into the request URL', async ({ expect }) => {
    const { layer, requestedUrls } = mockTransportOf([{ results: fixture, nextPageCursor: null }]);

    await runListHighlightsSince(layer, '2026-02-03T00:00:00Z');

    expect(requestedUrls.length).toBe(1);
    expect(requestedUrls[0]).toContain('updatedAfter=2026-02-03T00%3A00%3A00Z');
  });

  test('pagination follows nextPageCursor until absent', async ({ expect }) => {
    const [firstDoc, secondDoc, thirdDoc] = fixture;
    const { layer, requestedUrls } = mockTransportOf([
      { results: [firstDoc], nextPageCursor: 'cursor-page-2' },
      { results: [secondDoc, thirdDoc], nextPageCursor: null },
    ]);

    const { highlights } = await runListHighlightsSince(layer);

    // 7 highlights + 1 synthetic document-note annotation.
    expect(highlights.length).toBe(8);
    expect(requestedUrls.length).toBe(2);
    expect(requestedUrls[1]).toContain('pageCursor=cursor-page-2');
  });
});

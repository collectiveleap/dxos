//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { describe, test } from 'vitest';

import { EffectEx } from '@dxos/effect';

import fixture from '../../test/fixtures/highlights.sample.json';

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
      Effect.provide(ReadwiseApiLayer('test-token')),
      Effect.provide(transport),
    ),
  );

describe('ReadwiseApi.listHighlightsSince', () => {
  test('parses highlights and maps source metadata from the fixture', async ({ expect }) => {
    const { layer } = mockTransportOf([{ results: fixture, nextPageCursor: null }]);

    const { highlights, nextCursor } = await runListHighlightsSince(layer, '2026-01-01T00:00:00Z');

    expect(highlights.length).toBe(7);
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

    // Un-noted highlight keeps an empty string, not undefined.
    const unNoted = highlights.find((highlight) => highlight.readwiseId === '8000001002');
    expect(unNoted?.note).toBe('');

    // Tagged highlight maps tag names.
    const tagged = highlights.find((highlight) => highlight.readwiseId === '8000001003');
    expect(tagged?.tags).toEqual(['metrics']);

    // Document with a null source_url.
    const noSourceUrl = highlights.find((highlight) => highlight.sourceTitle === 'Thinking in Systems');
    expect(noSourceUrl?.sourceUrl).toBeUndefined();
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

    expect(highlights.length).toBe(7);
    expect(requestedUrls.length).toBe(2);
    expect(requestedUrls[1]).toContain('pageCursor=cursor-page-2');
  });
});

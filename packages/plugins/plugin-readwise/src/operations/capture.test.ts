//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Filter, Obj, Query } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';

import { CANONICAL_URL_SOURCE, READWISE_SOURCE } from '../constants';
import { type Highlight, canonicalizeUrl } from '../services';
import { Readwise } from '../types';
import { Highlight as HighlightType } from '../types';

import { captureHighlights } from './capture';
import { TestLayer } from '../test/test-layer';

// Two synthetic highlights sharing one source document, plus a second source.
const wire = (over: Partial<Highlight>): Highlight => ({
  readwiseId: 'rw-1',
  text: 'a highlighted passage',
  note: '',
  tags: [],
  updated: '2026-07-01T00:00:00.000Z',
  location: undefined,
  url: undefined,
  origin: undefined,
  sourceTitle: 'An Article',
  sourceAuthor: undefined,
  sourceUrl: 'https://example.com/a',
  sourceCategory: undefined,
  sourceImage: undefined,
  sourceId: 'src-1',
  sourceUniqueUrl: undefined,
  ...over,
});

describe('captureHighlights', () => {
  test('creates one Bookmark per source and one Highlight per highlight', async ({ expect }) => {
    const { db, space, run, close } = await TestLayer();
    try {
      const container = db.add(Readwise.make({ name: 'Test' }));
      const highlights = [
        wire({ readwiseId: 'rw-1', sourceId: 'src-1' }),
        wire({ readwiseId: 'rw-2', sourceId: 'src-1', text: 'second passage' }),
        wire({ readwiseId: 'rw-3', sourceId: 'src-2', sourceTitle: 'Other', text: 'third' }),
      ];

      const result = await run(captureHighlights({ db: space.db, container }, highlights));
      expect(result.created).toBe(5); // 2 bookmarks + 3 highlights

      const bookmarks = await db.query(Query.select(Filter.type(Bookmark.Bookmark))).run();
      const stored = await db.query(Query.select(Filter.type(HighlightType.Highlight))).run();
      expect(bookmarks.length).toBe(2);
      expect(stored.length).toBe(3);
      const first = stored.find((highlight) => highlight.readwiseId === 'rw-1')!;
      expect(first.source.target?.title).toBe('An Article');
      expect(first.container.target?.id).toBe(container.id);
    } finally {
      await close();
    }
  });

  test('is idempotent: a second identical run creates nothing', async ({ expect }) => {
    const { db, space, run, close } = await TestLayer();
    try {
      const container = db.add(Readwise.make({ name: 'Test' }));
      const highlights = [wire({ readwiseId: 'rw-1', sourceId: 'src-1' })];

      await run(captureHighlights({ db: space.db, container }, highlights));
      const second = await run(captureHighlights({ db: space.db, container }, highlights));
      expect(second.created).toBe(0);
      expect(second.updated).toBe(0);

      const stored = await db.query(Query.select(Filter.type(HighlightType.Highlight))).run();
      expect(stored.length).toBe(1);
    } finally {
      await close();
    }
  });

  test('updates an existing Highlight when its note changed', async ({ expect }) => {
    const { db, space, run, close } = await TestLayer();
    try {
      const container = db.add(Readwise.make({ name: 'Test' }));

      await run(captureHighlights({ db: space.db, container }, [wire({ readwiseId: 'rw-1', note: '' })]));
      const result = await run(
        captureHighlights({ db: space.db, container }, [wire({ readwiseId: 'rw-1', note: 'a new note' })]),
      );
      expect(result.updated).toBe(1);

      const stored = await db.query(Query.select(Filter.type(HighlightType.Highlight))).run();
      expect(stored.length).toBe(1);
      expect(stored[0].note).toBe('a new note');
    } finally {
      await close();
    }
  });

  test('stamps a Bookmark with both a Readwise and a canonical-URL foreign key', async ({ expect }) => {
    const { db, space, run, close } = await TestLayer();
    try {
      const container = db.add(Readwise.make({ name: 'Test' }));
      const sourceUrl = 'https://example.com/a?utm_source=readwise';
      const highlights = [wire({ readwiseId: 'rw-1', sourceId: 'src-1', sourceUrl })];

      await run(captureHighlights({ db: space.db, container }, highlights));

      const bookmarks = await db.query(Query.select(Filter.type(Bookmark.Bookmark))).run();
      expect(bookmarks.length).toBe(1);
      const keys = Obj.getMeta(bookmarks[0]).keys;
      expect(keys.find((key) => key.source === READWISE_SOURCE)?.id).toBe('src-1');
      expect(keys.find((key) => key.source === CANONICAL_URL_SOURCE)?.id).toBe(canonicalizeUrl(sourceUrl));
    } finally {
      await close();
    }
  });

  test('sets Highlight.origin from the wire highlight readwise_url', async ({ expect }) => {
    const { db, space, run, close } = await TestLayer();
    try {
      const container = db.add(Readwise.make({ name: 'Test' }));
      const highlights = [
        wire({ readwiseId: 'rw-1', sourceId: 'src-1', origin: 'https://readwise.io/reader/highlight/rw-1' }),
      ];

      await run(captureHighlights({ db: space.db, container }, highlights));

      const stored = await db.query(Query.select(Filter.type(HighlightType.Highlight))).run();
      expect(stored.length).toBe(1);
      expect(stored[0].origin).toBe('https://readwise.io/reader/highlight/rw-1');
    } finally {
      await close();
    }
  });

  test('refreshes Highlight.origin on update-in-place', async ({ expect }) => {
    const { db, space, run, close } = await TestLayer();
    try {
      const container = db.add(Readwise.make({ name: 'Test' }));

      await run(
        captureHighlights(
          { db: space.db, container },
          [wire({ readwiseId: 'rw-1', origin: 'https://readwise.io/reader/highlight/rw-1' })],
        ),
      );
      await run(
        captureHighlights(
          { db: space.db, container },
          [wire({ readwiseId: 'rw-1', origin: 'https://readwise.io/reader/highlight/rw-1-moved' })],
        ),
      );

      const stored = await db.query(Query.select(Filter.type(HighlightType.Highlight))).run();
      expect(stored.length).toBe(1);
      expect(stored[0].origin).toBe('https://readwise.io/reader/highlight/rw-1-moved');
    } finally {
      await close();
    }
  });
});

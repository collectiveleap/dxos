//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Filter } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { Message } from '@dxos/types';

import { TestLayer } from '../test/test-layer';

import { captureHighlights } from './capture';

describe('captureHighlights', () => {
  test('is idempotent — running twice creates no duplicate Bookmarks or Messages', async ({ expect }) => {
    const { space, run, highlights, close } = await TestLayer();
    try {
      const first = await run(captureHighlights(space, highlights));
      expect(first.created).toBe(highlights.length + 3); // 8 annotations + 3 documents.

      const second = await run(captureHighlights(space, highlights));
      expect(second.created).toBe(0);
      expect(second.updated).toBe(0);

      const messages = await space.db.query(Filter.type(Message.Message)).run();
      // 7 highlights + 1 synthetic document-note annotation.
      expect(messages.length).toBe(8);

      const bookmarks = await space.db.query(Filter.type(Bookmark.Bookmark)).run();
      // 3 distinct documents.
      expect(bookmarks.length).toBe(3);
    } finally {
      await close();
    }
  });

  test('a changed note updates the existing Message rather than adding one', async ({ expect }) => {
    const { space, run, highlights, close } = await TestLayer();
    try {
      await run(captureHighlights(space, highlights));

      const target = highlights[0];
      const updatedHighlights = highlights.map((highlight) =>
        highlight.readwiseId === target.readwiseId ? { ...highlight, note: 'Updated note text.' } : highlight,
      );

      const result = await run(captureHighlights(space, updatedHighlights));
      expect(result.created).toBe(0);
      expect(result.updated).toBe(1);

      const messages = await space.db.query(Filter.type(Message.Message)).run();
      expect(messages.length).toBe(8);

      const updatedMessage = messages.find(
        (message) => (message.properties as { readwiseId?: string } | undefined)?.readwiseId === target.readwiseId,
      );
      expect(updatedMessage).toBeDefined();
      expect(Message.extractText(updatedMessage!)).toContain('Updated note text.');
    } finally {
      await close();
    }
  });
});

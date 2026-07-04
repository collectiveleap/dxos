//
// Copyright 2026 DXOS.org
//

import { describe, test } from 'vitest';

import { Filter, Query, Relation } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { AnchoredTo, Message, Task } from '@dxos/types';

import { TRIAGE_TAG } from '../constants';
import { TestLayer } from '../test/test-layer';
import { captureHighlights } from './capture';

describe('captureHighlights', () => {
  test('is idempotent — running twice creates no duplicate Bookmarks or Messages', async ({ expect }) => {
    const { space, run, highlights, close } = await TestLayer();
    try {
      const first = await run(captureHighlights(space, highlights));
      expect(first.created).toBe(highlights.length + 3); // 8 annotations + 3 documents.
      expect(first.cards).toBe(8); // one triage Task per annotation.

      const second = await run(captureHighlights(space, highlights));
      expect(second.created).toBe(0);
      expect(second.updated).toBe(0);
      expect(second.cards).toBe(0);

      const messages = await space.db.query(Filter.type(Message.Message)).run();
      // 7 highlights + 1 synthetic document-note annotation.
      expect(messages.length).toBe(8);

      const bookmarks = await space.db.query(Filter.type(Bookmark.Bookmark)).run();
      // 3 distinct documents.
      expect(bookmarks.length).toBe(3);

      const tasks = await space.db.query(Filter.type(Task.Task)).run();
      expect(tasks.length).toBe(8);
      for (const task of tasks) {
        expect(task.status).toBe('todo');
      }

      // `Filter.tag(TRIAGE_TAG)` must return exactly the triage cards — this is the
      // apply/query symmetry a later triage-board query depends on.
      // The chained `.select().select()` shape is served by the async index query source, not the
      // synchronous in-memory scan — flush so the query deterministically sees the just-added Tasks.
      await space.db.flush();
      const triageTasks = await space.db
        .query(Query.select(Filter.type(Task.Task)).select(Filter.tag(TRIAGE_TAG)))
        .run();
      expect(triageTasks.length).toBe(8);
      expect(new Set(triageTasks.map((task) => task.id))).toEqual(new Set(tasks.map((task) => task.id)));

      // Each triage Task is anchored to its annotation Message (Task is the relation source,
      // Message is the target — the same direction as Message→Bookmark).
      for (const task of triageTasks) {
        const relations = await space.db.query(Query.select(Filter.id(task.id)).sourceOf(AnchoredTo.AnchoredTo)).run();
        expect(relations.length).toBe(1);
        const target = Relation.getTarget(relations[0]);
        expect(messages.some((message) => message.id === target.id)).toBe(true);
      }
    } finally {
      await close();
    }
  });

  test('running twice creates no duplicate Message→Bookmark AnchoredTo relations', async ({ expect }) => {
    const { space, run, highlights, close } = await TestLayer();
    try {
      await run(captureHighlights(space, highlights));
      await run(captureHighlights(space, highlights));

      const messages = await space.db.query(Filter.type(Message.Message)).run();
      expect(messages.length).toBe(8);

      // Each annotation Message is anchored to its document's Bookmark (Message is the relation
      // source, Bookmark is the target). Re-running capture must not add a second relation.
      for (const message of messages) {
        const relations = await space.db
          .query(Query.select(Filter.id(message.id)).sourceOf(AnchoredTo.AnchoredTo))
          .run();
        expect(relations.length).toBe(1);
      }
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
      expect(result.cards).toBe(0);

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

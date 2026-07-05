//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import { describe, test } from 'vitest';

import { Chat } from '@dxos/assistant-toolkit';
import { Feed, Filter, Query, Ref, Relation } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { EffectEx } from '@dxos/effect';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { AnchoredTo, Message, Task } from '@dxos/types';

import { resultKindRegistry } from '../types';
import { confirmItems } from './confirm';

describe('confirmItems', () => {
  let builder: EchoTestBuilder;

  const createDb = async () => {
    builder = await new EchoTestBuilder().open();
    const { db } = await builder.createDatabase({
      types: [
        Bookmark.Bookmark,
        Message.Message,
        Task.Task,
        AnchoredTo.AnchoredTo,
        Chat.Chat,
        Chat.CompanionTo,
        Feed.Feed,
      ],
    });
    return db;
  };

  /**
   * Seeds a source `Bookmark`, an annotation `Message` anchored to it (Message is the `AnchoredTo`
   * source, Bookmark is the target — see `capture.ts`'s `ensureAnchor`), a triage `Task` card
   * anchored to the annotation (card is the `AnchoredTo` source, Message is the target — see
   * `capture.ts`'s `upsertTriageTask`), and a companion `Chat` (linked via `Chat.CompanionTo`,
   * card as target — see `decompose.ts`'s `ensureCompanionChat`) whose feed carries the AI's
   * suggestion `Message` (`properties.suggestedItems`, matching `decompose.ts`'s shape).
   */
  const seedCard = async (db: Awaited<ReturnType<typeof builder.createDatabase>>['db']) => {
    const bookmark = db.add(Bookmark.make({ title: 'Effect docs', url: 'https://effect.website' }));
    const annotation = db.add(
      Message.make({
        sender: 'user',
        blocks: [
          { _tag: 'text', text: 'Effect provides structured concurrency primitives.' },
          {
            _tag: 'text',
            text: 'Should we adopt this pattern for the new module? Follow up with the team about migration timeline.',
          },
        ],
        properties: { readwiseId: 'rw-1' },
      }),
    );
    db.add(Relation.make(AnchoredTo.AnchoredTo, { [Relation.Source]: annotation, [Relation.Target]: bookmark }));

    const card = db.add(Task.make({ title: 'Effect provides structured concurrency primitives.', status: 'todo' }));
    db.add(Relation.make(AnchoredTo.AnchoredTo, { [Relation.Source]: card, [Relation.Target]: annotation }));

    const feed = db.add(Feed.make());
    const chat = db.add(Chat.make({ feed: Ref.make(feed) }));
    db.add(Relation.make(Chat.CompanionTo, { [Relation.Source]: chat, [Relation.Target]: card }));

    const suggestion = Message.make({
      sender: 'assistant',
      blocks: [{ _tag: 'text', text: 'Found 2 candidate items.' }],
      properties: {
        suggestedItems: [
          { suggestedKind: 'question', text: 'Should we adopt this pattern for the new module?' },
          { suggestedKind: 'comment', text: 'Effect provides structured concurrency primitives.' },
        ],
      },
    });
    await db.appendToFeed(feed, [suggestion]);

    await db.flush();
    return { bookmark, annotation, card, feed, chat, suggestion };
  };

  const run = <A>(effect: Effect.Effect<A, unknown>) => EffectEx.runAndForwardErrors(effect);

  test(
    'accepted decisions materialize typed, anchored, linked results; rejected produces nothing',
    async ({ expect }) => {
      const db = await createDb();
      try {
        const { bookmark, card, feed } = await seedCard(db);

        const { results } = await run(
          confirmItems(
            { db },
            card,
            [
              {
                suggestedKind: 'question',
                finalKind: 'question',
                text: 'Should we adopt this pattern for the new module?',
                accept: true,
              },
              {
                suggestedKind: 'comment',
                finalKind: 'comment',
                text: 'Effect provides structured concurrency primitives.',
                note: 'Worth remembering.',
                accept: true,
              },
              {
                suggestedKind: 'todo',
                finalKind: 'todo',
                text: 'Follow up with the team about migration timeline.',
                accept: false,
              },
            ],
          ),
        );
        await db.flush();

        // Exactly one accepted result per accepted decision; the rejected item produced nothing.
        expect(results.length).toBe(2);

        const questionTasks = await db
          .query(Query.select(Filter.type(Task.Task)).select(Filter.tag(resultKindRegistry.question.tag)))
          .run();
        expect(questionTasks.length).toBe(1);
        expect(questionTasks[0].status).toBe('todo');
        expect(questionTasks[0].project).toBeUndefined();

        const commentMessages = await db
          .query(Query.select(Filter.type(Message.Message)).select(Filter.tag(resultKindRegistry.comment.tag)))
          .run();
        expect(commentMessages.length).toBe(1);
        expect(Message.extractText(commentMessages[0])).toContain('Effect provides structured concurrency primitives.');
        expect(Message.extractText(commentMessages[0])).toContain('Worth remembering.');

        // No Task tagged `todo` (the rejected item's kind) was created.
        const todoTasks = await db
          .query(Query.select(Filter.type(Task.Task)).select(Filter.tag(resultKindRegistry.todo.tag)))
          .run();
        expect(todoTasks.length).toBe(0);

        // Both results are anchored to the source Bookmark, and linked back to the card.
        for (const result of [questionTasks[0], commentMessages[0]]) {
          const anchors = await db.query(Query.select(Filter.id(result.id)).sourceOf(AnchoredTo.AnchoredTo)).run();
          const anchorTargets = anchors.map((relation) => Relation.getTarget(relation).id);
          expect(anchorTargets).toContain(bookmark.id);
          expect(anchorTargets).toContain(card.id);
        }

        // The resolution is recorded against the suggestion message. A feed is append-only (no
        // in-place mutation of an existing entry — see `confirm.ts`'s `recordResolution` doc
        // comment), so the resolution is a new feed message referencing the suggestion by id.
        const feedMessages = await db.queryFeed(feed, Filter.type(Message.Message)).run();
        const suggestion = feedMessages.find((message) => Array.isArray(message.properties?.suggestedItems));
        expect(suggestion).toBeDefined();

        const resolutionMessage = feedMessages.find(
          (message) => message.properties?.resolutionOf === suggestion?.id,
        );
        expect(resolutionMessage).toBeDefined();
        const resolution = resolutionMessage?.properties?.resolution as
          | ReadonlyArray<{ suggestedKind: string; finalKind: string; accept: boolean; resultId?: string }>
          | undefined;
        expect(resolution?.length).toBe(3);
        expect(resolution?.filter((entry) => entry.accept).every((entry) => typeof entry.resultId === 'string')).toBe(
          true,
        );
        expect(resolution?.find((entry) => entry.accept === false)?.resultId).toBeUndefined();

        // The card moved to Done.
        const reloadedCard = await db.query(Filter.id(card.id)).first();
        expect(reloadedCard.status).toBe('done');
      } finally {
        await builder.close();
      }
    },
  );
});

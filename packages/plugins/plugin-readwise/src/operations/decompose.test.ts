//
// Copyright 2026 DXOS.org
//

import * as LanguageModel from '@effect/ai/LanguageModel';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import { afterEach, beforeEach, describe, test } from 'vitest';

import { AiService } from '@dxos/ai';
import { Chat } from '@dxos/assistant-toolkit';
import { Feed, Filter, Query, Relation } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { EffectEx } from '@dxos/effect';
import { AnchoredTo, Message, Task } from '@dxos/types';

import { type SuggestedItem, decomposeAnnotation } from './decompose';

/** Canned decomposition the mock AI returns: one question and one todo, each preserving source text. */
const MOCK_DECOMPOSITION = {
  items: [
    { suggestedKind: 'question', text: 'Should we adopt this pattern for the new module?' },
    { suggestedKind: 'todo', text: 'Follow up with the team about migration timeline.' },
  ],
};

/**
 * Deterministic `AiService` layer whose model always resolves `generateObject` to the canned
 * decomposition, using real `GenerateObjectResponse`/`GenerateTextResponse` instances (rather than
 * plain object literals) so the response shape is genuine. `LanguageModel.Service['generateObject']`
 * is generic over the caller's requested result type `A` — a fixed test double can't produce a value
 * of an arbitrary caller-chosen `A` without a cast at that one boundary (same shape as every other
 * `LanguageModel` mock in the repo, e.g. `pipeline-transcription/src/stages/correction-llm.test.ts`).
 */
const mockAiServiceLayer = Layer.succeed(AiService.AiService, {
  model: () =>
    Layer.succeed(
      LanguageModel.LanguageModel,
      {
        generateObject: () => Effect.succeed(new LanguageModel.GenerateObjectResponse(MOCK_DECOMPOSITION, [])),
        generateText: () => Effect.succeed(new LanguageModel.GenerateTextResponse([])),
        streamText: () => Stream.empty,
      } as LanguageModel.Service,
    ),
});

describe('decomposeAnnotation', () => {
  let builder: EchoTestBuilder;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
  });

  afterEach(async () => {
    await builder.close();
  });

  /** Seeds an annotation Message (passage + note) and a triage Task anchored to it. */
  const seedCard = async (db: Awaited<ReturnType<typeof builder.createDatabase>>['db']) => {
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
    const card = db.add(Task.make({ title: 'Effect provides structured concurrency primitives.', status: 'todo' }));
    db.add(Relation.make(AnchoredTo.AnchoredTo, { [Relation.Source]: card, [Relation.Target]: annotation }));
    await db.flush();
    return { annotation, card };
  };

  const run = <A>(effect: Effect.Effect<A, unknown, AiService.AiService>) =>
    EffectEx.runAndForwardErrors(effect.pipe(Effect.provide(mockAiServiceLayer)));

  test('writes the AI decomposition as the first companion-chat message', async ({ expect }) => {
    const { db } = await builder.createDatabase({
      types: [Message.Message, Task.Task, AnchoredTo.AnchoredTo, Chat.Chat, Chat.CompanionTo, Feed.Feed],
    });
    const { card } = await seedCard(db);

    const chat = await run(decomposeAnnotation({ db }, card));
    await db.flush();

    const feed = chat.feed.target!;
    const feedMessages = await db.queryFeed(feed, Filter.type(Message.Message)).run();
    expect(feedMessages.length).toBe(1);

    const suggestion = feedMessages[0];
    // `Message.properties` is an untyped `Record<string, unknown>` on the schema (a shared bag for
    // many message kinds) — read back defensively, mirroring `capture.ts`'s `propertiesEqual`.
    const suggestedItems = suggestion.properties?.suggestedItems as readonly SuggestedItem[] | undefined;
    if (!suggestedItems) {
      throw new Error('Expected the suggestion message to carry properties.suggestedItems.');
    }
    expect(suggestedItems.some((item) => item.suggestedKind === 'question')).toBe(true);
    expect(suggestedItems.some((item) => item.suggestedKind === 'todo')).toBe(true);
    for (const item of suggestedItems) {
      expect(item.text.length).toBeGreaterThan(0);
    }

    // A human-readable summary is present alongside the structured payload.
    expect(Message.extractText(suggestion).length).toBeGreaterThan(0);

    // The chat is linked to the card via `Chat.CompanionTo`.
    const companions = await db.query(Query.select(Filter.id(card.id)).targetOf(Chat.CompanionTo).source()).run();
    expect(companions.some((companion) => companion.id === chat.id)).toBe(true);
  });

  test('is idempotent — a second call does not add a second suggestion message', async ({ expect }) => {
    const { db } = await builder.createDatabase({
      types: [Message.Message, Task.Task, AnchoredTo.AnchoredTo, Chat.Chat, Chat.CompanionTo, Feed.Feed],
    });
    const { card } = await seedCard(db);

    const first = await run(decomposeAnnotation({ db }, card));
    await db.flush();
    const second = await run(decomposeAnnotation({ db }, card));
    await db.flush();

    expect(second.id).toBe(first.id);

    const feed = first.feed.target!;
    const feedMessages = await db.queryFeed(feed, Filter.type(Message.Message)).run();
    expect(feedMessages.length).toBe(1);
  });
});

//
// Copyright 2026 DXOS.org
//

import * as LanguageModel from '@effect/ai/LanguageModel';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { AiService } from '@dxos/ai';
import { Chat } from '@dxos/assistant-toolkit';
import { type Database, Feed, Filter, Obj, Query, Ref, Relation } from '@dxos/echo';
import { AnchoredTo, Message, Task } from '@dxos/types';
import { trim } from '@dxos/util';

import { ReadwiseError } from '../errors';
import { INTENT_KINDS, type IntentKind } from '../types';

/** Model used for the one-shot decomposition call — mirrors `generate-home-suggestions.ts`'s use of a fast model. */
const MODEL = 'com.anthropic.model.claude-haiku-4-5.default';

/** The subset of `Client.Space` this module needs — mirrors `capture.ts`'s `CaptureSpace`. */
export interface DecomposeSpace {
  readonly db: Database.Database;
}

/** One candidate item proposed by the AI decomposition, before Steve confirms/edits it (Task 11). */
export interface SuggestedItem {
  readonly suggestedKind: IntentKind;
  readonly text: string;
  readonly note?: string;
}

/** Structured-output schema for the decomposition call: 0+ candidate items, each classified. */
const DecompositionSchema = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      suggestedKind: Schema.Literal(...INTENT_KINDS),
      text: Schema.String,
      note: Schema.optional(Schema.String),
    }),
  ),
});

/**
 * Finds the annotation `Message` anchored to `card` (the Task is the `AnchoredTo` relation source,
 * the Message is the target — see `capture.ts`'s `upsertTriageTask`).
 */
const findAnnotation = (db: Database.Database, card: Task.Task): Effect.Effect<Message.Message, ReadwiseError> =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.id(card.id)).sourceOf(AnchoredTo.AnchoredTo).target()).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query the card’s anchored annotation.', cause }),
  }).pipe(
    Effect.flatMap((targets) => {
      const annotation = targets.find(Obj.instanceOf(Message.Message));
      return annotation
        ? Effect.succeed(annotation)
        : Effect.fail(new ReadwiseError({ message: 'Card has no anchored annotation Message.' }));
    }),
  );

/** Finds the persisted companion `Chat` for `card` via the `Chat.CompanionTo` relation, if any. */
const findCompanionChat = (db: Database.Database, card: Task.Task): Effect.Effect<Chat.Chat | undefined, ReadwiseError> =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.id(card.id)).targetOf(Chat.CompanionTo).source()).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query the card’s companion Chat.', cause }),
  }).pipe(Effect.map((sources) => sources.at(-1)));

/**
 * Finds-or-creates the persisted companion `Chat` for `card`. Unlike `AssistantOperation.EnsureCompanionChat`
 * (which returns a transient, unpersisted chat when none exists yet — it's wired for UI-driven, on-demand
 * provisioning of ad-hoc conversations), this always persists: Task 11 must be able to read the suggestion
 * message back from the space on a later invocation, so an in-memory-only chat would lose the proposal.
 */
const ensureCompanionChat = (db: Database.Database, card: Task.Task): Effect.Effect<Chat.Chat, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findCompanionChat(db, card);
    if (existing) {
      return existing;
    }

    const feed = db.add(Feed.make());
    const chat = db.add(Chat.make({ feed: Ref.make(feed) }));
    db.add(
      Relation.make(Chat.CompanionTo, {
        [Relation.Source]: chat,
        [Relation.Target]: card,
      }),
    );
    return chat;
  });

/** True when `message.properties.suggestedItems` is present — the marker the idempotency check looks for. */
const isSuggestionMessage = (message: Message.Message): boolean =>
  Array.isArray(message.properties?.suggestedItems);

/** Finds the existing suggestion `Message` in `chat`'s feed, if the decomposition already ran. */
const findExistingSuggestion = (
  db: Database.Database,
  chat: Chat.Chat,
): Effect.Effect<Message.Message | undefined, ReadwiseError> =>
  Effect.gen(function* () {
    const feed = chat.feed.target;
    if (!feed) {
      return undefined;
    }
    const messages = yield* Effect.tryPromise({
      try: () => db.queryFeed(feed, Filter.type(Message.Message)).run(),
      catch: (cause) => new ReadwiseError({ message: 'Failed to query the companion chat’s feed.', cause }),
    });
    return messages.find(isSuggestionMessage);
  });

/** Builds the decomposition prompt for one annotation: the highlighted passage plus Steve's note. */
const buildPrompt = (annotation: Message.Message): string =>
  trim`
    Split the highlight and note below into 0 or more candidate items. Each item must be tagged with
    exactly one kind — "comment" (an observation, needs no action), "question" (something to look
    into or ask), or "todo" (an action to take) — and must preserve the exact source text verbatim
    (do not paraphrase or summarize).

    ${Message.extractText(annotation)}
  `;

/**
 * Runs the AI decomposition over `annotation`, returning the candidate items (possibly empty). Any
 * failure — model unavailable, malformed structured output — degrades to an empty list rather than
 * failing the whole operation, since a companion chat with a "no suggestions" message is still a
 * useful outcome for Steve to see and confirm/edit by hand.
 */
const runDecomposition = (annotation: Message.Message): Effect.Effect<readonly SuggestedItem[], never, AiService.AiService> =>
  Effect.scoped(
    LanguageModel.generateObject({
      schema: DecompositionSchema,
      prompt: buildPrompt(annotation),
    }),
  ).pipe(
    Effect.map(({ value }) => value.items),
    Effect.provide(AiService.model(MODEL)),
    Effect.catchAll(() => Effect.succeed<readonly SuggestedItem[]>([])),
  );

/** Renders a human-readable summary of `items` for the suggestion message's text block. */
const summarize = (items: readonly SuggestedItem[]): string =>
  items.length === 0
    ? 'No candidate items found in this annotation.'
    : items.map((item) => `[${item.suggestedKind}] ${item.text}`).join('\n');

/**
 * Decomposes a triage card's annotation into candidate items, persisting the proposal as the first
 * `Message` in the card's companion `Chat` feed (`properties.suggestedItems`, consumed by Task 11's
 * confirmation step). Idempotent: if a suggestion message already exists on the chat, the existing
 * chat is returned unchanged rather than re-running the AI call.
 */
export const decomposeAnnotation = (
  space: DecomposeSpace,
  card: Task.Task,
): Effect.Effect<Chat.Chat, ReadwiseError, AiService.AiService> =>
  Effect.gen(function* () {
    const { db } = space;
    const chat = yield* ensureCompanionChat(db, card);

    const existingSuggestion = yield* findExistingSuggestion(db, chat);
    if (existingSuggestion) {
      return chat;
    }

    const annotation = yield* findAnnotation(db, card);
    const items = yield* runDecomposition(annotation);

    const suggestion = Message.make({
      sender: 'assistant',
      blocks: [{ _tag: 'text', text: summarize(items) }],
      properties: { suggestedItems: items },
    });

    const feed = chat.feed.target;
    if (!feed) {
      return yield* Effect.fail(new ReadwiseError({ message: 'Companion chat has no feed.' }));
    }
    yield* Effect.tryPromise({
      try: () => db.appendToFeed(feed, [suggestion]),
      catch: (cause) => new ReadwiseError({ message: 'Failed to append the suggestion message to the chat feed.', cause }),
    });

    return chat;
  });

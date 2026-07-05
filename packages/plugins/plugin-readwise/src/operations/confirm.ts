//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { type Database, Filter, Obj, Query, Ref, Relation } from '@dxos/echo';
import { URI } from '@dxos/keys';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { AnchoredTo, Message, Task } from '@dxos/types';

import { ReadwiseError } from '../errors';
import { type IntentKind, representationFor, resultKindRegistry } from '../types';
import { findAnnotation, findCompanionChat, findExistingSuggestion } from './decompose';

/** The subset of `Client.Space` this module needs — mirrors `capture.ts`'s `CaptureSpace`. */
export interface ConfirmSpace {
  readonly db: Database.Database;
}

/** Steve's confirm/edit/reject decision over one AI-suggested item (Task 10's `SuggestedItem`). */
export interface Decision {
  readonly suggestedKind: IntentKind;
  readonly finalKind: IntentKind;
  readonly text: string;
  readonly note?: string;
  readonly accept: boolean;
}

/** Result of {@link confirmItems}: the typed objects materialized for the accepted decisions, in order. */
export interface ConfirmResult {
  readonly results: readonly Obj.Any[];
}

/** One entry recorded in the suggestion message's `properties.resolution`, mirroring a {@link Decision}. */
type ResolutionEntry = {
  readonly suggestedKind: IntentKind;
  readonly finalKind: IntentKind;
  readonly accept: boolean;
  readonly resultId?: string;
};

/**
 * Finds the `Bookmark` the card's annotation `Message` is anchored to (Message is the `AnchoredTo`
 * relation source, Bookmark is the target — see `capture.ts`'s `ensureAnchor`). This is the
 * source-document anchor every materialized result is also anchored to.
 */
const findSourceBookmark = (
  db: Database.Database,
  annotation: Message.Message,
): Effect.Effect<Bookmark.Bookmark, ReadwiseError> =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.id(annotation.id)).sourceOf(AnchoredTo.AnchoredTo).target()).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query the annotation’s source Bookmark.', cause }),
  }).pipe(
    Effect.flatMap((targets) => {
      const bookmark = targets.find(Obj.instanceOf(Bookmark.Bookmark));
      return bookmark
        ? Effect.succeed(bookmark)
        : Effect.fail(new ReadwiseError({ message: 'Annotation has no anchored source Bookmark.' }));
    }),
  );

/** Builds the `Message.blocks` for a materialized result: the passage text, plus the note when present. */
const blocksFor = (decision: Decision): Array<{ readonly _tag: 'text'; readonly text: string }> => {
  const blocks: Array<{ _tag: 'text'; text: string }> = [{ _tag: 'text', text: decision.text }];
  if (decision.note) {
    blocks.push({ _tag: 'text', text: decision.note });
  }
  return blocks;
};

/** Maximum length of the passage snippet used as a materialized `Task.title`. */
const RESULT_TITLE_MAX_LENGTH = 80;

/** Truncates `text` to {@link RESULT_TITLE_MAX_LENGTH} characters, appending an ellipsis when cut. */
const truncateTitle = (text: string): string =>
  text.length > RESULT_TITLE_MAX_LENGTH ? `${text.slice(0, RESULT_TITLE_MAX_LENGTH).trimEnd()}…` : text;

/** The intent tag `Ref` for `kind`, constructed the same way `capture.ts`'s `upsertTriageTask` does. */
const tagRefFor = (kind: IntentKind) => Ref.fromURI(URI.make(resultKindRegistry[kind].tag));

/**
 * Materializes one accepted {@link Decision} as its typed result: a `Message` (comment) or a `Task`
 * (question/todo, `status:'todo'`, `project` left unset — the future-work hook), tagged with the
 * final kind's intent tag and populated with the passage text plus note.
 */
const materialize = (decision: Decision): Obj.Any => {
  const representation = representationFor(decision.finalKind);
  if (representation === 'message') {
    return Message.make({
      [Obj.Meta]: { tags: [tagRefFor(decision.finalKind)] },
      sender: 'user',
      blocks: blocksFor(decision),
    });
  }

  return Task.make({
    [Obj.Meta]: { tags: [tagRefFor(decision.finalKind)] },
    title: truncateTitle(decision.text),
    description: decision.note,
    status: 'todo',
  });
};

/**
 * Anchors `result` to `bookmark` (the source document) and links it back to `card`, both as
 * `AnchoredTo` relations with `result` as the source — the same source/target convention
 * `capture.ts` uses for Message→Bookmark and Task→Message anchors. A single relation kind covers
 * both edges since `AnchoredTo`'s source/target are `Obj.Unknown` (untyped by design).
 */
const linkResult = (db: Database.Database, result: Obj.Any, bookmark: Bookmark.Bookmark, card: Task.Task): void => {
  db.add(Relation.make(AnchoredTo.AnchoredTo, { [Relation.Source]: result, [Relation.Target]: bookmark }));
  db.add(Relation.make(AnchoredTo.AnchoredTo, { [Relation.Source]: result, [Relation.Target]: card }));
};

/**
 * Records the confirmation resolution for the companion-chat suggestion message (the same message
 * `decomposeAnnotation` created), so a later view of the chat shows what became of each proposal. A
 * feed is an append-only queue with no in-place mutation — its one-shot query path
 * (`FeedQueryContext.run` in `@dxos/echo-client`) re-hydrates every appended block independently and
 * does not collapse re-appends of the same id, so `Obj.update`-ing a feed-hydrated message only
 * mutates a throwaway decoded proxy rather than persisting. Recording the resolution therefore
 * appends a new `Message` carrying `properties.resolution` and `properties.resolutionOf` (the
 * suggestion's id), rather than mutating the suggestion in place. A no-op (rather than a failure)
 * when no suggestion message exists yet — confirming should not require a prior decomposition run.
 */
const recordResolution = (
  db: Database.Database,
  card: Task.Task,
  resolution: readonly ResolutionEntry[],
): Effect.Effect<void, ReadwiseError> =>
  Effect.gen(function* () {
    const chat = yield* findCompanionChat(db, card);
    if (!chat) {
      return;
    }
    const feed = chat.feed.target;
    const suggestion = yield* findExistingSuggestion(db, chat);
    if (!feed || !suggestion) {
      return;
    }

    const resolutionMessage = Message.make({
      sender: 'assistant',
      blocks: [{ _tag: 'text', text: 'Confirmed.' }],
      properties: { resolutionOf: suggestion.id, resolution },
    });
    yield* Effect.tryPromise({
      try: () => db.appendToFeed(feed, [resolutionMessage]),
      catch: (cause) => new ReadwiseError({ message: 'Failed to record the resolution on the suggestion message.', cause }),
    });
  });

/**
 * Confirms Steve's triage decisions over the AI's suggested items, materializing each accepted
 * decision as a real typed object (`Message` for `comment`, `Task` for `question`/`todo`), anchored
 * to the source `Bookmark` and linked back to `card`. Rejected decisions materialize nothing. The
 * resolution (what happened to each decision) is recorded on the companion-chat suggestion message,
 * and `card.status` is set to `'done'` — this is the terminal step of the triage flow.
 */
export const confirmItems = (
  space: ConfirmSpace,
  card: Task.Task,
  decisions: readonly Decision[],
): Effect.Effect<ConfirmResult, ReadwiseError> =>
  Effect.gen(function* () {
    const { db } = space;
    const annotation = yield* findAnnotation(db, card);
    const bookmark = yield* findSourceBookmark(db, annotation);

    const results: Obj.Any[] = [];
    const resolution: ResolutionEntry[] = [];
    for (const decision of decisions) {
      if (!decision.accept) {
        resolution.push({
          suggestedKind: decision.suggestedKind,
          finalKind: decision.finalKind,
          accept: false,
        });
        continue;
      }

      const result = materialize(decision);
      db.add(result);
      linkResult(db, result, bookmark, card);
      results.push(result);
      resolution.push({
        suggestedKind: decision.suggestedKind,
        finalKind: decision.finalKind,
        accept: true,
        resultId: result.id,
      });
    }

    yield* recordResolution(db, card, resolution);

    Obj.update(card, (card) => {
      card.status = 'done';
    });

    return { results };
  });

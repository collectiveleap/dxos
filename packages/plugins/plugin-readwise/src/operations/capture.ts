//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { type Database, Filter, Obj, Query, Relation } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { AnchoredTo, Message } from '@dxos/types';

import { READWISE_SOURCE } from '../constants';
import { ReadwiseError } from '../errors';
import { type Highlight } from '../services';

/**
 * The subset of `Client.Space` this module needs. Kept structural (rather
 * than importing `@dxos/client-protocol`) since `space.db` is the only
 * member read — capture never touches space membership, properties, etc.
 */
export interface CaptureSpace {
  readonly db: Database.Database;
}

/** Result of one {@link captureHighlights} pass. */
export interface CaptureResult {
  readonly created: number;
  readonly updated: number;
}

const fkFor = (id: string) => ({ source: READWISE_SOURCE, id });

/**
 * Finds an existing object of `schema` carrying the Readwise foreign key `id`, if any. `T` is
 * forwarded untyped from `Filter.foreignKeys`'s result — the caller supplies the concrete result
 * type via the explicit type parameter, mirroring `plugin-linear`'s `findByForeignId`.
 */
const findByForeignId = <T>(db: Database.Database, schema: Parameters<typeof Filter.foreignKeys>[0], id: string) =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.foreignKeys(schema, [fkFor(id)]))).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query captured Readwise objects.', cause }),
  }).pipe(Effect.map((results) => results[0] as T | undefined));

/**
 * Upserts the document-level `Bookmark` for one highlight's source document, deduped by
 * `sourceId` (stable across re-syncs, unlike `sourceUrl` which may be absent). Returns whether a
 * new Bookmark was created.
 */
const upsertBookmark = (
  db: Database.Database,
  highlight: Highlight,
): Effect.Effect<{ bookmark: Bookmark.Bookmark; created: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Bookmark.Bookmark>(db, Bookmark.Bookmark, highlight.sourceId);
    if (existing) {
      return { bookmark: existing, created: false };
    }

    const created = db.add(
      Bookmark.make({
        [Obj.Meta]: { keys: [fkFor(highlight.sourceId)] },
        title: highlight.sourceTitle,
        url: highlight.sourceUrl ?? highlight.sourceUniqueUrl ?? '',
        image: highlight.sourceImage,
        excerpt: highlight.text || undefined,
      }),
    );
    return { bookmark: created, created: true };
  });

/** Builds the `Message.blocks` for one annotation: the highlighted passage, plus the note when non-empty. */
const blocksFor = (highlight: Highlight): Array<{ readonly _tag: 'text'; readonly text: string }> => {
  const blocks: Array<{ _tag: 'text'; text: string }> = [];
  if (highlight.text) {
    blocks.push({ _tag: 'text', text: highlight.text });
  }
  if (highlight.note) {
    blocks.push({ _tag: 'text', text: highlight.note });
  }
  return blocks;
};

/** `Message.properties` shape written by capture. Field order is fixed so comparisons are stable. */
type CaptureProperties = {
  readonly readwiseId: string;
  readonly location: number | undefined;
  readonly sourceTags: readonly string[];
};

/**
 * Structural equality for {@link CaptureProperties}, read off the stored (possibly reactive-proxy)
 * `Message.properties` value. Compares fields directly rather than via `JSON.stringify` — ECHO does
 * not guarantee the stored object enumerates keys in the order they were written.
 */
const propertiesEqual = (stored: unknown, next: CaptureProperties): boolean => {
  // `Message.properties` is typed as an untyped `Record<string, unknown>` on the schema (it's a
  // shared bag for many message kinds); this module owns the capture-specific shape and reads it
  // back defensively via `Partial<>` rather than trusting the record's declared type.
  const candidate = stored as Partial<CaptureProperties> | undefined;
  if (!candidate) {
    return false;
  }
  return (
    candidate.readwiseId === next.readwiseId &&
    candidate.location === next.location &&
    JSON.stringify(candidate.sourceTags ?? []) === JSON.stringify(next.sourceTags)
  );
};

/**
 * Upserts the annotation `Message` for one highlight, deduped by `readwiseId` stored in
 * `Message.properties.readwiseId`. An existing Message has its blocks/properties refreshed in
 * place (rather than creating a new one) when the source note changed. Returns whether a new
 * Message was created and whether an existing one was updated.
 */
const upsertMessage = (
  db: Database.Database,
  highlight: Highlight,
): Effect.Effect<{ message: Message.Message; created: boolean; updated: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Message.Message>(db, Message.Message, highlight.readwiseId);
    const blocks = blocksFor(highlight);
    const properties: CaptureProperties = {
      readwiseId: highlight.readwiseId,
      location: highlight.location,
      sourceTags: highlight.tags,
    };

    if (existing) {
      const changed =
        Message.extractText(existing) !== blocks.map((block) => block.text).join('\n') ||
        !propertiesEqual(existing.properties, properties);
      if (changed) {
        Obj.update(existing, (existing) => {
          existing.blocks = blocks;
          existing.properties = properties;
        });
      }
      return { message: existing, created: false, updated: changed };
    }

    const created = db.add(
      Message.make({
        [Obj.Meta]: { keys: [fkFor(highlight.readwiseId)] },
        created: highlight.updated,
        sender: { role: 'user' },
        blocks,
        properties,
      }),
    );
    return { message: created, created: true, updated: false };
  });

/** True when `message` is already anchored to `bookmark` via an `AnchoredTo` relation. */
const isAnchored = (db: Database.Database, message: Message.Message, bookmark: Bookmark.Bookmark) =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.id(message.id)).targetOf(AnchoredTo.AnchoredTo)).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query AnchoredTo relations.', cause }),
  }).pipe(
    Effect.map((relations) => relations.some((relation) => Relation.getTarget(relation).id === bookmark.id)),
  );

/** Ensures an `AnchoredTo` relation exists from `message` to `bookmark`, creating one if absent. */
const ensureAnchor = (
  db: Database.Database,
  message: Message.Message,
  bookmark: Bookmark.Bookmark,
): Effect.Effect<void, ReadwiseError> =>
  Effect.gen(function* () {
    const anchored = yield* isAnchored(db, message, bookmark);
    if (!anchored) {
      db.add(
        Relation.make(AnchoredTo.AnchoredTo, {
          [Relation.Source]: message,
          [Relation.Target]: bookmark,
        }),
      );
    }
  });

/**
 * Idempotently captures a batch of Readwise `Highlight`s as ECHO objects: one `Bookmark` per
 * distinct source document, one annotation `Message` per highlight (including synthetic
 * document-note annotations), and an `AnchoredTo` relation linking each Message to its document's
 * Bookmark. Re-running with the same (or a superset of) `highlights` creates no duplicates —
 * dedup keys are `sourceId` (Bookmark) and `readwiseId` (Message), both stored as ECHO foreign
 * keys. A highlight whose `note` changed since the last capture updates the existing Message
 * in place.
 */
export const captureHighlights = (
  space: CaptureSpace,
  highlights: readonly Highlight[],
): Effect.Effect<CaptureResult, ReadwiseError> =>
  Effect.gen(function* () {
    const { db } = space;
    let created = 0;
    let updated = 0;

    const bookmarksBySourceId = new Map<string, Bookmark.Bookmark>();
    for (const highlight of highlights) {
      let bookmark = bookmarksBySourceId.get(highlight.sourceId);
      if (!bookmark) {
        const result = yield* upsertBookmark(db, highlight);
        bookmark = result.bookmark;
        bookmarksBySourceId.set(highlight.sourceId, bookmark);
        if (result.created) {
          created++;
        }
      }

      const messageResult = yield* upsertMessage(db, highlight);
      if (messageResult.created) {
        created++;
      }
      if (messageResult.updated) {
        updated++;
      }

      yield* ensureAnchor(db, messageResult.message, bookmark);
    }

    return { created, updated };
  });

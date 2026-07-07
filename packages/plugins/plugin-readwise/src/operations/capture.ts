//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { type Database, Filter, Obj, Query, Ref } from '@dxos/echo';
import { Bookmark } from '@dxos/plugin-bookmarks';
import { Capture } from '@dxos/plugin-sensemaking/types';

import { CANONICAL_URL_SOURCE, READWISE_SOURCE } from '../constants';
import { ReadwiseError } from '../errors';
import { type Highlight as WireHighlight, canonicalizeUrl } from '../services';
import { Highlight, type Readwise } from '../types';

/** The subset of state capture needs: the space db and the account container highlights belong to. */
export interface CaptureSpace {
  readonly db: Database.Database;
  readonly container: Readwise.Readwise;
}

/** Result of one {@link captureHighlights} pass. `created` = new Bookmarks + new Highlights. */
export interface CaptureResult {
  readonly created: number;
  readonly updated: number;
}

const fkFor = (id: string) => ({ source: READWISE_SOURCE, id });

/**
 * Finds an existing object of `schema` carrying the Readwise foreign key `id`, if any. `T` is
 * forwarded untyped from `Filter.foreignKeys`'s result; the caller supplies the concrete result type.
 */
const findByForeignId = <T>(db: Database.Database, schema: Parameters<typeof Filter.foreignKeys>[0], id: string) =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.foreignKeys(schema, [fkFor(id)]))).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query captured Readwise objects.', cause }),
    // `Filter.foreignKeys` returns an untyped result array with no typed alternative; the caller
    // supplies the concrete element type via the explicit type parameter.
  }).pipe(Effect.map((results) => results[0] as T | undefined));

/**
 * Upserts the document-level `Bookmark` for one highlight's source document, deduped by `sourceId`.
 * Returns whether a new Bookmark was created.
 */
const upsertBookmark = (
  db: Database.Database,
  highlight: WireHighlight,
): Effect.Effect<{ bookmark: Bookmark.Bookmark; created: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Bookmark.Bookmark>(db, Bookmark.Bookmark, highlight.sourceId);
    if (existing) {
      return { bookmark: existing, created: false };
    }
    const url = highlight.sourceUrl ?? highlight.sourceUniqueUrl ?? '';
    const canonicalUrl = canonicalizeUrl(url);
    const keys = [fkFor(highlight.sourceId)];
    if (canonicalUrl) {
      keys.push({ source: CANONICAL_URL_SOURCE, id: canonicalUrl });
    }
    const created = db.add(
      Bookmark.make({
        [Obj.Meta]: { keys },
        title: highlight.sourceTitle,
        url,
        image: highlight.sourceImage,
        excerpt: highlight.text || undefined,
      }),
    );
    return { bookmark: created, created: true };
  });

/** True when a highlight's mutable content (note, tags, origin) differs from what is stored. */
const contentChanged = (stored: Highlight.Highlight, next: WireHighlight): boolean =>
  (stored.note ?? undefined) !== (next.note || undefined) ||
  JSON.stringify([...stored.tags]) !== JSON.stringify(next.tags) ||
  stored.origin !== next.origin;

/**
 * Upserts the `Highlight` for one wire highlight, deduped by `readwiseId` (stored as an ECHO foreign
 * key). An existing Highlight whose note/tags changed is updated in place. Returns creation/update flags.
 */
const upsertHighlight = (
  db: Database.Database,
  container: Readwise.Readwise,
  bookmark: Bookmark.Bookmark,
  highlight: WireHighlight,
): Effect.Effect<{ highlight: Highlight.Highlight; created: boolean; updated: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Highlight.Highlight>(db, Highlight.Highlight, highlight.readwiseId);
    if (existing) {
      const changed = contentChanged(existing, highlight);
      if (changed) {
        Obj.update(existing, (existing) => {
          existing.note = highlight.note || undefined;
          existing.tags = [...highlight.tags];
          existing.origin = highlight.origin;
        });
      }
      return { highlight: existing, created: false, updated: changed };
    }
    const created = db.add(
      Highlight.make({
        [Obj.Meta]: { keys: [fkFor(highlight.readwiseId)] },
        text: highlight.text,
        note: highlight.note || undefined,
        tags: [...highlight.tags],
        readwiseId: highlight.readwiseId,
        updated: highlight.updated,
        source: Ref.make(bookmark),
        container: Ref.make(container),
        origin: highlight.origin,
      }),
    );
    return { highlight: created, created: true, updated: false };
  });

/**
 * Idempotently captures one sensemaking `Capture` per Highlight, deduped by the Highlight's Readwise
 * foreign key (the schema filter distinguishes it from the Highlight sharing that key). The Capture's
 * `source` refs the Highlight and its `referent` refs the source Bookmark, so the Inbox clusters by
 * referent without knowing the source type.
 */
const upsertCapture = (
  db: Database.Database,
  highlightObj: Highlight.Highlight,
  bookmark: Bookmark.Bookmark,
  highlight: WireHighlight,
): Effect.Effect<{ created: boolean }, ReadwiseError> =>
  Effect.gen(function* () {
    const existing = yield* findByForeignId<Capture.Capture>(db, Capture.Capture, highlight.readwiseId);
    if (existing) {
      return { created: false };
    }
    db.add(
      Capture.make({
        [Obj.Meta]: { keys: [fkFor(highlight.readwiseId)] },
        source: Ref.make(highlightObj),
        referent: Ref.make(bookmark),
        flaggedAt: highlight.updated,
      }),
    );
    return { created: true };
  });

/**
 * Idempotently captures a batch of Readwise wire highlights as ECHO objects: one `Bookmark` per
 * distinct source document and one `Highlight` per highlight, each related to its source Bookmark and
 * to the `Readwise` account container. Re-running with the same (or a superset of) highlights creates
 * no duplicates; a highlight whose note/tags changed updates the existing Highlight in place.
 */
export const captureHighlights = (
  space: CaptureSpace,
  highlights: readonly WireHighlight[],
): Effect.Effect<CaptureResult, ReadwiseError> =>
  Effect.gen(function* () {
    const { db, container } = space;
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
      const highlightResult = yield* upsertHighlight(db, container, bookmark, highlight);
      if (highlightResult.created) {
        created++;
      }
      if (highlightResult.updated) {
        updated++;
      }
      yield* upsertCapture(db, highlightResult.highlight, bookmark, highlight);
    }

    return { created, updated };
  });

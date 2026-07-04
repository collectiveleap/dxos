//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { type Database, Filter, JsonSchema, Obj, Query } from '@dxos/echo';
import { Kanban } from '@dxos/plugin-kanban';
import { ViewModel } from '@dxos/schema';
import { Task } from '@dxos/types';

import { READWISE_SOURCE, TRIAGE_TAG } from '../constants';
import { ReadwiseError } from '../errors';

/**
 * The subset of `Client.Space` this module needs — mirrors `capture.ts`'s `CaptureSpace`, kept
 * structural rather than importing `@dxos/client-protocol`.
 */
export interface BoardSpace {
  readonly db: Database.Database;
}

/** Foreign key stamped on the triage board so it can be found again across syncs (see {@link findTriageBoard}). */
export const TRIAGE_BOARD_FOREIGN_KEY = { source: READWISE_SOURCE, id: 'triage-board' };

/** True when `kanban` is the one triage board `ensureTriageBoard` materializes (matched by {@link TRIAGE_BOARD_FOREIGN_KEY}). */
export const isTriageBoard = (kanban: Kanban.Kanban): boolean =>
  Obj.getMeta(kanban).keys.some(
    (key) => key.source === TRIAGE_BOARD_FOREIGN_KEY.source && key.id === TRIAGE_BOARD_FOREIGN_KEY.id,
  );

/**
 * Finds the triage `Kanban` already materialized in this space, if any, matched by
 * {@link TRIAGE_BOARD_FOREIGN_KEY} (mirrors `plugin-trello`'s `findKanbanForBoard`).
 */
const findTriageBoard = (db: Database.Database): Effect.Effect<Kanban.Kanban | undefined, ReadwiseError> =>
  Effect.tryPromise({
    try: () => db.query(Query.select(Filter.foreignKeys(Kanban.Kanban, [TRIAGE_BOARD_FOREIGN_KEY]))).run(),
    catch: (cause) => new ReadwiseError({ message: 'Failed to query the triage Kanban board.', cause }),
  }).pipe(Effect.map((results) => results[0]));

/**
 * Builds the triage board's `View`: queries `Task` scoped to {@link TRIAGE_TAG} (the same
 * `Filter.tag(TRIAGE_TAG)` handle `capture.ts` proved matches the triage cards), pivoting on
 * `status` so the board's columns render `todo` / `in-progress` / `done`.
 */
const makeTriageView = () =>
  ViewModel.make({
    query: Query.select(Filter.type(Task.Task)).select(Filter.tag(TRIAGE_TAG)),
    jsonSchema: JsonSchema.toJsonSchema(Task.Task),
    pivotFieldName: 'status',
  });

/**
 * Finds-or-creates the one tag-scoped triage `Kanban` for `space`: a view-variant board whose
 * `View` filters `Task` by {@link TRIAGE_TAG} and pivots on `status`. Idempotent — called once per
 * sync (see `sync.ts`), re-running returns the same board rather than creating a duplicate,
 * deduped by {@link TRIAGE_BOARD_FOREIGN_KEY}.
 */
export const ensureTriageBoard = (space: BoardSpace): Effect.Effect<Kanban.Kanban, ReadwiseError> =>
  Effect.gen(function* () {
    const { db } = space;
    const existing = yield* findTriageBoard(db);
    if (existing) {
      return existing;
    }

    const view = makeTriageView();
    db.add(view);

    const kanban = db.add(Kanban.make({ name: 'Readwise Triage', view }));
    // `Kanban.make` has no meta param, so the foreign key `findTriageBoard` dedups by is stamped
    // on afterward, mirroring `plugin-ibkr`'s materialize-instrument pattern for post-hoc keys.
    Obj.update(kanban, (kanban) => {
      Obj.getMeta(kanban).keys.push(TRIAGE_BOARD_FOREIGN_KEY);
    });
    return kanban;
  });

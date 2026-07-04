//
// Copyright 2026 DXOS.org
//

import { afterEach, beforeEach, describe, test } from 'vitest';

import { Filter, Obj, Query, Ref, View } from '@dxos/echo';
import { EchoTestBuilder } from '@dxos/echo-client/testing';
import { EffectEx } from '@dxos/effect';
import { URI } from '@dxos/keys';
import { Kanban } from '@dxos/plugin-kanban';
import { Task } from '@dxos/types';

import { TRIAGE_TAG } from '../constants';
import { ensureTriageBoard } from './ensure-board';

describe('ensureTriageBoard', () => {
  let builder: EchoTestBuilder;

  beforeEach(async () => {
    builder = await new EchoTestBuilder().open();
  });

  afterEach(async () => {
    await builder.close();
  });

  test('finds-or-creates exactly one Kanban per space', async ({ expect }) => {
    const { db } = await builder.createDatabase({ types: [Kanban.Kanban, Task.Task, View.View] });
    const space = { db };

    const first = await EffectEx.runAndForwardErrors(ensureTriageBoard(space));
    const second = await EffectEx.runAndForwardErrors(ensureTriageBoard(space));

    expect(first.id).toBe(second.id);

    const boards = await db.query(Filter.type(Kanban.Kanban)).run();
    expect(boards.length).toBe(1);
  });

  test('the board View queries Task by TRIAGE_TAG and pivots on status', async ({ expect }) => {
    const { db } = await builder.createDatabase({ types: [Kanban.Kanban, Task.Task, View.View] });
    const space = { db };

    const board = await EffectEx.runAndForwardErrors(ensureTriageBoard(space));

    expect(board.spec.kind).toBe('view');
    const view = board.spec.kind === 'view' ? await board.spec.view.load() : undefined;
    expect(view).toBeDefined();

    const pivotFieldId = view!.projection.pivotFieldId;
    expect(pivotFieldId).toBeDefined();
    const pivotField = view!.projection.fields.find((field) => field.id === pivotFieldId);
    expect(pivotField?.path).toBe('status');

    // Seed one triage Task (tagged) and one non-triage Task (untagged); the board's View
    // query must return only the triage one — this re-proves the tag scoping through the View.
    const triageTask = db.add(
      Task.make({
        [Obj.Meta]: { tags: [Ref.fromURI(URI.make(TRIAGE_TAG))] },
        title: 'Triage me',
        status: 'todo',
      }),
    );
    db.add(Task.make({ title: 'Not triage', status: 'todo' }));
    // This query shape (chained `.select().select()`) is served by the async index query
    // source, not the in-memory one — flush so the query sees both just-added Tasks
    // deterministically (mirrors `EchoTestBuilder`'s `createDataAssertion` helper).
    await db.flush();

    const results = await db.query(Query.fromAst(view!.query.ast)).run();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(triageTask.id);
  });
});

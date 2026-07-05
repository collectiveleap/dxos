//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { Filter, Obj } from '@dxos/echo';
import { Kanban } from '@dxos/plugin-kanban';
import { Task } from '@dxos/types';

import { TriageBoard, TriageCard } from '#containers';
import { isTriageBoard } from '#operations';
import { TRIAGE_TAG } from '../constants';

const isTheTriageBoard = (value: unknown): value is Kanban.Kanban =>
  Obj.instanceOf(Kanban.Kanban, value) && isTriageBoard(value);

/** Matches a `Task` tagged `TRIAGE_TAG` — the same discriminator the triage board's `View` filters by. */
const isTriageTaskFilter = Filter.and(Filter.type(Task.Task), Filter.tag(TRIAGE_TAG));
const isTriageTask = (value: unknown): value is Task.Task =>
  Obj.isObject(value) && Filter.toPredicate(isTriageTaskFilter)(value);

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      Surface.create<AppSurface.ArticleData<unknown, {}, Kanban.Kanban>>({
        id: 'triageBoard',
        // Companion (not a primary Article/Section surface) so this never competes with
        // `plugin-kanban`'s own generic `KanbanArticle` surface for `Kanban.Kanban` — narrowed to
        // the one board `ensureTriageBoard` materializes via `isTriageBoard`, not any Kanban.
        // Built directly (not via `Surface.makeFilter`/`AppSurface.companion`) so `data.companionTo`
        // types as `Kanban.Kanban` while `data.attendableId` from the `Article` token contract
        // stays available for the toolbar's `Menu.Root` — mirrors `plugin-assistant`'s
        // `companionChat` surface. `SurfaceFilter`'s `_phantom` is compile-time only (never read at
        // runtime — see `Surface.Filter`'s declaration), so constructing the bindings directly here
        // is equivalent to `Surface.makeFilter`, just with an explicit `TData`.
        filter: {
          bindings: [
            {
              role: AppSurface.Article.role,
              // The Surface dispatcher always calls this guard with genuinely untyped data (its own
              // `SurfaceBinding.guard` signature is `(data: unknown) => boolean`); the cast reads
              // one optional field off it, then `isTheTriageBoard` does the real type-narrowing.
              guard: (data: unknown) => isTheTriageBoard((data as { companionTo?: unknown } | undefined)?.companionTo),
            },
          ],
        },
        component: ({ data }) => <TriageBoard kanban={data.companionTo} attendableId={data.attendableId} />,
      }),
      Surface.create({
        id: 'triageCard',
        // `Task.Task` is a shared type with no other plugin's primary Article surface (unlike
        // `Kanban.Kanban` above) — narrowed to triage cards via `isTriageTask` so this never
        // renders for an unrelated Task a future plugin might surface.
        filter: AppSurface.object(AppSurface.Article, Task.Task, ({ subject }) => isTriageTask(subject)),
        component: ({ data, role }) => (
          <TriageCard role={role} subject={data.subject} attendableId={data.attendableId} />
        ),
      }),
    ]),
  ),
);

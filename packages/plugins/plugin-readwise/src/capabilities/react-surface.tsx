//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { Obj } from '@dxos/echo';
import { Kanban } from '@dxos/plugin-kanban';

import { TriageBoard } from '#containers';
import { isTriageBoard } from '#operations';

const isTheTriageBoard = (value: unknown): value is Kanban.Kanban =>
  Obj.instanceOf(Kanban.Kanban, value) && isTriageBoard(value);

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      Surface.create({
        id: 'triageBoard',
        // Companion (not a primary Article/Section surface) so this never competes with
        // `plugin-kanban`'s own generic `KanbanArticle` surface for `Kanban.Kanban` — narrowed to
        // the one board `ensureTriageBoard` materializes via `isTriageBoard`, not any Kanban.
        filter: AppSurface.companion(AppSurface.Article, isTheTriageBoard),
        component: ({ data }) => <TriageBoard kanban={data.companionTo} />,
      }),
    ]),
  ),
);

//
// Copyright 2026 DXOS.org
//

// F-Bramble-Nav: per-space "Bramble" sidebar section + Today + All
// Tags items. Pattern follows plugin-feed's whenSpace extension —
// uses `AtomQuery.make(db, Filter.typename(...))` via `get()` so
// the connector is reactive to db changes (a Bramble being
// created later in the session re-runs the connector and the
// section appears live, per F-Bramble-Nav.section-present-iff-
// bramble-exists).

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { AppCapabilities, AppNodeMatcher } from '@dxos/app-toolkit';
import { Filter } from '@dxos/echo';
import { AtomQuery } from '@dxos/echo-atom';
import { GraphBuilder, Node } from '@dxos/plugin-graph';

import { ensureDayNodeForDate, today } from '../components/Day';
import { findOrCreateSchemaBlock } from '../components/Node/tag-supertags';

import { meta } from '#meta';
import { Bramble } from '#types';

export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    const extension = yield* GraphBuilder.createExtension({
      id: `${meta.id}.section`,
      match: AppNodeMatcher.whenSpace,
      connector: (space, get) =>
        Effect.gen(function* () {
          const db = (space as any).db;
          if (!db) {
            return [];
          }
          // Reactive: re-runs when Bramble.Graph instances appear /
          // disappear in this space. Per F-One-Graph the count is at
          // most 1; we treat zero as "no section" per
          // F-Bramble-Nav.section-present-iff-bramble-exists.
          const graphs = get(AtomQuery.make(db, Filter.type(Bramble.Graph)));
          if (graphs.length === 0) {
            return [];
          }

          // F-Today: find-or-create today's day-Node so we can target
          // it as the Today item's `data`. Idempotent per `type Day`'s
          // uniqueness invariant — same Node returned on re-render.
          const dayResult = ensureDayNodeForDate(db, today());
          // F-Bramble-Nav.all-tags-opens-schema-node: the per-space
          // Schema system Node is the All Tags target. Eagerly
          // materialised by F-Supertag.eager-materialization; this is
          // a find-or-create-safe access.
          const schemaNode = findOrCreateSchemaBlock(db);

          return [
            Node.make({
              id: `${meta.id}.section`,
              type: `${meta.id}.section`,
              data: null,
              properties: {
                label: 'Bramble',
                icon: 'ph--list-bullets--regular',
                iconHue: 'indigo',
                role: 'branch',
                disposition: 'workspace',
              },
              nodes: [
                Node.make({
                  id: `${meta.id}.today`,
                  type: `${meta.id}.today`,
                  data: dayResult?.node ?? null,
                  properties: {
                    label: 'Today',
                    icon: 'ph--calendar--regular',
                    iconHue: 'amber',
                  },
                }),
                Node.make({
                  id: `${meta.id}.all-tags`,
                  type: `${meta.id}.all-tags`,
                  data: schemaNode,
                  properties: {
                    label: 'All Tags',
                    icon: 'ph--tag--regular',
                    iconHue: 'indigo',
                  },
                }),
              ],
            }),
          ];
        }),
    });

    return Capability.contributes(AppCapabilities.AppGraphBuilder, [extension]);
  }),
);

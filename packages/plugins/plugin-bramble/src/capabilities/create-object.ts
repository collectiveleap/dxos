//
// Copyright 2025 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { getObjectPathFromObject } from '@dxos/app-toolkit';
import { Operation } from '@dxos/compute';
import { NavTreeCapabilities } from '@dxos/plugin-navtree';
import { SpaceCapabilities, SpaceOperation } from '@dxos/plugin-space';

import { ensureDayNodeForDate, today } from '../components/Day';
import { findBrambleGraph } from '../components/Graph/singleton';

import { meta } from '#meta';
import { Bramble } from '#types';

// F-One-Graph + F-No-Root: contributing the create-object entry for
// `Bramble.Graph` makes the navigator's space create-menu offer
// "Bramble". The handler is idempotent — invoking it on a space that
// already has a Bramble.Graph returns the existing one and navigates
// the user to today's Node instead of creating a new graph. Per
// F-One-Graph.create-action-is-idempotent +
// F-No-Root.create-navigates-to-today.
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    return Capability.contributes(SpaceCapabilities.CreateObjectEntry, {
      id: Bramble.Graph.typename,
      createObject: (_props, options) =>
        Effect.gen(function* () {
          const db = options.db as any;
          // F-One-Graph: at most one Bramble.Graph per space. If one
          // exists, skip creation (idempotent per
          // create-action-is-idempotent). Otherwise create via
          // SpaceOperation.AddObject — the canonical add path; the
          // `hidden: true` flag keeps it out of generic listings, in
          // concert with the SystemTypeAnnotation set on Bramble.Graph
          // per F-One-Graph.bramble-not-listed-under-types.
          let graph = findBrambleGraph(db);
          if (!graph) {
            const fresh = Bramble.makeGraph();
            const created = yield* Operation.invoke(SpaceOperation.AddObject, {
              object: fresh,
              target: options.target,
              hidden: true,
              targetNodeId: options.targetNodeId,
            });
            graph = ((created as any).object as any) ?? fresh;
          }
          // F-No-Root.create-navigates-to-today: navigate the user to
          // today's Node (find-or-created), NOT to the Bramble.Graph
          // itself (which is a marker and is not directly viewable per
          // F-No-Root.graph-not-directly-viewable).
          const dayResult = ensureDayNodeForDate(db, today());
          const target = (dayResult?.node as any) ?? (graph as any);

          // F-Bramble-Nav.section-expands-on-bramble-creation:
          // explicitly open the "Bramble" sidebar section in the
          // navtree's per-path state, so the user sees Today / All Tags
          // immediately without a click on the section's chevron. The
          // deck's normal expose-to-subject logic expands the path
          // through plugin-space's per-typename listing
          // (Database/...) rather than through our section — without
          // this explicit setItem, the section would remain collapsed
          // on first appearance.
          const spaceId = db?.spaceId as string | undefined;
          if (spaceId) {
            const sectionPath = ['root', spaceId, `${meta.id}.section`];
            const navState = yield* Capability.get(NavTreeCapabilities.State);
            const itemState = navState.getItem(sectionPath);
            if (!itemState.open) {
              navState.setItem(sectionPath, 'open', true);
            }
          }

          return {
            id: target.id,
            subject: [getObjectPathFromObject(target)],
            object: target,
          };
        }),
    });
  }),
);

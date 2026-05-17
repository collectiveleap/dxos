//
// Copyright 2025 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import { Plugin } from '@dxos/app-framework';
import { AppPlugin, getObjectPathFromObject } from '@dxos/app-toolkit';
import { Operation } from '@dxos/compute';
import { Annotation } from '@dxos/echo';
import { SpaceOperation } from '@dxos/plugin-space/operations';
import { type CreateObject } from '@dxos/plugin-space/types';

import { ensureDayNodeForDate, today } from './components/Day';
import { findBrambleGraph } from './components/Graph/singleton';

import { AppGraphBuilder, ReactSurface } from '#capabilities';
import { meta } from '#meta';
import { translations } from '#translations';
import { Bramble } from '#types';

export const BramblePlugin = Plugin.define(meta).pipe(
  AppPlugin.addMetadataModule({
    metadata: {
      id: Bramble.Graph.typename,
      metadata: {
        icon: Annotation.IconAnnotation.get(Bramble.Graph).pipe(Option.getOrThrow).icon,
        iconHue: Annotation.IconAnnotation.get(Bramble.Graph).pipe(Option.getOrThrow).hue ?? 'white',
        // F-One-Graph + F-No-Root: invoking the space create-menu's
        // "Bramble" item either creates the singleton Bramble.Graph
        // (when none exists) or returns the existing one (idempotent
        // per F-One-Graph.create-action-is-idempotent). Either way,
        // ensure today's Node exists and navigate the user to it
        // (NOT to the Bramble.Graph object, which is a marker and is
        // not directly viewable per F-No-Root.graph-not-directly-
        // viewable). Per F-No-Root.create-navigates-to-today.
        createObject: ((_props, options) =>
          Effect.gen(function* () {
            const db = options.db as any;
            // F-One-Graph: at most one Bramble.Graph per space.
            // If one exists, skip creation (idempotent per
            // create-action-is-idempotent). Otherwise create via
            // SpaceOperation.AddObject (the canonical add path —
            // hidden:true keeps it out of generic listings, in
            // concert with the SystemTypeAnnotation set on
            // Bramble.Graph per F-One-Graph.bramble-not-listed-
            // under-types).
            let graph = findBrambleGraph(db);
            if (!graph) {
              const fresh = Bramble.makeGraph();
              const created = yield* Operation.invoke(SpaceOperation.AddObject, {
                object: fresh,
                target: options.target,
                hidden: true,
                targetNodeId: options.targetNodeId,
              });
              graph = (created.object as any) ?? fresh;
            }
            // F-No-Root.create-navigates-to-today: navigate the user
            // to today's Node (find-or-created), NOT to the
            // Bramble.Graph itself.
            const dayResult = ensureDayNodeForDate(db, today());
            const target = (dayResult?.node as any) ?? (graph as any);
            return {
              id: target.id,
              subject: [getObjectPathFromObject(target)],
              object: target,
            };
          })) satisfies CreateObject,
      },
    },
  }),
  // F-Supertag substrate-vocabulary: register friendly navigator
  // metadata for the `#Step` / `#Run` supertag classes. No
  // `createObject` — these types are created via the F-Supertag
  // picker flow (typing `#step` on a bullet), not from the
  // navigator's Add menu. The metadata just gives the sidebar a
  // proper label + icon instead of the bare typename fallback.
  AppPlugin.addMetadataModule({
    metadata: {
      id: Bramble.Step.typename,
      metadata: {
        icon: Annotation.IconAnnotation.get(Bramble.Step).pipe(Option.getOrThrow).icon,
        iconHue: Annotation.IconAnnotation.get(Bramble.Step).pipe(Option.getOrThrow).hue ?? 'emerald',
      },
    },
  }),
  AppPlugin.addMetadataModule({
    metadata: {
      id: Bramble.Run.typename,
      metadata: {
        icon: Annotation.IconAnnotation.get(Bramble.Run).pipe(Option.getOrThrow).icon,
        iconHue: Annotation.IconAnnotation.get(Bramble.Run).pipe(Option.getOrThrow).hue ?? 'sky',
      },
    },
  }),
  AppPlugin.addSchemaModule({
    schema: [Bramble.Node, Bramble.Edge, Bramble.Graph, Bramble.Step, Bramble.Run, Bramble.Day],
  }),
  AppPlugin.addSurfaceModule({ activate: ReactSurface }),
  // F-Bramble-Nav: per-space "Bramble" sidebar section. The
  // capability matches whenSpace, contributing the section + its
  // Today + All Tags children iff the space contains a Bramble.
  AppPlugin.addAppGraphModule({ activate: AppGraphBuilder }),
  AppPlugin.addTranslationsModule({ translations }),
  Plugin.make,
);

export default BramblePlugin;

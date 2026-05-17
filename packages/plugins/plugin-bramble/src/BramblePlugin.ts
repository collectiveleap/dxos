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
        // F-One-Graph.create-action-is-idempotent: re-invoking the
        // create-menu's "Bramble" item when one already exists is a
        // no-op — return the existing Bramble's CreateObjectResult
        // shape so the dialog navigates the user to the existing
        // graph. Per F-One-Graph.singleton-per-space, at most one
        // Bramble.Graph exists per space.
        createObject: ((props, options) =>
          Effect.gen(function* () {
            const existing = findBrambleGraph(options.db as any);
            if (existing) {
              return {
                id: (existing as any).id,
                subject: [getObjectPathFromObject(existing as any)],
                object: existing as any,
              };
            }
            const object = Bramble.makeGraph({ name: props.name });
            return yield* Operation.invoke(SpaceOperation.AddObject, {
              object,
              target: options.target,
              hidden: true,
              targetNodeId: options.targetNodeId,
            });
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

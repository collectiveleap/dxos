//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';

import { Capability } from '@dxos/app-framework';
import { SpaceProperties } from '@dxos/client-protocol';
import { Operation } from '@dxos/compute';
import { Annotation, Filter, Obj, Query, Ref, Type } from '@dxos/echo';
import { SpaceCapabilities, SpaceOperation } from '@dxos/plugin-space';

import { BrambleRootAnnotation, Node, makeNode } from '#types';

export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    return [
      Capability.contributes(SpaceCapabilities.CreateObjectEntry, {
        id: Type.getTypename(Node),
        createObject: (props, options) =>
          Effect.gen(function* () {
            // BR-3 / decision D1: ONE Bramble per space — so create is GET-or-create. "The Bramble" is the
            // root Node whose Ref lives as an annotation on `space.properties`: the per-space singleton idiom
            // (see `AppAnnotation.RootCollectionAnnotation` + `CollectionModel.add`), which replicates across
            // the user's devices. `Node` itself stays unchanged (schema-A safe), and rows keep
            // `HiddenAnnotation` so bullets never reach the navtree.
            //
            // NOTE: the `CreateObject` contract's R channel provides only Capability/Operation services — no
            // Database service — so reach the db via `options.db` + `ref.load()` rather than
            // `Database.query`/`Database.load` (the route `CollectionModel.add` uses from an Effect DB context).
            const propertiesObjects = yield* Effect.promise(() =>
              options.db.query(Query.select(Filter.type(SpaceProperties))).run(),
            );
            // A scaffolded space has exactly one SpaceProperties; a bare db (headless/test harness) may have
            // none — fall back to a plain create rather than failing.
            const properties = propertiesObjects.length === 1 ? propertiesObjects[0] : undefined;
            const existingRef = properties
              ? Annotation.get(properties, BrambleRootAnnotation).pipe(Option.getOrUndefined)
              : undefined;
            // A recorded root that no longer resolves (removed elsewhere) must not break create — fall back
            // to making a fresh one.
            const existing = existingRef
              ? yield* Effect.tryPromise(() => existingRef.load()).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
              : undefined;

            // Re-invoking AddObject with the existing root OPENS it instead of making a second Bramble.
            const object = existing ?? makeNode(props);
            const result = yield* Operation.invoke(SpaceOperation.AddObject, {
              object,
              target: options.target,
              targetNodeId: options.targetNodeId,
            });

            // Record a freshly-created root as this space's Bramble.
            if (!existing && properties) {
              const ref = Ref.make(object);
              Obj.update(properties, (properties) => {
                const meta = Obj.getMeta(properties);
                if (!meta.annotations) {
                  meta.annotations = {};
                }
                Annotation.setDictionary(meta.annotations, BrambleRootAnnotation, ref);
              });
            }

            return result;
          }),
      }),
    ];
  }),
);

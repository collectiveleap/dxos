//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { Capability } from '@dxos/app-framework';
import { Operation } from '@dxos/compute';
import { Type } from '@dxos/echo';
import { SpaceCapabilities, SpaceOperation } from '@dxos/plugin-space';

import { Readwise } from '../types';

const CreateReadwiseSchema = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.annotations({ title: 'Name' }))),
});

/**
 * Registers `Readwise` as creatable from the navtree "+ Add" menu. Mirrors `plugin-kanban`'s
 * create-object: build the object, then route it into the navtree via `SpaceOperation.AddObject`.
 */
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    return Capability.contributes(SpaceCapabilities.CreateObjectEntry, {
      id: Type.getTypename(Readwise.Readwise),
      inputSchema: CreateReadwiseSchema,
      createObject: (props: Schema.Schema.Type<typeof CreateReadwiseSchema>, options) =>
        Effect.gen(function* () {
          const object = Readwise.make({ name: props.name });
          return yield* Operation.invoke(SpaceOperation.AddObject, {
            object,
            target: options.target,
            targetNodeId: options.targetNodeId,
          });
        }),
    });
  }),
);

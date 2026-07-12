//
// Copyright 2026 DXOS.org
//

import * as Schema from 'effect/Schema';

import { Annotation, DXN, Obj, Ref, Type } from '@dxos/echo';
import { HiddenAnnotation } from '@dxos/echo/Annotation';
import { Text } from '@dxos/schema';

export class Node extends Type.makeObject<Node>(DXN.make('org.dxos.type.bramble.node', '0.1.0'))(
  Schema.Struct({
    text: Schema.optional(Ref.Ref(Text.Text)),
  }).pipe(
    Annotation.IconAnnotation.set({ icon: 'ph--circle--regular', hue: 'indigo' }),
    // P3: hide the row Node type from Composer's generic UI (as DXOS's own Tag/Text types do).
    HiddenAnnotation.set(true),
  ),
) {}

export const makeNode = ({ text }: { text?: string } = {}): Node =>
  Obj.make(Node, { text: text != null ? Ref.make(Text.make({ content: text })) : undefined });

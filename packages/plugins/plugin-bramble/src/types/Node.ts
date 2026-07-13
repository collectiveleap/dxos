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
  // Always create a Text (empty when unspecified) so every Node — including one created via
  // Composer's create-object menu with no text — renders an editable row/header, not the
  // read-only fallback RowEditor uses for a text-less node.
  Obj.make(Node, { text: Ref.make(Text.make({ content: text ?? '' })) });

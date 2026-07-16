//
// Copyright 2026 DXOS.org
//

import { Annotation, Ref } from '@dxos/echo';

import { Node } from './Node';

/**
 * The per-space Bramble root Node — "the Bramble" (BR-3 / decision D1: one per space, so create is
 * GET-or-create).
 *
 * Stored as an annotation on `space.properties`, mirroring `AppAnnotation.RootCollectionAnnotation`
 * (`sdk/app-toolkit/src/echo/AppAnnotation.ts:11`) — the current idiom for a per-space singleton ref,
 * which replicates across the user's devices. Deliberately NOT a raw `space.properties[<typename>]`
 * key: that is the legacy shape `plugin-space` actively migrates away from
 * (`plugin-space/src/capabilities/spaces-ready.ts:165-170`).
 *
 * Keeping the root's identity here (rather than a marker field on `Node`) leaves `Node` unchanged —
 * schema-A safe (BR-16/D2), and rows keep `HiddenAnnotation` so bullets never reach the navtree.
 */
export const BrambleRootAnnotation = Annotation.make({
  id: 'org.dxos.space.brambleRoot',
  schema: Ref.Ref(Node),
});

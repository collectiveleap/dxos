//
// Copyright 2026 DXOS.org
//

// F-Versioning: per-edge pinning + snapshot resolution.
//
// Some Bramble.Edge kinds carry a contract that their target should
// be observed as it was at the moment the edge was created, not as
// it is now (today: `'is-run-of'`, so a Run displays the Step as the
// executor saw it). This module is the single place that decides
// which kinds pin, captures the heads at edge-create time, and
// resolves a pinned edge back to its time-traveled target state at
// render time.
//
// Per F-Versioning.pinning-edge-kinds-set: new pinning kinds join
// PINNING_EDGE_KINDS by deliberate spec change (a new req naming the
// kind and reasoning about why pinning applies to it).

import { Obj, Relation } from '@dxos/echo';
import { checkoutVersion } from '@dxos/echo-db';

import { Bramble } from '#types';

// Canonical pinning-edge-kinds set. v1 = exactly `{'is-run-of'}`.
// Future kinds join by deliberate spec change per
// F-Versioning.pinning-edge-kinds-set.
export const PINNING_EDGE_KINDS: ReadonlySet<Bramble.Edge['kind']> = new Set<Bramble.Edge['kind']>([
  'is-run-of',
]);

// True when an edge kind triggers auto-pinning at create time and
// snapshot resolution at render time.
export const isPinningEdgeKind = (kind: Bramble.Edge['kind'] | undefined): boolean => {
  if (kind === undefined) {
    return false;
  }
  return PINNING_EDGE_KINDS.has(kind);
};

// Capture the target's current Automerge version as an encoded
// string suitable for storage in `Bramble.Edge.targetVersion`.
// Returns undefined when the target has no resolvable version (the
// rare unversioned case — see EntityVersion's `versioned: false`
// branch in @dxos/echo).
export const captureTargetVersion = (target: Bramble.Node | undefined): string | undefined => {
  if (!target) {
    return undefined;
  }
  try {
    const v = Obj.version(target as any);
    if (!v || (v as any).versioned === false) {
      return undefined;
    }
    return Obj.encodeVersion(v);
  } catch {
    return undefined;
  }
};

// Sentinel returned by `resolveEdgeTarget` when the pinned target's
// snapshot could not be reconstructed (e.g. explicit privacy-
// deletion has actually removed the underlying Automerge doc, out
// of v1 scope but caught here so callers can render a placeholder
// instead of crashing).
export type RemovedSentinel = { __bramble_removed: true };

export const isRemoved = (value: unknown): value is RemovedSentinel => {
  return typeof value === 'object' && value !== null && (value as any).__bramble_removed === true;
};

const REMOVED: RemovedSentinel = Object.freeze({ __bramble_removed: true });

// Resolve an Edge's target for rendering. Three branches:
//   - Edge has no `targetVersion`: return the live target (unchanged
//     from pre-F-Versioning behavior — F-Versioning.unpinned-edges-
//     render-live).
//   - Edge has `targetVersion` AND `checkoutVersion` succeeds: return
//     a hydration-shim object exposing the snapshot's fields for
//     read-only rendering (F-Versioning.pinned-edges-render-snapshot).
//   - Edge has `targetVersion` but `checkoutVersion` fails (privacy-
//     deletion case): return the REMOVED sentinel so the renderer
//     can surface a `[removed]` placeholder.
export const resolveEdgeTarget = (edge: any): Bramble.Node | RemovedSentinel | undefined => {
  if (!edge) {
    return undefined;
  }
  const liveTarget = Relation.getTarget(edge) as Bramble.Node | undefined;
  const encoded = (edge as any).targetVersion as string | undefined;

  // Unpinned (F-Versioning.unpinned-edges-render-live).
  if (!encoded) {
    return liveTarget;
  }

  // Pinned — try to time-travel.
  if (!liveTarget) {
    // No live target object means even Automerge has nothing to read
    // from (the doc-handle isn't resolvable). Treat as removed.
    return REMOVED;
  }
  try {
    const decoded = Obj.decodeVersion(encoded);
    const heads = (decoded as any).automergeHeads as string[] | undefined;
    if (!heads || heads.length === 0) {
      // Unversioned encoded value — fall back to live (the pin was
      // captured against an unversioned target; no time-travel
      // possible, and the spec's "live for unpinned" branch is the
      // sensible fallback for this edge case).
      return liveTarget;
    }
    const raw = checkoutVersion(liveTarget as any, heads);
    if (!raw) {
      return REMOVED;
    }
    return hydrateSnapshot(liveTarget, raw);
  } catch {
    return REMOVED;
  }
};

// F-Versioning hydration shim: `checkoutVersion` returns raw object
// data (see the TODO in `@dxos/echo-db`'s `edit-history.ts` —
// "Hydrate the object"). For render-only consumption Bramble doesn't
// need a fully reactive proxy; a frozen plain object that exposes
// the fields the renderer reads is enough. The shim preserves the
// live target's `id` so `data-block-id`-based DOM hit-testing and
// `useObject` (when accidentally called on a snapshot) degrade
// gracefully.
//
// Local helper now. Promote upstream to `@dxos/echo-db` (a proper
// `getReactiveAt(target, heads)`) once the shape is stable.
const hydrateSnapshot = (liveTarget: Bramble.Node, raw: any): Bramble.Node => {
  const fields = { ...raw };
  // checkoutVersion returns `{ id, [ATTR_TYPE]?, [ATTR_META]?, ...data }`.
  // The renderer reads top-level fields (`content`, `kind`,
  // `supertags`, `fields`, `state`, etc.) so spreading `data` to
  // top-level is enough. The `id` is already in `raw`.
  // Pin the live target's id in case `raw.id` is undefined for some
  // edge of the checkout code path.
  fields.id = (raw as any).id ?? (liveTarget as any).id;
  return Object.freeze(fields) as Bramble.Node;
};

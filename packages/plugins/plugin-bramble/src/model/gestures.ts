//
// Copyright 2026 DXOS.org
//

import { Obj, Relation } from '@dxos/echo';
import { orderBetween } from './edges';
import { type OutlineRow } from './outline';
import { Node } from '../types';

// A row's object is `Obj.Unknown` (BR-16): only a `Node` carries text. A foreign object has no
// text content, so split/merge (text-only gestures) treat it as empty here — the controller's
// gesture guards keep those gestures from acting on a non-Node row.
const contentOf = (node: Obj.Unknown): string => (Obj.instanceOf(Node, node) ? (node.text?.target?.content ?? '') : '');
const childRowsOf = (rows: OutlineRow[], parentId: string): OutlineRow[] =>
  rows.filter((r) => Relation.getSource(r.edge).id === parentId);

export type SplitPlan = { keepText: string; newText: string; parentId: string; order: number };

export const splitPlan = (rows: OutlineRow[], root: Node, nodeId: string, caretOffset: number): SplitPlan => {
  const node = nodeId === root.id ? root : rows.find((r) => r.node.id === nodeId)!.node;
  const content = contentOf(node);
  const keepText = content.slice(0, caretOffset);
  const newText = content.slice(caretOffset);
  const kids = childRowsOf(rows, nodeId);

  let parentId: string;
  let before: OutlineRow | undefined;
  let after: OutlineRow | undefined;
  if (nodeId === root.id || kids.length > 0) {
    parentId = nodeId; // new first child
    after = kids[0];
  } else {
    const row = rows.find((r) => r.node.id === nodeId)!;
    parentId = Relation.getSource(row.edge).id; // new next sibling
    const sibs = childRowsOf(rows, parentId);
    const i = sibs.findIndex((r) => r.node.id === nodeId);
    before = sibs[i];
    after = sibs[i + 1];
  }
  return { keepText, newText, parentId, order: orderBetween(before?.edge, after?.edge) };
};

export type MergePlan = { precedingId: string; nodeText: string; mergeOffset: number };

/** Backspace at offset 0. Floor: only childless nodes merge; a node with children is a no-op (deferred). */
export const mergePlan = (rows: OutlineRow[], root: Node, nodeId: string): MergePlan | null => {
  const idx = rows.findIndex((r) => r.node.id === nodeId);
  if (idx < 0 || childRowsOf(rows, nodeId).length > 0) {
    return null;
  }
  const preceding = idx === 0 ? root : rows[idx - 1].node;
  return { precedingId: preceding.id, nodeText: contentOf(rows[idx].node), mergeOffset: contentOf(preceding).length };
};

export type ReparentPlan = { newParentId: string; order: number };

/** Tab. Nests the focused row under its preceding sibling (appended as its last child). No-op if there is none. */
export const indentPlan = (rows: OutlineRow[], root: Node, nodeId: string): ReparentPlan | null => {
  const row = rows.find((r) => r.node.id === nodeId);
  if (!row) {
    return null;
  }
  const parentId = Relation.getSource(row.edge).id;
  const sibs = childRowsOf(rows, parentId);
  const i = sibs.findIndex((r) => r.node.id === nodeId);
  if (i <= 0) {
    return null; // no preceding sibling
  }
  const newParent = sibs[i - 1];
  const kids = childRowsOf(rows, newParent.node.id);
  return { newParentId: newParent.node.id, order: orderBetween(kids[kids.length - 1]?.edge, undefined) };
};

/** Shift-Tab. Lifts the focused row to become its parent's following sibling. No-op at the top level. */
export const outdentPlan = (rows: OutlineRow[], root: Node, nodeId: string): ReparentPlan | null => {
  const row = rows.find((r) => r.node.id === nodeId);
  if (!row) {
    return null;
  }
  const parentId = Relation.getSource(row.edge).id;
  if (parentId === root.id) {
    return null; // already top level
  }
  const parentRow = rows.find((r) => r.node.id === parentId)!;
  const grandparentId = Relation.getSource(parentRow.edge).id;
  const gpKids = childRowsOf(rows, grandparentId);
  const pi = gpKids.findIndex((r) => r.node.id === parentId);
  return { newParentId: grandparentId, order: orderBetween(gpKids[pi]?.edge, gpKids[pi + 1]?.edge) };
};

/** Cmd-Shift-Up/Down. Moves the focused row up/down among its siblings by rewriting its edge's
 *  order in place. No-op at either end (no neighbour to swap past in that direction). */
export const reorderPlan = (rows: OutlineRow[], root: Node, nodeId: string, dir: -1 | 1): { order: number } | null => {
  const row = rows.find((r) => r.node.id === nodeId);
  if (!row) {
    return null;
  }
  const parentId = Relation.getSource(row.edge).id;
  const sibs = childRowsOf(rows, parentId);
  const i = sibs.findIndex((r) => r.node.id === nodeId);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) {
    return null; // no neighbour
  }
  const order =
    dir < 0
      ? orderBetween(sibs[j - 1]?.edge, sibs[j].edge) // land before the preceding sibling
      : orderBetween(sibs[j].edge, sibs[j + 1]?.edge); // land after the following sibling
  return { order };
};

export type DragInstruction = 'reorder-above' | 'reorder-below' | 'make-child';

/** Same-parent move rewrites `order` (reorder); a parent change replaces the edge (reparent). */
export type DragPlan =
  | { kind: 'reorder'; order: number }
  | { kind: 'reparent'; newParentId: string; order: number };

/**
 * Pure planner for a bullet-drag drop. Mirrors the three concrete tree-item instructions
 * (`@atlaskit/.../tree-item`, matching `react-ui-list`'s `Tree/testing.ts` reference):
 *   - reorder-above → become the sibling immediately BEFORE the target (target's parent)
 *   - reorder-below → become the sibling immediately AFTER the target  (target's parent)
 *   - make-child    → become the target's LAST child
 * Returns `{ kind: 'reorder' }` when the parent is unchanged (cheap `order` rewrite), else
 * `{ kind: 'reparent' }`. Returns `null` for a no-op: dropping a node on itself, or into its
 * own subtree (would create a cycle; `reparentEdge` also guards this at write time).
 */
export const dragPlan = (
  rows: OutlineRow[],
  root: Node,
  sourceId: string,
  targetId: string,
  instruction: DragInstruction,
): DragPlan | null => {
  if (sourceId === targetId) {
    return null;
  }
  const sIdx = rows.findIndex((r) => r.node.id === sourceId);
  if (sIdx < 0) {
    return null;
  }
  const source = rows[sIdx];
  // `rows` is a pre-order DFS with `depth`, so the source's subtree is the contiguous run of
  // rows after it whose depth is greater than the source's. A target inside that run is a
  // descendant — dropping there would create a cycle.
  for (let i = sIdx + 1; i < rows.length && rows[i].depth > source.depth; i++) {
    if (rows[i].node.id === targetId) {
      return null;
    }
  }
  const sourceParentId = Relation.getSource(source.edge).id;

  if (instruction === 'make-child') {
    if (targetId !== root.id && !rows.some((r) => r.node.id === targetId)) {
      return null;
    }
    const kids = childRowsOf(rows, targetId).filter((r) => r.node.id !== sourceId);
    const order = orderBetween(kids[kids.length - 1]?.edge, undefined);
    return targetId === sourceParentId
      ? { kind: 'reorder', order }
      : { kind: 'reparent', newParentId: targetId, order };
  }

  const targetRow = rows.find((r) => r.node.id === targetId);
  if (!targetRow) {
    return null;
  }
  const newParentId = Relation.getSource(targetRow.edge).id;
  // Exclude the source so an adjacent same-parent move uses the correct neighbour edges.
  const sibs = childRowsOf(rows, newParentId).filter((r) => r.node.id !== sourceId);
  const ti = sibs.findIndex((r) => r.node.id === targetId);
  const order =
    instruction === 'reorder-above'
      ? orderBetween(sibs[ti - 1]?.edge, targetRow.edge)
      : orderBetween(targetRow.edge, sibs[ti + 1]?.edge);
  return newParentId === sourceParentId
    ? { kind: 'reorder', order }
    : { kind: 'reparent', newParentId, order };
};

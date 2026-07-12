//
// Copyright 2026 DXOS.org
//

import { Relation } from '@dxos/echo';
import { orderBetween } from './edges';
import { type OutlineRow } from './outline';
import { type Node } from '../types';

const contentOf = (node: Node): string => node.text?.target?.content ?? '';
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

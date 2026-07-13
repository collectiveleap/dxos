//
// Copyright 2026 DXOS.org
//

import { EditorSelection } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import { createContext, useContext } from 'react';

import { Obj } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';

import { createEdge, removeEdge } from '../../model/edges';
import { mergePlan, splitPlan } from '../../model/gestures';
import { type OutlineRow } from '../../model/outline';
import { Node, makeNode } from '../../types';

export type FocusPos = 'start' | 'end' | number;

export type OutlineControllerCtx = {
  db: EchoDatabase;
  root: Node;
  getRows: () => OutlineRow[] | Promise<OutlineRow[]>;
};

export class OutlineController {
  private readonly views = new Map<string, EditorView>();
  private pendingFocus: { nodeId: string; pos: FocusPos } | null = null;

  constructor(private readonly ctx: OutlineControllerCtx) {}

  /** Update the ctx (fresh root/getRows) on each shell render without recreating the instance. */
  setCtx(ctx: OutlineControllerCtx) {
    (this as any).ctx = ctx;
  }

  register(nodeId: string, view: EditorView): () => void {
    this.views.set(nodeId, view);
    if (this.pendingFocus?.nodeId === nodeId) {
      this.place(view, this.pendingFocus.pos);
      this.pendingFocus = null;
    }
    return () => {
      if (this.views.get(nodeId) === view) {
        this.views.delete(nodeId);
      }
    };
  }

  focusRow(nodeId: string, pos: FocusPos) {
    const view = this.views.get(nodeId);
    if (view) {
      this.place(view, pos);
    } else {
      this.pendingFocus = { nodeId, pos };
    }
  }

  private place(view: EditorView, pos: FocusPos) {
    const at = pos === 'start' ? 0 : pos === 'end' ? view.state.doc.length : Math.min(pos, view.state.doc.length);
    view.dispatch({ selection: EditorSelection.cursor(at) });
    view.focus();
  }

  private nodeOf(rows: OutlineRow[], id: string): Node {
    return id === this.ctx.root.id ? this.ctx.root : rows.find((r) => r.node.id === id)!.node;
  }

  async createAfter(nodeId: string, caretOffset: number) {
    const rows = await this.ctx.getRows();
    const plan = splitPlan(rows, this.ctx.root, nodeId, caretOffset);
    const parent = this.nodeOf(rows, plan.parentId);
    const newNode = this.ctx.db.add(makeNode({ text: plan.newText }));
    await createEdge(this.ctx.db, parent, newNode, plan.order);
    // trim the tail out of the source row's text (mounted editors update via their automerge binding)
    const sourceText = this.nodeOf(rows, nodeId).text?.target;
    if (sourceText) {
      Obj.update(sourceText, (m) => {
        m.content = plan.keepText;
      });
    }
    this.focusRow(newNode.id, 'start');
  }

  async mergeBackward(nodeId: string) {
    const rows = await this.ctx.getRows();
    const plan = mergePlan(rows, this.ctx.root, nodeId);
    if (!plan) {
      return;
    }
    // append this node's text to the preceding node's text (mounted editors update via their automerge binding)
    const precedingText = this.nodeOf(rows, plan.precedingId).text?.target;
    if (precedingText) {
      Obj.update(precedingText, (m) => {
        m.content = (precedingText.content ?? '') + plan.nodeText;
      });
    }
    // remove this node's structural edge + the node
    const row = rows.find((r) => r.node.id === nodeId)!;
    removeEdge(this.ctx.db, row.edge);
    this.ctx.db.remove(row.node);
    this.focusRow(plan.precedingId, plan.mergeOffset);
  }

  async focusAdjacent(nodeId: string, dir: -1 | 1) {
    const rows = await this.ctx.getRows();
    const idx = rows.findIndex((r) => r.node.id === nodeId);
    const targetId =
      dir < 0 ? (idx <= 0 ? this.ctx.root.id : rows[idx - 1].node.id) : rows[idx + 1]?.node.id;
    if (targetId) {
      this.focusRow(targetId, dir < 0 ? 'end' : 'start');
    }
  }
}

export const OutlineControllerContext = createContext<OutlineController | null>(null);
export const useOutlineController = (): OutlineController | null => useContext(OutlineControllerContext);

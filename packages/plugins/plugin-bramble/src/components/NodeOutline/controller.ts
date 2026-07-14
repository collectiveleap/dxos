//
// Copyright 2026 DXOS.org
//

import { EditorSelection } from '@codemirror/state';
import { type EditorView } from '@codemirror/view';
import { createContext, useContext } from 'react';

import { Obj, Relation } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';

import { createEdge, parentEdges, removeEdge, reparentEdge } from '../../model/edges';
import { type DragInstruction, dragPlan, indentPlan, mergePlan, outdentPlan, reorderPlan, splitPlan } from '../../model/gestures';
import { type OutlineRow } from '../../model/outline';
import {
  EMPTY_VIEW_STATE,
  type ViewState,
  toggleCollapsed,
  zoomOut as zoomOutState,
  zoomTo as zoomToState,
} from '../../model/view-state';
import { Node, makeNode } from '../../types';

export type FocusPos = 'start' | 'end' | number;

export type OutlineControllerCtx = {
  db: EchoDatabase;
  root: Node;
  getRows: () => OutlineRow[] | Promise<OutlineRow[]>;
  /** Force a re-render after a mutation that `useQuery`'s membership-only reactivity won't
   *  pick up on its own (an in-place property change on an already-matching object, e.g. an
   *  edge's `order` — see `query-result.ts`: "Does not update when the object properties
   *  change"). Structural gestures (indent/outdent/merge/split) add or remove edges, which
   *  IS membership-visible, so they don't need this. */
  notifyMutated?: () => void;
};

export class OutlineController {
  private readonly views = new Map<string, EditorView>();
  private pendingFocus: { nodeId: string; pos: FocusPos } | null = null;
  private viewState: ViewState = EMPTY_VIEW_STATE;

  constructor(private readonly ctx: OutlineControllerCtx) {}

  getViewState(): ViewState {
    return this.viewState;
  }

  toggleCollapse(nodeId: string) {
    this.viewState = toggleCollapsed(this.viewState, nodeId);
    this.ctx.notifyMutated?.();
  }

  zoomTo(nodeId: string) {
    this.viewState = zoomToState(this.viewState, nodeId);
    this.ctx.notifyMutated?.();
    // The zoomed-to Node becomes the header, so its own row (if it had one) unmounts —
    // dropping keyboard focus to nowhere, which would strand a keyboard-driven zoom (no
    // focused view left to receive `Escape`/further gestures). Move focus to the header
    // once the re-render has committed. Deferred via `requestAnimationFrame` rather than
    // `pendingFocus`/`register()` (the mechanism `refocusAfterReparent` uses for
    // indent/outdent's edge-keyed remount): the header's `RowEditor` re-registers under
    // `nodeId` more than once for this one prop change (an intermediate view before the
    // final one), so reacting to the *first* `register()` call would place focus on a
    // transitional view that's immediately replaced. Checking `views.get(nodeId)` after a
    // paint always finds whichever view is actually current.
    requestAnimationFrame(() => {
      const view = this.views.get(nodeId);
      if (view) {
        this.place(view, 'start');
      }
    });
  }

  zoomOut() {
    this.viewState = zoomOutState(this.viewState);
    this.ctx.notifyMutated?.();
  }

  isZoomed(): boolean {
    return this.getViewState().zoomRootId !== null;
  }

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
      Obj.update(sourceText, (sourceText) => {
        sourceText.content = plan.keepText;
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
      Obj.update(precedingText, (precedingText) => {
        precedingText.content = (precedingText.content ?? '') + plan.nodeText;
      });
    }
    // remove this node's structural edge; remove the node itself only if this was its last inbound edge
    // (a Node may have more than one structural parent — removing it globally would dangle the others)
    const row = rows.find((r) => r.node.id === nodeId)!;
    const inbound = await parentEdges(this.ctx.db, row.node);
    removeEdge(this.ctx.db, row.edge);
    if (inbound.length <= 1) {
      this.ctx.db.remove(row.node);
    }
    this.focusRow(plan.precedingId, plan.mergeOffset);
  }

  async indent(nodeId: string) {
    const rows = await this.ctx.getRows();
    const plan = indentPlan(rows, this.ctx.root, nodeId);
    if (!plan) {
      return;
    }
    const row = rows.find((r) => r.node.id === nodeId)!;
    const oldView = this.views.get(nodeId);
    const caret: FocusPos = oldView?.state.selection.main.head ?? 'end';
    await reparentEdge(this.ctx.db, row.edge, this.nodeOf(rows, plan.newParentId), plan.order);
    this.refocusAfterReparent(nodeId, oldView, caret);
  }

  async outdent(nodeId: string) {
    const rows = await this.ctx.getRows();
    const plan = outdentPlan(rows, this.ctx.root, nodeId);
    if (!plan) {
      return;
    }
    const row = rows.find((r) => r.node.id === nodeId)!;
    const oldView = this.views.get(nodeId);
    const caret: FocusPos = oldView?.state.selection.main.head ?? 'end';
    await reparentEdge(this.ctx.db, row.edge, this.nodeOf(rows, plan.newParentId), plan.order);
    this.refocusAfterReparent(nodeId, oldView, caret);
  }

  /**
   * `reparentEdge` replaces the edge (endpoints are immutable), and rows are keyed by
   * `edge.id` (see NodeOutline.tsx), so this row's `RowEditor`/`EditorView` remounts across
   * an indent/outdent. `focusRow`'s normal fast path (place immediately if a view is already
   * registered) is unsafe to call blindly here: React's key-driven remount is not guaranteed
   * to have happened yet by the time `reparentEdge`'s promise resolves, so `focusRow` could
   * place the caret on the OLD view a moment before it's torn down, leaving the new view
   * unfocused. Instead: if a *different* view is already registered under `nodeId` (the
   * remount already landed), place on it directly; otherwise queue `pendingFocus` so the
   * next `register()` call — guaranteed to be the new mount — fulfills it.
   */
  private refocusAfterReparent(nodeId: string, oldView: EditorView | undefined, pos: FocusPos) {
    const currentView = this.views.get(nodeId);
    if (currentView && currentView !== oldView) {
      this.place(currentView, pos);
    } else {
      this.pendingFocus = { nodeId, pos };
    }
  }

  async reorder(nodeId: string, dir: -1 | 1) {
    const rows = await this.ctx.getRows();
    const plan = reorderPlan(rows, this.ctx.root, nodeId, dir);
    if (!plan) {
      return;
    }
    const row = rows.find((r) => r.node.id === nodeId)!;
    const edge = row.edge;
    Relation.update(edge, (edge) => {
      edge.order = plan.order;
    });
    this.ctx.notifyMutated?.();
  }

  /**
   * Apply a bullet-drag drop. Same shape as the keyboard reshape path: compute a pure
   * `dragPlan`, then apply it — a same-parent move rewrites `order` in place (cheap, no
   * remount), a parent change goes through `reparentEdge` (cycle-checked; replaces the edge,
   * so the row remounts under its new `edge.id` key). Pointer-driven, so — unlike the keyboard
   * indent/outdent — it does not preserve or restore caret focus.
   */
  async applyDrag(sourceId: string, targetId: string, instruction: DragInstruction) {
    const rows = await this.ctx.getRows();
    const plan = dragPlan(rows, this.ctx.root, sourceId, targetId, instruction);
    if (!plan) {
      return;
    }
    const row = rows.find((r) => r.node.id === sourceId)!;
    if (plan.kind === 'reorder') {
      Relation.update(row.edge, (edge) => {
        edge.order = plan.order;
      });
      this.ctx.notifyMutated?.();
    } else {
      try {
        await reparentEdge(this.ctx.db, row.edge, this.nodeOf(rows, plan.newParentId), plan.order);
      } catch {
        // `reparentEdge` rejects a cycle at write time (a multi-location drop whose cycle path
        // differs from the visible subtree `dragPlan` guards against). The graph is left
        // unchanged, so treat the rejected drop as a no-op rather than a floating rejection.
      }
    }
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

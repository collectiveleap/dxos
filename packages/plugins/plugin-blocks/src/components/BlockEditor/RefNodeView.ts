//
// Copyright 2025 DXOS.org
//

import { type Node } from 'prosemirror-model';
import { type EditorView } from 'prosemirror-view';

import { Obj } from '@dxos/echo';

export type ResolveRef = (dxn: string) => any;

// Increment 4: vanilla NodeView for the inline ref node. Resolves the target
// by DXN at mount and on each ProseMirror update() call, then writes the
// target's current label into the rendered span.
//
// Live-rename on external mutation isn't subscribed yet (deferred to I4b).
// The label refreshes whenever ProseMirror calls update() — typically on
// any doc edit in the same paragraph — so a rename followed by any local
// edit will refresh the label immediately.
export class RefNodeView {
  readonly dom: HTMLElement;
  #dxn: string;
  #resolveRef: ResolveRef;

  constructor(node: Node, _view: EditorView, _getPos: () => number | undefined, resolveRef: ResolveRef) {
    this.#dxn = (node.attrs.dxn as string) ?? '';
    this.#resolveRef = resolveRef;
    this.dom = document.createElement('span');
    this.dom.className = 'block-ref';
    this.dom.setAttribute('data-dxn', this.#dxn);
    this.#render();
  }

  update(node: Node): boolean {
    if (node.type.name !== 'ref') {
      return false;
    }
    const nextDxn = (node.attrs.dxn as string) ?? '';
    if (nextDxn !== this.#dxn) {
      this.#dxn = nextDxn;
      this.dom.setAttribute('data-dxn', this.#dxn);
    }
    // Always re-render so a rename of the target propagates.
    this.#render();
    return true;
  }

  destroy(): void {
    // No subscriptions to clean up yet.
  }

  #render(): void {
    const target = this.#dxn ? this.#resolveRef(this.#dxn) : undefined;
    const label = target ? readLabel(target) : '';
    this.dom.textContent = label || '…';
  }
}

const readLabel = (target: any): string => {
  const label = Obj.getLabel(target);
  if (typeof label === 'string' && label.length > 0) {
    return label;
  }
  return target?.name ?? target?.title ?? '';
};

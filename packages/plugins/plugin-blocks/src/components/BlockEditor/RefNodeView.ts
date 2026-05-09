//
// Copyright 2025 DXOS.org
//

import { type Node } from 'prosemirror-model';
import { type EditorView } from 'prosemirror-view';

import { Obj } from '@dxos/echo';

import { getDisplayLabel } from '../labels';

export type ResolveRef = (dxn: string) => any;

// Increment 4b: vanilla NodeView for the inline ref node. Resolves the target
// at mount, subscribes to it via Obj.subscribe so a rename of the target
// propagates to the rendered label without any local edit.
export class RefNodeView {
  readonly dom: HTMLElement;
  #dxn: string;
  #resolveRef: ResolveRef;
  #unsubscribe?: () => void;

  constructor(node: Node, _view: EditorView, _getPos: () => number | undefined, resolveRef: ResolveRef) {
    this.#dxn = (node.attrs.dxn as string) ?? '';
    this.#resolveRef = resolveRef;
    this.dom = document.createElement('span');
    // F-V3 styling: link-blue, no underline by default, underline on hover.
    this.dom.className =
      'block-ref text-blue-600 dark:text-blue-400 hover:underline cursor-pointer';
    this.dom.setAttribute('data-dxn', this.#dxn);
    this.#bind();
  }

  update(node: Node): boolean {
    if (node.type.name !== 'ref') {
      return false;
    }
    const nextDxn = (node.attrs.dxn as string) ?? '';
    if (nextDxn !== this.#dxn) {
      this.#dxn = nextDxn;
      this.dom.setAttribute('data-dxn', this.#dxn);
      this.#bind();
    } else {
      this.#render();
    }
    return true;
  }

  destroy(): void {
    this.#unsubscribe?.();
  }

  // (Re)resolve the target and subscribe so external mutations to its fields
  // (notably rename via Obj.update) propagate into the rendered label.
  #bind(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#render();
    const target = this.#dxn ? this.#resolveRef(this.#dxn) : undefined;
    if (target) {
      this.#unsubscribe = Obj.subscribe(target, () => this.#render());
    }
  }

  #render(): void {
    const target = this.#dxn ? this.#resolveRef(this.#dxn) : undefined;
    const label = target ? getDisplayLabel(target) : '';
    this.dom.textContent = label || '…';
  }
}
